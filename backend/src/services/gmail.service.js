// backend/src/services/gmail.service.js
// Gmail API service: token management, watch renewal, History API change detection, and sync.

import { google } from 'googleapis';
import { EmailAccount } from '../models/emailAccount.model.js';
import { Email } from '../models/email.model.js';
import { createOAuth2Client } from './googleAuth.service.js';
import { parseGmailMessage } from './mimeParser.service.js';
import { withAccountLock } from '../utils/lock.js';
import { enqueueEmailProcessing } from '../queues/email.queue.js';
import { env } from '../config/env.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Build an authenticated googleapis client for an EmailAccount.
 * Automatically refreshes access tokens and persists updated tokens to MongoDB.
 *
 * @param {string|object} accountOrId - EmailAccount instance or ObjectId string
 * @returns {Promise<{ gmail: import('googleapis').gmail_v1.Gmail, account: EmailAccount }>}
 */
export async function getAuthenticatedGmailClient(accountOrId) {
  let account = accountOrId;
  if (typeof accountOrId === 'string' || accountOrId._bsontype) {
    account = await EmailAccount.findById(accountOrId).select(
      '+encryptedAccessToken +encryptedRefreshToken',
    );
  } else if (!account.getDecryptedAccessToken) {
    account = await EmailAccount.findById(account._id).select(
      '+encryptedAccessToken +encryptedRefreshToken',
    );
  }

  if (!account) {
    throw new AppError('Email account connection not found', 404, 'ACCOUNT_NOT_FOUND');
  }

  if (account.connectionStatus === 'disconnected' || account.connectionStatus === 'revoked') {
    throw new AppError(
      'Gmail account is disconnected or revoked. Please reconnect.',
      401,
      'ACCOUNT_DISCONNECTED',
    );
  }

  const accessToken = account.getDecryptedAccessToken();
  const refreshToken = account.getDecryptedRefreshToken();

  if (!refreshToken && !accessToken) {
    account.connectionStatus = 'expired';
    await account.save();
    throw new AppError(
      'OAuth tokens missing. Please reconnect your Gmail account.',
      401,
      'TOKEN_MISSING',
    );
  }

  const oauth2Client = createOAuth2Client();

  oauth2Client.setCredentials({
    access_type: 'offline',
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: account.tokenExpiry ? new Date(account.tokenExpiry).getTime() : null,
  });

  // Listen for automatic token refresh events from googleapis
  oauth2Client.on('tokens', async (newTokens) => {
    try {
      account.setTokens({
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || refreshToken,
        expiryDate: newTokens.expiry_date,
      });
      await account.save();
      console.log(`[GmailService] 🔄 Refreshed tokens persisted for ${account.emailAddress}`);
    } catch (saveErr) {
      console.error('[GmailService] Failed to persist refreshed tokens:', saveErr.message);
    }
  });

  // Proactively refresh if the token is expired or close to expiring
  if (account.isTokenExpired() && refreshToken) {
    try {
      const refreshed = await oauth2Client.refreshAccessToken();
      const newTokens = refreshed.credentials;
      account.setTokens({
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || refreshToken,
        expiryDate: newTokens.expiry_date,
      });
      await account.save();
    } catch (refreshErr) {
      console.error('[GmailService] Token refresh failed:', refreshErr.message);
      if (
        refreshErr.message?.includes('invalid_grant') ||
        refreshErr.message?.includes('Token has been expired or revoked')
      ) {
        account.connectionStatus = 'revoked';
        await account.save();
        throw new AppError(
          'Gmail access was revoked by user or expired. Please re-authenticate.',
          401,
          'TOKEN_REVOKED',
        );
      }
      throw new AppError(
        `Failed to refresh Gmail token: ${refreshErr.message}`,
        500,
        'TOKEN_REFRESH_FAILED',
      );
    }
  }

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  return { gmail, account };
}

/**
 * Start or renew Gmail watch for Pub/Sub push notifications.
 *
 * @param {string|object} accountOrId
 * @returns {Promise<{ historyId: string, expiration: Date }>}
 */
export async function startGmailWatch(accountOrId) {
  const { gmail, account } = await getAuthenticatedGmailClient(accountOrId);

  if (!env.GOOGLE_PUBSUB_TOPIC) {
    throw new AppError(
      'GOOGLE_PUBSUB_TOPIC is not configured in .env (format: projects/<project-id>/topics/<topic-name>)',
      500,
      'CONFIG_ERROR',
    );
  }

  try {
    const res = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: env.GOOGLE_PUBSUB_TOPIC,
        labelIds: ['INBOX'],
      },
    });

    const { historyId, expiration } = res.data;
    const expirationDate = expiration ? new Date(parseInt(expiration, 10)) : new Date(Date.now() + 7 * 24 * 3600 * 1000);

    account.watchStatus = 'active';
    account.watchExpiration = expirationDate;
    if (historyId) account.lastHistoryId = historyId;
    account.lastSyncError = null;
    await account.save();

    console.log(
      `[GmailWatch] ✅ Watch registered for ${account.emailAddress} until ${expirationDate.toISOString()} (historyId: ${historyId})`,
    );

    return { historyId, expiration: expirationDate };
  } catch (err) {
    account.watchStatus = 'error';
    account.lastSyncError = err.message;
    await account.save();
    handleGmailApiError(err, 'startGmailWatch');
  }
}

/**
 * Stop Gmail push notification watch.
 *
 * @param {string|object} accountOrId
 */
export async function stopGmailWatch(accountOrId) {
  const { gmail, account } = await getAuthenticatedGmailClient(accountOrId);
  try {
    await gmail.users.stop({ userId: 'me' });
    account.watchStatus = 'inactive';
    account.watchExpiration = null;
    await account.save();
    console.log(`[GmailWatch] 🛑 Watch stopped for ${account.emailAddress}`);
  } catch (err) {
    handleGmailApiError(err, 'stopGmailWatch');
  }
}

/**
 * Retrieve user's live Gmail profile (message count, thread count, historyId).
 */
export async function getGmailProfile(account) {
  const { gmail } = await getAuthenticatedGmailClient(account);
  try {
    const res = await gmail.users.getProfile({ userId: 'me' });
    return res.data;
  } catch (err) {
    handleGmailApiError(err, 'getProfile');
  }
}

/**
 * Retrieve and parse full details for a single message.
 */
export async function getMessageDetails(account, messageId) {
  const { gmail } = await getAuthenticatedGmailClient(account);
  try {
    const res = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });
    return parseGmailMessage(res.data);
  } catch (err) {
    handleGmailApiError(err, `getMessageDetails(${messageId})`);
  }
}

/**
 * Manual initial sync of recent emails into MongoDB with distributed lock protection.
 */
export async function syncRecentEmails(accountOrId, userId, options = {}) {
  const { account } = await getAuthenticatedGmailClient(accountOrId);

  return withAccountLock(account._id, async () => {
    const { gmail } = await getAuthenticatedGmailClient(account._id);
    const targetLimit = Math.min(options.limit || 20, 100);

    const errors = [];
    let syncedCount = 0;
    let highestHistoryId = account.lastHistoryId || null;

    try {
      const listRes = await gmail.users.messages.list({
        userId: 'me',
        maxResults: targetLimit,
      });

      const messageList = listRes.data.messages || [];
      if (messageList.length === 0) {
        account.lastSyncedAt = new Date();
        account.lastSyncError = null;
        await account.save();
        return { totalFound: 0, syncedCount: 0, errors: [] };
      }

      for (const item of messageList) {
        try {
          const msgRes = await gmail.users.messages.get({
            userId: 'me',
            id: item.id,
            format: 'full',
          });

          const parsed = parseGmailMessage(msgRes.data);

          if (parsed.historyId) {
            if (!highestHistoryId || BigInt(parsed.historyId) > BigInt(highestHistoryId)) {
              highestHistoryId = parsed.historyId;
            }
          }

          const savedEmail = await Email.findOneAndUpdate(
            {
              accountId: account._id,
              gmailMessageId: parsed.gmailMessageId,
            },
            {
              $set: {
                ...parsed,
                accountId: account._id,
                userId: account.userId,
              },
            },
            { upsert: true, new: true },
          );

          // Enqueue for processing pipeline
          await enqueueEmailProcessing({
            emailId: savedEmail._id,
            gmailMessageId: parsed.gmailMessageId,
            accountId: account._id,
            userId: account.userId,
          });

          syncedCount += 1;
        } catch (itemErr) {
          errors.push(`Message ${item.id}: ${itemErr.message}`);
        }
      }

      account.lastSyncedAt = new Date();
      if (highestHistoryId) account.lastHistoryId = highestHistoryId;
      account.lastSyncError = errors.length > 0 ? errors.join('; ') : null;
      await account.save();

      return {
        totalFound: messageList.length,
        syncedCount,
        errors,
      };
    } catch (err) {
      account.lastSyncError = err.message;
      await account.save();
      handleGmailApiError(err, 'syncRecentEmails');
    }
  });
}

/**
 * Incrementally sync mailbox changes using users.history.list starting from lastHistoryId.
 * Handles:
 * - New messages added
 * - Label changes (added/removed)
 * - Deleted messages
 * - Expired/stale historyId recovery via full sync fallback
 * - Per-account distributed lock
 *
 * @param {string|object} accountOrId
 * @returns {Promise<{ addedCount: number, labelsUpdatedCount: number, deletedCount: number, newHistoryId: string }>}
 */
export async function syncHistoryChanges(accountOrId) {
  const { account } = await getAuthenticatedGmailClient(accountOrId);

  return withAccountLock(account._id, async () => {
    const { gmail } = await getAuthenticatedGmailClient(account._id);

    // If no starting historyId is known, run full initial sync
    if (!account.lastHistoryId) {
      console.log(`[GmailHistory] No starting historyId for ${account.emailAddress}, performing full sync...`);
      await syncRecentEmails(account._id, account.userId, { limit: 50 });
      return { addedCount: 0, labelsUpdatedCount: 0, deletedCount: 0, newHistoryId: account.lastHistoryId };
    }

    let pageToken = null;
    let addedCount = 0;
    let labelsUpdatedCount = 0;
    let deletedCount = 0;
    let newHistoryId = account.lastHistoryId;

    try {
      do {
        let historyRes;
        try {
          historyRes = await gmail.users.history.list({
            userId: 'me',
            startHistoryId: account.lastHistoryId,
            pageToken: pageToken || undefined,
            historyTypes: ['messageAdded', 'labelAdded', 'labelRemoved', 'messageDeleted'],
          });
        } catch (histErr) {
          // Check for stale/expired historyId (Google returns 404 or "History id is too old")
          if (
            histErr.code === 404 ||
            histErr.status === 404 ||
            histErr.message?.includes('historyId') ||
            histErr.message?.includes('too old')
          ) {
            console.warn(
              `[GmailHistory] ⚠️ Stale historyId (${account.lastHistoryId}) for ${account.emailAddress}. Running full resync...`,
            );
            await syncRecentEmails(account._id, account.userId, { limit: 50 });
            return { addedCount: 0, labelsUpdatedCount: 0, deletedCount: 0, newHistoryId: account.lastHistoryId };
          }
          throw histErr;
        }

        const historyRecords = historyRes.data.history || [];
        if (historyRes.data.historyId) {
          newHistoryId = historyRes.data.historyId;
        }

        for (const record of historyRecords) {
          // 1. Process Message Additions
          if (record.messagesAdded) {
            for (const item of record.messagesAdded) {
              if (!item.message?.id) continue;
              try {
                const msgRes = await gmail.users.messages.get({
                  userId: 'me',
                  id: item.message.id,
                  format: 'full',
                });
                const parsed = parseGmailMessage(msgRes.data);

                const savedEmail = await Email.findOneAndUpdate(
                  {
                    accountId: account._id,
                    gmailMessageId: parsed.gmailMessageId,
                  },
                  {
                    $set: {
                      ...parsed,
                      accountId: account._id,
                      userId: account.userId,
                      syncStatus: 'synced',
                    },
                  },
                  { upsert: true, new: true },
                );

                await enqueueEmailProcessing({
                  emailId: savedEmail._id,
                  gmailMessageId: parsed.gmailMessageId,
                  accountId: account._id,
                  userId: account.userId,
                });

                addedCount++;
              } catch (msgErr) {
                console.error(`[GmailHistory] Failed to ingest message ${item.message.id}:`, msgErr.message);
              }
            }
          }

          // 2. Process Label Additions
          if (record.labelsAdded) {
            for (const item of record.labelsAdded) {
              if (!item.message?.id) continue;
              await Email.updateOne(
                { accountId: account._id, gmailMessageId: item.message.id },
                {
                  $addToSet: { labels: { $each: item.labelIds || [] } },
                  $set: { syncStatus: 'updated' },
                },
              );
              labelsUpdatedCount++;
            }
          }

          // 3. Process Label Removals
          if (record.labelsRemoved) {
            for (const item of record.labelsRemoved) {
              if (!item.message?.id) continue;
              await Email.updateOne(
                { accountId: account._id, gmailMessageId: item.message.id },
                {
                  $pullAll: { labels: item.labelIds || [] },
                  $set: { syncStatus: 'updated' },
                },
              );
              labelsUpdatedCount++;
            }
          }

          // 4. Process Message Deletions
          if (record.messagesDeleted) {
            for (const item of record.messagesDeleted) {
              if (!item.message?.id) continue;
              await Email.updateOne(
                { accountId: account._id, gmailMessageId: item.message.id },
                { $set: { syncStatus: 'deleted' } },
              );
              deletedCount++;
            }
          }
        }

        pageToken = historyRes.data.nextPageToken || null;
      } while (pageToken);

      // Safe update: update account historyId and sync timestamp only after changes are handled
      account.lastHistoryId = newHistoryId;
      account.lastSyncedAt = new Date();
      account.lastSyncError = null;
      await account.save();

      console.log(
        `[GmailHistory] Synced changes for ${account.emailAddress}: +${addedCount} added, ~${labelsUpdatedCount} labels, -${deletedCount} deleted. (newHistoryId: ${newHistoryId})`,
      );

      return { addedCount, labelsUpdatedCount, deletedCount, newHistoryId };
    } catch (err) {
      account.lastSyncError = err.message;
      await account.save();
      handleGmailApiError(err, 'syncHistoryChanges');
    }
  });
}

/**
 * Scheduled reconciliation job:
 * - Scans all connected accounts
 * - Renews expiring watches (within 24 hours of expiration)
 * - Detects and pulls missed changes
 * - Recovers any failed sync states
 */
export async function reconcileAllAccounts() {
  console.log('[Reconciliation] 🔄 Starting periodic reconciliation scan...');
  const connectedAccounts = await EmailAccount.find({ connectionStatus: 'connected' });

  const summary = {
    totalAccounts: connectedAccounts.length,
    watchesRenewed: 0,
    changesSynced: 0,
    errors: [],
  };

  const now = Date.now();
  const renewalThreshold = 24 * 60 * 60 * 1000; // 24 hours before expiration

  for (const account of connectedAccounts) {
    try {
      // 1. Check if watch needs renewal (expired, expiring in <24h, or inactive)
      const expirationMs = account.watchExpiration ? new Date(account.watchExpiration).getTime() : 0;
      const needsRenewal =
        account.watchStatus !== 'active' || !account.watchExpiration || expirationMs - now < renewalThreshold;

      if (needsRenewal && env.GOOGLE_PUBSUB_TOPIC) {
        try {
          await startGmailWatch(account._id);
          summary.watchesRenewed++;
        } catch (watchErr) {
          console.warn(`[Reconciliation] Watch renewal failed for ${account.emailAddress}:`, watchErr.message);
        }
      }

      // 2. Reconcile history changes
      if (account.lastHistoryId) {
        const changes = await syncHistoryChanges(account._id);
        if (changes.addedCount > 0 || changes.labelsUpdatedCount > 0) {
          summary.changesSynced++;
        }
      } else {
        await syncRecentEmails(account._id, account.userId, { limit: 20 });
        summary.changesSynced++;
      }
    } catch (accountErr) {
      summary.errors.push(`${account.emailAddress}: ${accountErr.message}`);
      console.error(`[Reconciliation] Error reconciling ${account.emailAddress}:`, accountErr.message);
    }
  }

  console.log('[Reconciliation] ✅ Scan completed:', summary);
  return summary;
}

/**
 * Format Gmail API errors into user-friendly AppError instances.
 */
function handleGmailApiError(err, action) {
  console.error(`[GmailService] Error during ${action}:`, err.message);

  if (err.code === 401 || err.status === 401) {
    throw new AppError('Gmail authorization expired. Please log in again.', 401, 'GMAIL_UNAUTHORIZED');
  }
  if (err.code === 403 || err.status === 403) {
    if (err.message?.includes('Rate Limit Exceeded')) {
      throw new AppError('Gmail API rate limit reached. Please try again shortly.', 429, 'GMAIL_RATE_LIMIT');
    }
    throw new AppError(
      `Gmail access forbidden: ensure Gmail API is enabled and scopes are granted (${err.message})`,
      403,
      'GMAIL_FORBIDDEN',
    );
  }
  if (err.code === 404 || err.status === 404) {
    throw new AppError('Requested Gmail resource not found.', 404, 'GMAIL_NOT_FOUND');
  }

  throw new AppError(`Gmail API error (${action}): ${err.message}`, 502, 'GMAIL_API_ERROR');
}

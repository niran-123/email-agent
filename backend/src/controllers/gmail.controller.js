// backend/src/controllers/gmail.controller.js
// Gmail endpoints: status, profile, sync, email listing, and disconnect.

import { EmailAccount } from '../models/emailAccount.model.js';
import { Email } from '../models/email.model.js';
import {
  getGmailProfile,
  syncRecentEmails,
  startGmailWatch,
  stopGmailWatch,
} from '../services/gmail.service.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Helper to get the user's active connected EmailAccount.
 * Ensures strict multi-tenant isolation: account MUST belong to req.user._id.
 */
async function getUserEmailAccount(userId, accountId = null) {
  const query = { userId };
  if (accountId) query._id = accountId;

  const account = await EmailAccount.findOne(query);
  if (!account) {
    throw new AppError('No connected Gmail account found for this user.', 404, 'ACCOUNT_NOT_FOUND');
  }
  return account;
}

/**
 * GET /api/gmail/status
 * Returns connection status and summary of synced emails.
 */
export async function getGmailStatus(req, res, next) {
  try {
    const account = await getUserEmailAccount(req.user._id, req.query.accountId);
    const emailCount = await Email.countDocuments({ accountId: account._id });

    res.status(200).json({
      success: true,
      data: {
        accountId: account._id,
        emailAddress: account.emailAddress,
        provider: account.provider,
        connectionStatus: account.connectionStatus,
        lastSyncedAt: account.lastSyncedAt,
        lastHistoryId: account.lastHistoryId,
        scopes: account.scopes,
        storedEmailsCount: emailCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/gmail/profile
 * Retrieves live mailbox profile from Gmail API.
 */
export async function getProfile(req, res, next) {
  try {
    const account = await getUserEmailAccount(req.user._id, req.query.accountId);
    const profile = await getGmailProfile(account);

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/gmail/sync
 * Manually trigger recent email sync.
 */
export async function syncEmails(req, res, next) {
  try {
    const account = await getUserEmailAccount(req.user._id, req.body.accountId || req.query.accountId);
    const limit = parseInt(req.body.limit || req.query.limit || '20', 10);

    const result = await syncRecentEmails(account, req.user._id, { limit });

    res.status(200).json({
      success: true,
      message: `Successfully synced ${result.syncedCount} of ${result.totalFound} messages.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/gmail/emails
 * Retrieve list of synced emails stored in DB for the user.
 */
export async function getSyncedEmails(req, res, next) {
  try {
    const account = await getUserEmailAccount(req.user._id, req.query.accountId);
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 50);

    const query = { accountId: account._id };
    if (req.query.q) {
      query.$or = [
        { subject: { $regex: req.query.q, $options: 'i' } },
        { snippet: { $regex: req.query.q, $options: 'i' } },
        { 'from.email': { $regex: req.query.q, $options: 'i' } },
      ];
    }

    const [total, emails] = await Promise.all([
      Email.countDocuments(query),
      Email.find(query)
        .sort({ receivedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-bodyHtml'), // Exclude heavy HTML by default for list view
    ]);

    res.status(200).json({
      success: true,
      data: emails,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/gmail/watch/start
 * Starts Pub/Sub push notification subscription for the connected account.
 */
export async function startWatch(req, res, next) {
  try {
    const account = await getUserEmailAccount(req.user._id, req.body.accountId || req.query.accountId);
    const result = await startGmailWatch(account._id);

    res.status(200).json({
      success: true,
      message: `Gmail watch successfully activated for ${account.emailAddress}`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/gmail/watch/renew
 * Renews Pub/Sub push notification subscription.
 */
export async function renewWatch(req, res, next) {
  try {
    const account = await getUserEmailAccount(req.user._id, req.body.accountId || req.query.accountId);
    const result = await startGmailWatch(account._id);

    res.status(200).json({
      success: true,
      message: `Gmail watch successfully renewed for ${account.emailAddress}`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/gmail/sync/status
 * Returns detailed sync and watch diagnostics.
 */
export async function getSyncStatus(req, res, next) {
  try {
    const account = await getUserEmailAccount(req.user._id, req.query.accountId);

    const [totalStored, pendingCount, completedCount, failedCount] = await Promise.all([
      Email.countDocuments({ accountId: account._id }),
      Email.countDocuments({ accountId: account._id, processingStatus: 'pending' }),
      Email.countDocuments({ accountId: account._id, processingStatus: 'completed' }),
      Email.countDocuments({ accountId: account._id, processingStatus: 'failed' }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        accountId: account._id,
        emailAddress: account.emailAddress,
        connectionStatus: account.connectionStatus,
        watchStatus: account.watchStatus,
        watchExpiration: account.watchExpiration,
        lastHistoryId: account.lastHistoryId,
        lastSyncedAt: account.lastSyncedAt,
        syncInProgress: account.syncInProgress,
        lastSyncError: account.lastSyncError,
        statistics: {
          totalStored,
          pendingCount,
          completedCount,
          failedCount,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/gmail/disconnect
 * Disconnects the user's Gmail connection and updates status.
 */
export async function disconnectGmail(req, res, next) {
  try {
    const account = await getUserEmailAccount(req.user._id, req.body.accountId || req.query.accountId);

    // Stop active watch if configured
    try {
      await stopGmailWatch(account._id);
    } catch (watchErr) {
      console.warn('[GmailController] Stop watch on disconnect warning:', watchErr.message);
    }

    account.connectionStatus = 'disconnected';
    account.watchStatus = 'inactive';
    account.watchExpiration = null;
    account.encryptedAccessToken = null;
    account.encryptedRefreshToken = null;
    await account.save();

    res.status(200).json({
      success: true,
      message: `Disconnected Gmail account (${account.emailAddress}) successfully.`,
    });
  } catch (err) {
    next(err);
  }
}


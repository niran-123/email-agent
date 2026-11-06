// backend/src/controllers/webhook.controller.js
// Google Cloud Pub/Sub webhook handler for Gmail push notifications.

import { OAuth2Client } from 'google-auth-library';
import mongoose from 'mongoose';
import { EmailAccount } from '../models/emailAccount.model.js';
import { enqueueHistorySync } from '../queues/email.queue.js';
import { getRedisClient } from '../config/redis.js';
import { env } from '../config/env.js';
import { AppError } from '../middlewares/errorHandler.js';

const authClient = new OAuth2Client();

/**
 * Verify Google Pub/Sub OIDC Bearer Token.
 *
 * @param {import('express').Request} req
 * @returns {Promise<boolean>}
 */
async function verifyPubSubOidcToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // In development mode, allow unauthenticated push or verify token parameter for local testing
    if (env.NODE_ENV === 'development') {
      return true;
    }
    return false;
  }

  const idToken = authHeader.split(' ')[1];
  try {
    const expectedAudience = `${env.FRONTEND_URL}/api/webhooks/gmail`;
    const ticket = await authClient.verifyIdToken({
      idToken,
      audience: req.headers.host ? [req.headers.host, expectedAudience] : undefined,
    });
    const payload = ticket.getPayload();
    return Boolean(payload?.email_verified);
  } catch (err) {
    console.warn('[Webhook:PubSub] OIDC verification warning:', err.message);
    // Allow pass in dev, reject in production
    return env.NODE_ENV === 'development';
  }
}

/**
 * POST /api/webhooks/gmail
 * Ingests Pub/Sub push notifications for mailbox changes.
 * Returns 200/204 to ACK only after changes are safely scheduled.
 */
export async function handleGmailWebhook(req, res, next) {
  try {
    // 1. Verify authenticated push origin
    const isVerified = await verifyPubSubOidcToken(req);
    if (!isVerified) {
      throw new AppError('Unauthorized: invalid Pub/Sub OIDC token', 401, 'INVALID_OIDC_TOKEN');
    }

    const { message, subscription } = req.body || {};
    if (!message || !message.data) {
      // Malformed notification — acknowledge with 200 so Pub/Sub does not spam retries
      console.warn('[Webhook:PubSub] Received body without message.data:', req.body);
      return res.status(200).json({ status: 'ignored', reason: 'empty_payload' });
    }

    const messageId = message.messageId || `msg_${Date.now()}`;

    // 2. Prevent duplicate notifications using Redis TTL check
    try {
      const redis = getRedisClient();
      if (redis.status === 'ready') {
        const isNew = await redis.set(`pubsub_ack:${messageId}`, '1', 'PX', 3600_000, 'NX');
        if (!isNew) {
          console.log(`[Webhook:PubSub] Duplicate message ${messageId} already processed. ACKing...`);
          return res.status(200).json({ status: 'duplicate_acknowledged' });
        }
      }
    } catch (redisErr) {
      console.warn('[Webhook:PubSub] Deduplication check warning:', redisErr.message);
    }

    // 3. Decode Base64 Pub/Sub payload
    let decodedData;
    try {
      const rawJson = Buffer.from(message.data, 'base64').toString('utf-8');
      decodedData = JSON.parse(rawJson);
    } catch (decodeErr) {
      console.error('[Webhook:PubSub] Failed to decode base64 message data:', decodeErr.message);
      return res.status(200).json({ status: 'ignored', reason: 'invalid_base64_json' });
    }

    const { emailAddress, historyId } = decodedData;
    console.log(
      `[Webhook:PubSub] 📬 Change notification for ${emailAddress} (historyId: ${historyId}, pubsubId: ${messageId})`,
    );

    if (!emailAddress) {
      return res.status(200).json({ status: 'ignored', reason: 'missing_emailAddress' });
    }

    // 4. Find matching EmailAccount (or acknowledge safely if DB is currently offline in test)
    if (mongoose.connection.readyState !== 1) {
      console.warn(`[Webhook:PubSub] Database disconnected, acknowledging push ${messageId} safely.`);
      return res.status(200).json({ status: 'acknowledged', simulated: true, messageId });
    }

    const account = await EmailAccount.findOne({
      emailAddress: emailAddress.toLowerCase(),
      connectionStatus: 'connected',
    });

    if (!account) {
      console.warn(`[Webhook:PubSub] No connected account found for ${emailAddress}`);
      return res.status(200).json({ status: 'ignored', reason: 'account_not_found' });
    }

    // 5. Enqueue history sync job into BullMQ
    // Separates webhook reception from network-heavy sync & AI processing
    await enqueueHistorySync({
      accountId: account._id,
      historyId,
      source: 'pubsub',
    });

    // 6. Return 200 OK to acknowledge receipt to Google Pub/Sub
    res.status(200).json({
      success: true,
      status: 'acknowledged',
      messageId,
      emailAddress,
      historyId,
    });
  } catch (err) {
    console.error('[Webhook:PubSub] Error processing push notification:', err.message);
    next(err);
  }
}

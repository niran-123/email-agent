// backend/src/queues/email.queue.js
// BullMQ queue definitions for email synchronization and processing.

import { Queue } from 'bullmq';
import { createBullMQConnection } from '../config/redis.js';

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 3_000,
  },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 1_000 },
};

/**
 * Queue for mailbox synchronization (initial sync, Pub/Sub history changes, and periodic reconciliation).
 */
export const emailSyncQueue = new Queue('email-sync', {
  connection: createBullMQConnection(),
  defaultJobOptions,
});

/**
 * Queue for email analysis and AI triage pipeline (Phase 4).
 * Separates message discovery from computationally expensive analysis.
 */
export const emailProcessQueue = new Queue('email-process', {
  connection: createBullMQConnection(),
  defaultJobOptions,
});

/**
 * Enqueue a history synchronization job with stable deduplication job ID.
 *
 * @param {object} params
 * @param {string} params.accountId
 * @param {string} params.historyId
 * @param {'pubsub'|'reconciliation'|'manual'} [params.source='pubsub']
 */
export async function enqueueHistorySync({ accountId, historyId, source = 'pubsub' }) {
  // Stable job ID ensures duplicate notifications for the same historyId are not queued twice
  const jobId = `sync:${accountId.toString()}:${historyId}`;

  return emailSyncQueue.add(
    'SYNC_HISTORY',
    {
      accountId: accountId.toString(),
      historyId,
      source,
      enqueuedAt: new Date().toISOString(),
    },
    {
      jobId,
      // If a job with this ID is already waiting or active, BullMQ ignores duplicate adds
    },
  );
}

/**
 * Enqueue a full mailbox sync job.
 *
 * @param {object} params
 * @param {string} params.accountId
 * @param {string} params.userId
 * @param {number} [params.limit=50]
 * @param {'initial'|'stale_recovery'|'manual'} [params.source='manual']
 */
export async function enqueueFullSync({ accountId, userId, limit = 50, source = 'manual' }) {
  const jobId = `full-sync:${accountId.toString()}:${Date.now()}`;

  return emailSyncQueue.add(
    'SYNC_FULL',
    {
      accountId: accountId.toString(),
      userId: userId.toString(),
      limit,
      source,
      enqueuedAt: new Date().toISOString(),
    },
    { jobId },
  );
}

/**
 * Enqueue a single email for pipeline processing.
 *
 * @param {object} params
 * @param {string} params.emailId
 * @param {string} params.gmailMessageId
 * @param {string} params.accountId
 * @param {string} params.userId
 */
export async function enqueueEmailProcessing({ emailId, gmailMessageId, accountId, userId }) {
  const jobId = `process:${gmailMessageId}`;

  return emailProcessQueue.add(
    'PROCESS_EMAIL',
    {
      emailId: emailId.toString(),
      gmailMessageId,
      accountId: accountId.toString(),
      userId: userId.toString(),
      enqueuedAt: new Date().toISOString(),
    },
    { jobId },
  );
}


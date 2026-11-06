// backend/src/workers/email.worker.js
// BullMQ worker for asynchronous email synchronization and processing jobs.

import { Worker } from 'bullmq';
import { createBullMQConnection } from '../config/redis.js';
import { syncHistoryChanges, syncRecentEmails } from '../services/gmail.service.js';
import { processEmailAnalysis } from '../services/emailProcessing.service.js';
import { Email } from '../models/email.model.js';

let syncWorker = null;
let processWorker = null;

/**
 * Start the email sync and processing workers.
 */
export function startEmailWorkers() {
  if (syncWorker) return { syncWorker, processWorker };

  console.log('[Workers] ⚙️ Starting BullMQ email workers...');

  // ── Worker 1: Mailbox Synchronization ────────────────────────────────────────
  syncWorker = new Worker(
    'email-sync',
    async (job) => {
      const { name, data } = job;
      console.log(`[Worker:Sync] Processing job ${job.id} (${name}) for account ${data.accountId}`);

      if (name === 'SYNC_HISTORY') {
        const result = await syncHistoryChanges(data.accountId);
        return { success: true, ...result };
      }

      if (name === 'SYNC_FULL') {
        const result = await syncRecentEmails(data.accountId, data.userId, { limit: data.limit });
        return { success: true, ...result };
      }

      throw new Error(`Unknown sync job name: ${name}`);
    },
    {
      connection: createBullMQConnection(),
      concurrency: 5,
    },
  );

  syncWorker.on('completed', (job, result) => {
    console.log(`[Worker:Sync] ✅ Job ${job.id} completed:`, result);
  });

  syncWorker.on('failed', (job, err) => {
    console.error(`[Worker:Sync] ❌ Job ${job?.id} failed (${err.message})`);
  });

  // ── Worker 2: Email Discovery & AI Analysis Pipeline (Phase 4) ─────────────
  processWorker = new Worker(
    'email-process',
    async (job) => {
      const { emailId, gmailMessageId } = job.data;
      console.log(`[Worker:Process] Running AI analysis for email ${gmailMessageId} (${emailId})...`);

      const result = await processEmailAnalysis(emailId);

      return {
        success: true,
        emailId,
        gmailMessageId,
        priority: result.summary.priority,
        category: result.summary.category,
        actionCount: result.actionItems.length,
      };
    },
    {
      connection: createBullMQConnection(),
      concurrency: 5,
    },
  );

  processWorker.on('completed', (job) => {
    console.log(`[Worker:Process] ✅ Email ingestion job ${job.id} completed`);
  });

  processWorker.on('failed', (job, err) => {
    console.error(`[Worker:Process] ❌ Email ingestion job ${job?.id} failed:`, err.message);
  });

  return { syncWorker, processWorker };
}

/**
 * Gracefully stop the workers.
 */
export async function stopEmailWorkers() {
  if (syncWorker) {
    await syncWorker.close();
    syncWorker = null;
  }
  if (processWorker) {
    await processWorker.close();
    processWorker = null;
  }
  console.log('[Workers] 🛑 BullMQ email workers stopped.');
}


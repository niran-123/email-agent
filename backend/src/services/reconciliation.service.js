// backend/src/services/reconciliation.service.js
// Scheduled reconciliation service for Gmail watch renewal and missed change recovery.

import { reconcileAllAccounts } from './gmail.service.js';

let intervalHandle = null;

/**
 * Start periodic reconciliation and watch renewal scheduler.
 * Runs once immediately on startup, then periodically (default: every 60 minutes).
 *
 * @param {number} [intervalMinutes=60]
 */
export function startReconciliationScheduler(intervalMinutes = 60) {
  if (intervalHandle) {
    console.log('[Scheduler] Reconciliation scheduler is already active.');
    return;
  }

  const intervalMs = Math.max(intervalMinutes, 5) * 60 * 1000;
  console.log(`[Scheduler] ⏱️ Initializing reconciliation loop (every ${intervalMinutes} minutes)...`);

  // Initial trigger after 30 seconds to allow services to warm up
  setTimeout(async () => {
    try {
      await reconcileAllAccounts();
    } catch (err) {
      console.error('[Scheduler] Initial reconciliation run failed:', err.message);
    }
  }, 30_000);

  // Periodic recurring timer
  intervalHandle = setInterval(async () => {
    try {
      await reconcileAllAccounts();
    } catch (err) {
      console.error('[Scheduler] Periodic reconciliation error:', err.message);
    }
  }, intervalMs);
}

/**
 * Stop the reconciliation scheduler.
 */
export function stopReconciliationScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[Scheduler] 🛑 Reconciliation scheduler stopped.');
  }
}


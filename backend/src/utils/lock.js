// backend/src/utils/lock.js
// Distributed and in-memory locking to prevent overlapping sync/reconciliation jobs.

import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import { getRedisClient } from '../config/redis.js';
import { EmailAccount } from '../models/emailAccount.model.js';
import { AppError } from '../middlewares/errorHandler.js';

const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

// In-memory lock registry (fallback for local process synchronization & tests)
const memoryLocks = new Map();

/**
 * Acquire a lock for an account ID.
 *
 * @param {string} accountId
 * @param {number} [ttlMs=120000] - 2 minutes default lock TTL
 * @returns {Promise<string|null>} lockId if acquired, null if already locked
 */
export async function acquireAccountLock(accountId, ttlMs = 120_000) {
  const lockKey = `lock:sync:${accountId.toString()}`;
  const lockId = uuidv4();
  const now = Date.now();

  // 1. Try Redis distributed lock first if Redis is online
  try {
    const redis = getRedisClient();
    if (redis.status === 'ready') {
      const result = await redis.set(lockKey, lockId, 'PX', ttlMs, 'NX');
      if (result === 'OK') {
        return lockId;
      }
      return null; // Already locked in Redis
    }
  } catch (err) {
    console.warn('[Lock] Redis acquire warning:', err.message);
  }

  // 2. In-memory locking
  const existingLock = memoryLocks.get(lockKey);
  if (existingLock && existingLock.expiresAt > now) {
    return null; // Already locked in memory
  }

  memoryLocks.set(lockKey, {
    lockId,
    expiresAt: now + ttlMs,
  });

  // 3. If MongoDB is actively connected, atomically set syncInProgress flag in DB
  if (mongoose.connection.readyState === 1) {
    try {
      await EmailAccount.findByIdAndUpdate(accountId, { $set: { syncInProgress: true } });
    } catch (dbErr) {
      console.warn('[Lock] DB syncInProgress update warning:', dbErr.message);
    }
  }

  return lockId;
}

/**
 * Release a previously acquired lock.
 *
 * @param {string} accountId
 * @param {string} lockId
 */
export async function releaseAccountLock(accountId, lockId) {
  const lockKey = `lock:sync:${accountId.toString()}`;

  // 1. Release Redis lock safely via Lua script
  try {
    const redis = getRedisClient();
    if (redis.status === 'ready') {
      await redis.eval(RELEASE_LOCK_LUA, 1, lockKey, lockId);
    }
  } catch (err) {
    console.warn('[Lock] Redis release warning:', err.message);
  }

  // 2. Release in-memory lock
  const mem = memoryLocks.get(lockKey);
  if (mem && mem.lockId === lockId) {
    memoryLocks.delete(lockKey);
  }

  // 3. Reset MongoDB flag if connected
  if (mongoose.connection.readyState === 1) {
    try {
      await EmailAccount.findByIdAndUpdate(accountId, { $set: { syncInProgress: false } });
    } catch (err) {
      console.error('[Lock] Failed to reset syncInProgress in DB:', err.message);
    }
  }
}

/**
 * Higher-order helper to execute a task under an account lock.
 *
 * @param {string} accountId
 * @param {() => Promise<T>} task
 * @param {number} [ttlMs=120000]
 * @returns {Promise<T>}
 */
export async function withAccountLock(accountId, task, ttlMs = 120_000) {
  const lockId = await acquireAccountLock(accountId, ttlMs);
  if (!lockId) {
    throw new AppError(
      `A sync job is already in progress for account ${accountId}. Please wait for it to complete.`,
      409,
      'SYNC_IN_PROGRESS',
    );
  }

  try {
    return await task();
  } finally {
    await releaseAccountLock(accountId, lockId);
  }
}

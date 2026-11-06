// backend/src/config/redis.js
// Shared ioredis connection factory.
// BullMQ requires separate connection instances for queue producers and workers.

import Redis from 'ioredis';
import { env } from './env.js';

/** Parsed Redis connection options derived from REDIS_URL */
function buildRedisOptions(customOptions = {}) {
  return {
    retryStrategy(times) {
      if (times > 10 && env.NODE_ENV === 'development') {
        // Stop spamming reconnect attempts in development if Redis isn't running
        return null;
      }
      const delay = Math.min(times * 1000, 30_000);
      return delay;
    },
    enableReadyCheck: true,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    ...customOptions,
  };
}

/** Singleton default Redis client (for caching / general use). */
let _defaultClient = null;

export function getRedisClient() {
  if (_defaultClient) return _defaultClient;

  _defaultClient = new Redis(env.REDIS_URL, buildRedisOptions());

  _defaultClient.on('connect', () => console.log('[Redis] ✅ Connected'));
  _defaultClient.on('ready', () => console.log('[Redis] 🟢 Ready'));
  _defaultClient.on('error', (err) => {
    // Only log first-time or relevant errors to prevent flooding dev console
    if (err.code === 'ECONNREFUSED') {
      // Quiet log for dev when Redis service is not yet running
      return;
    }
    console.error('[Redis] ❌ Error:', err.message);
  });
  _defaultClient.on('close', () => console.warn('[Redis] 🔴 Connection closed'));

  return _defaultClient;
}

/**
 * Create a fresh Redis connection suitable for BullMQ workers/queues.
 * BullMQ requires that worker connections have maxRetriesPerRequest=null.
 */
export function createBullMQConnection() {
  return new Redis(
    env.REDIS_URL,
    buildRedisOptions({
      maxRetriesPerRequest: null,
      lazyConnect: false,
    }),
  );
}

/** Returns a string status suitable for health checks. */
export async function getRedisStatus() {
  const client = getRedisClient();
  if (client.status !== 'ready') {
    return client.status === 'connecting' || client.status === 'reconnecting'
      ? 'connecting'
      : 'disconnected';
  }

  try {
    const pong = await Promise.race([
      client.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
    ]);
    return pong === 'PONG' ? 'connected' : 'degraded';
  } catch {
    return 'disconnected';
  }
}

/** Gracefully quit the default Redis client. */
export async function disconnectRedis() {
  if (_defaultClient) {
    await _defaultClient.quit();
    _defaultClient = null;
    console.log('[Redis] 🔌 Disconnected.');
  }
}


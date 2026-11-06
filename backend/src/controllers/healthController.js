// backend/src/controllers/healthController.js
// GET /api/health — returns application, DB, and Redis status.

import { getDatabaseStatus } from '../config/database.js';
import { getRedisStatus } from '../config/redis.js';
import { env } from '../config/env.js';

export async function healthCheck(req, res) {
  const [dbStatus, redisStatus] = await Promise.all([
    Promise.resolve(getDatabaseStatus()),
    getRedisStatus(),
  ]);

  const allHealthy = dbStatus === 'connected' && redisStatus === 'connected';
  const httpStatus = allHealthy ? 200 : 503;

  res.status(httpStatus).json({
    success: allHealthy,
    status: allHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: env.NODE_ENV,
    services: {
      database: dbStatus,
      redis: redisStatus,
    },
  });
}


// backend/src/server.js
// Application entry point — connects to services and starts the HTTP server.

import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { getRedisClient, disconnectRedis } from './config/redis.js';
import { startEmailWorkers, stopEmailWorkers } from './workers/email.worker.js';
import { startReconciliationScheduler, stopReconciliationScheduler } from './services/reconciliation.service.js';
import app from './app.js';

async function bootstrap() {
  console.log(`\n🚀  MailMind AI — Starting in ${env.NODE_ENV} mode…\n`);

  // ── Connect to MongoDB ───────────────────────────────────────────────────────
  await connectDatabase();

  // ── Connect to Redis (warm up the shared client) ─────────────────────────────
  const redis = getRedisClient();
  redis.connect().catch(() => {});

  // ── Start BullMQ Workers & Reconciliation Scheduler ─────────────────────────
  startEmailWorkers();
  startReconciliationScheduler(60);

  // ── Start HTTP server ────────────────────────────────────────────────────────
  const server = app.listen(env.PORT, () => {
    console.log(`\n✅  Server listening on http://localhost:${env.PORT}`);
    console.log(`    Health → http://localhost:${env.PORT}/api/health\n`);
  });

  // ── Graceful shutdown ────────────────────────────────────────────────────────
  const shutdown = async (signal) => {
    console.log(`\n[Server] Received ${signal}. Shutting down gracefully…`);

    stopReconciliationScheduler();
    await stopEmailWorkers();

    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      await disconnectDatabase();
      await disconnectRedis();
      console.log('[Server] Goodbye. 👋');
      process.exit(0);
    });
      console.log('[Server] HTTP server closed.');
      await disconnectDatabase();
      await disconnectRedis();
      console.log('[Server] Goodbye. 👋');
      process.exit(0);
    });

    // Force exit after 15 s
    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout.');
      process.exit(1);
    }, 15_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors — log and exit so the process manager can restart
  process.on('unhandledRejection', (reason) => {
    console.error('[Server] Unhandled rejection:', reason);
    if (env.NODE_ENV === 'production') process.exit(1);
  });

  process.on('uncaughtException', (err) => {
    console.error('[Server] Uncaught exception:', err);
    process.exit(1);
  });
}

bootstrap();


// backend/src/workers/index.js
// Standalone background worker process entry point for BullMQ.

import { env } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { disconnectRedis } from '../config/redis.js';
import { startEmailWorkers, stopEmailWorkers } from './email.worker.js';

async function bootstrapWorkers() {
  console.log(`\n🚀  MailMind Workers — Starting in ${env.NODE_ENV} mode…\n`);

  await connectDatabase();
  startEmailWorkers();

  console.log('✅  Workers are listening for email sync and processing jobs.\n');

  const shutdown = async (signal) => {
    console.log(`\n[Workers] Received ${signal}. Shutting down worker process...`);
    await stopEmailWorkers();
    await disconnectDatabase();
    await disconnectRedis();
    console.log('[Workers] Workers stopped gracefully. 👋');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrapWorkers();

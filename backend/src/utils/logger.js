// backend/src/utils/logger.js
// Minimal structured logger for the backend.
// Replace with winston/pino in production as needed.

import { env } from '../config/env.js';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = env.NODE_ENV === 'production' ? 2 : 3; // info in prod, debug in dev

function log(level, message, meta) {
  if (LEVELS[level] > currentLevel) return;

  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta && { meta }),
  };

  const output = env.NODE_ENV === 'production'
    ? JSON.stringify(entry)
    : `[${entry.timestamp}] [${level.toUpperCase()}] ${message}${meta ? ' ' + JSON.stringify(meta) : ''}`;

  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  error: (msg, meta) => log('error', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
};


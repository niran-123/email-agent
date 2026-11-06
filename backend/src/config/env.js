// backend/src/config/env.js
// Centralised environment variable validation and export.
// Import this module once (in server.js) to ensure dotenv is loaded first.

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Attempt loading from backend directory or current working directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // fallback to cwd .env if present

const required = [
  'MONGODB_URI',
  'REDIS_URL',
  'JWT_SECRET',
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`[ENV] Missing required environment variables: ${missing.join(', ')}`);
  // In production, exit immediately.  During development warn and continue.
  if (process.env.NODE_ENV === 'production') process.exit(1);
}

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  MONGODB_URI: process.env.MONGODB_URI || '',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  JWT_SECRET: process.env.JWT_SECRET || 'dev_jwt_secret',
  SESSION_SECRET: process.env.SESSION_SECRET || 'dev_session_secret',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '',

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || '',
  GOOGLE_PUBSUB_TOPIC: process.env.GOOGLE_PUBSUB_TOPIC || '',

  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',

  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || '',
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || '',
  WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION || 'v20.0',
};

export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';


// backend/src/config/database.js
// Mongoose connection — single shared instance.

import mongoose from 'mongoose';
import { env } from './env.js';

const MONGOOSE_OPTIONS = {
  // Connection pool size
  maxPoolSize: 10,
  minPoolSize: 2,
  // Timeout settings
  serverSelectionTimeoutMS: 10_000,
  socketTimeoutMS: 45_000,
  connectTimeoutMS: 10_000,
  // Heartbeat
  heartbeatFrequencyMS: 10_000,
};

/** Connect to MongoDB Atlas. Call once during server startup. */
export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    console.log('[DB] Already connected to MongoDB.');
    return;
  }

  if (!env.MONGODB_URI || env.MONGODB_URI.includes('USERNAME:PASSWORD')) {
    console.warn('[DB] ⚠️ Placeholder or empty MONGODB_URI detected. Update MONGODB_URI in .env with real credentials.');
    return;
  }

  try {
    await mongoose.connect(env.MONGODB_URI, MONGOOSE_OPTIONS);
    console.log(`[DB] ✅ Connected to MongoDB (${mongoose.connection.host})`);
  } catch (err) {
    console.error('[DB] ❌ MongoDB connection failed:', err.message);
    if (env.NODE_ENV === 'production') process.exit(1);
    // In development, resolve anyway so the server can still start
    // and other health probes can report the DB as down.
  }
}

/** Gracefully close the Mongoose connection. */
export async function disconnectDatabase() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.connection.close();
  console.log('[DB] 🔌 Disconnected from MongoDB.');
}

/** Returns a human-readable DB status string suitable for health checks. */
export function getDatabaseStatus() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
    99: 'uninitialized',
  };
  return states[mongoose.connection.readyState] ?? 'unknown';
}

// --- Mongoose model conventions ---
// All models live in backend/src/models/<ModelName>.model.js.
// Every model should include:
//   - createdAt / updatedAt via { timestamps: true }
//   - Explicit index definitions
//   - JSDoc types for IDE support
// Example:
//   import mongoose from 'mongoose';
//   const schema = new mongoose.Schema({ ... }, { timestamps: true });
//   export const MyModel = mongoose.model('MyModel', schema);

export default mongoose;


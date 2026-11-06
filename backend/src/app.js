// backend/src/app.js
// Express application factory — no server.listen() here.
// Import and use this in server.js so integration tests can import it cleanly.

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { env } from './config/env.js';
import { requestIdMiddleware, requestLogger } from './middlewares/requestLogger.js';
import { defaultLimiter } from './middlewares/rateLimiter.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.js';
import apiRoutes from './routes/index.js';

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  }),
);

// ── Body / Cookie parsing ─────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());

// ── Request logging & IDs ─────────────────────────────────────────────────────
app.use(requestIdMiddleware);
app.use(requestLogger);

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use('/api', defaultLimiter);

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api', apiRoutes);

// ── 404 & Error handling ──────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;


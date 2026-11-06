// backend/src/middlewares/errorHandler.js
// Centralised Express error handler — must be the LAST middleware registered.

import { env } from '../config/env.js';

/**
 * Operational error class — throw these for expected failure paths.
 * They are forwarded to the client with their HTTP status code.
 */
export class AppError extends Error {
  /**
   * @param {string} message  Human-readable error description.
   * @param {number} statusCode  HTTP status code (default 500).
   * @param {string} [code]  Optional machine-readable error code.
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** 404 handler — register before errorHandler. */
export function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

/** Global error handler middleware. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const isOperational = err.isOperational === true;

  // Always log the full error server-side
  if (statusCode >= 500) {
    console.error(`[Error] ${req.method} ${req.originalUrl}`, err);
  } else {
    console.warn(`[Warn] ${req.method} ${req.originalUrl} → ${statusCode} ${err.message}`);
  }

  const payload = {
    success: false,
    error: {
      message: isOperational ? err.message : 'An unexpected error occurred.',
      code: err.code || 'INTERNAL_ERROR',
    },
  };

  // Include stack trace in development only
  if (env.NODE_ENV === 'development' && err.stack) {
    payload.error.stack = err.stack;
  }

  res.status(statusCode).json(payload);
}


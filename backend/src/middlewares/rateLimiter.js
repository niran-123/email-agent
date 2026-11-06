// backend/src/middlewares/rateLimiter.js
// Express rate-limiting with express-rate-limit.

import rateLimit from 'express-rate-limit';

/** Default limiter — 100 requests per minute per IP */
export const defaultLimiter = rateLimit({
  windowMs: 60 * 1_000, // 1 minute
  max: 100,
  standardHeaders: true,  // Return rate-limit info in `RateLimit-*` headers
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
});

/** Stricter limiter for auth endpoints — 10 requests per 15 minutes */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many authentication attempts, please try again later.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
    },
  },
});


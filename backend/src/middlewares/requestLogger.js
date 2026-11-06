// backend/src/middlewares/requestLogger.js
// HTTP request logger using morgan, with custom token for request ID.

import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';

// Attach a unique request ID to every incoming request
export function requestIdMiddleware(req, res, next) {
  req.id = uuidv4();
  res.setHeader('X-Request-Id', req.id);
  next();
}

// Morgan token for the request ID
morgan.token('id', (req) => req.id);

// Use 'dev' format in development; structured JSON-ish in production
const format =
  env.NODE_ENV === 'development'
    ? ':id :method :url :status :response-time ms'
    : ':id :remote-addr :method :url :status :res[content-length] :response-time ms';

export const requestLogger = morgan(format, {
  skip: (req) => req.path === '/api/health', // Don't log health-check spam
});


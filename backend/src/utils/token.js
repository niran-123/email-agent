// backend/src/utils/token.js
// JWT creation and verification.

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const JWT_EXPIRES_IN = '7d';

/**
 * Sign a JWT for an authenticated user.
 * @param {{ _id: string, email: string, name?: string }} user
 * @returns {string}
 */
export function signJwtToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
    },
    env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

/**
 * Verify a JWT string.
 * @param {string} token
 * @returns {{ userId: string, email: string, iat: number, exp: number }}
 */
export function verifyJwtToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}


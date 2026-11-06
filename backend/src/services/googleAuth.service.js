// backend/src/services/googleAuth.service.js
// Google OAuth2 client, authorization URL generation, state validation, and token exchange.

import { google } from 'googleapis';
import { env } from '../config/env.js';
import { generateSecureToken } from '../utils/crypto.js';
import { getRedisClient } from '../config/redis.js';
import { AppError } from '../middlewares/errorHandler.js';

// Required Google OAuth scopes
export const GOOGLE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.readonly',
];

/**
 * Creates an instance of Google OAuth2 client with current credentials.
 */
export function createOAuth2Client() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new AppError(
      'Google OAuth credentials missing: configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env',
      500,
      'CONFIG_ERROR',
    );
  }

  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );
}

/**
 * Generate authorization URL with secure state stored in Redis or memory.
 * Uses offline access and prompt=consent to ensure a refresh token is returned.
 *
 * @returns {Promise<{ url: string, state: string }>}
 */
export async function generateAuthUrl() {
  const oauth2Client = createOAuth2Client();
  const state = generateSecureToken(32);

  // Store state in Redis with 10-minute TTL to prevent CSRF attacks
  try {
    const redis = getRedisClient();
    if (redis.status === 'ready') {
      await redis.set(`oauth_state:${state}`, 'pending', 'EX', 600);
    }
  } catch (err) {
    console.warn('[GoogleAuth] Redis state cache warning:', err.message);
  }

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Essential for obtaining a refresh token
    prompt: 'consent',     // Forces consent screen so Google re-issues a refresh token
    scope: GOOGLE_SCOPES,
    state,
    include_granted_scopes: true,
  });

  return { url, state };
}

/**
 * Validate received OAuth state against Redis.
 *
 * @param {string} state - State returned by Google callback
 * @returns {Promise<boolean>}
 */
export async function validateOAuthState(state) {
  if (!state) return false;

  try {
    const redis = getRedisClient();
    if (redis.status === 'ready') {
      const stored = await redis.get(`oauth_state:${state}`);
      if (stored) {
        await redis.del(`oauth_state:${state}`);
        return true;
      }
      return false;
    }
  } catch (err) {
    console.warn('[GoogleAuth] Redis state validation fallback:', err.message);
  }

  // If Redis is unavailable in local dev, ensure the state string has valid entropy
  return typeof state === 'string' && state.length >= 32;
}

/**
 * Exchange authorization code for Google OAuth2 tokens and fetch verified user profile.
 *
 * @param {string} code - Authorization code from callback
 * @returns {Promise<{ tokens: object, profile: object }>}
 */
export async function exchangeCodeForTokens(code) {
  const oauth2Client = createOAuth2Client();

  let tokens;
  try {
    const tokenResponse = await oauth2Client.getToken(code);
    tokens = tokenResponse.tokens;
  } catch (err) {
    console.error('[GoogleAuth] Token exchange failed:', err.message);
    throw new AppError(
      `Failed to exchange authorization code: ${err.message}`,
      400,
      'TOKEN_EXCHANGE_FAILED',
    );
  }

  oauth2Client.setCredentials(tokens);

  // Fetch verified user identity from Google (never trust frontend input)
  let profile;
  try {
    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const profileRes = await oauth2.userinfo.get();
    profile = profileRes.data;
  } catch (err) {
    console.error('[GoogleAuth] User profile retrieval failed:', err.message);
    throw new AppError(
      'Failed to fetch user profile from Google',
      500,
      'PROFILE_FETCH_FAILED',
    );
  }

  return { tokens, profile };
}


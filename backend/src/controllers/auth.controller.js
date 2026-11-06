// backend/src/controllers/auth.controller.js
// Google OAuth2 endpoints: init, callback, current user, and logout.

import { generateAuthUrl, validateOAuthState, exchangeCodeForTokens } from '../services/googleAuth.service.js';
import { User } from '../models/user.model.js';
import { EmailAccount } from '../models/emailAccount.model.js';
import { signJwtToken } from '../utils/token.js';
import { env } from '../config/env.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * GET /api/auth/google
 * Initiates Google OAuth2 flow by redirecting to consent screen or returning the URL.
 */
export async function getGoogleAuth(req, res, next) {
  try {
    const { url, state } = await generateAuthUrl();

    // Support JSON response if client requested it (useful for SPA popups)
    if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
      return res.status(200).json({ success: true, url, state });
    }

    res.redirect(url);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/google/callback
 * Handles the redirect from Google consent screen.
 */
export async function handleGoogleCallback(req, res, next) {
  try {
    const { code, state, error } = req.query;

    if (error) {
      console.warn('[AuthController] User cancelled or Google returned error:', error);
      return res.redirect(`${env.FRONTEND_URL}/?auth_error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      throw new AppError('Authorization code missing in Google callback', 400, 'MISSING_AUTH_CODE');
    }

    // 1. Validate state parameter to protect against CSRF attacks
    const isValidState = await validateOAuthState(state);
    if (!isValidState) {
      throw new AppError('Invalid or expired OAuth state parameter', 403, 'CSRF_STATE_INVALID');
    }

    // 2. Exchange authorization code for tokens and Google-verified profile
    const { tokens, profile } = await exchangeCodeForTokens(code);

    if (!profile.email) {
      throw new AppError('Google profile did not provide an email address', 400, 'MISSING_GOOGLE_EMAIL');
    }

    // 3. Upsert User record
    let user = await User.findOne({
      $or: [{ googleId: profile.id }, { email: profile.email.toLowerCase() }],
    });

    if (!user) {
      user = new User({
        name: profile.name || profile.email.split('@')[0],
        email: profile.email.toLowerCase(),
        googleId: profile.id,
        profilePicture: profile.picture || '',
      });
    } else {
      user.name = profile.name || user.name;
      user.googleId = profile.id;
      if (profile.picture) user.profilePicture = profile.picture;
    }
    await user.save();

    // 4. Upsert EmailAccount record with encrypted tokens
    let emailAccount = await EmailAccount.findOne({
      userId: user._id,
      emailAddress: profile.email.toLowerCase(),
    }).select('+encryptedAccessToken +encryptedRefreshToken');

    if (!emailAccount) {
      emailAccount = new EmailAccount({
        userId: user._id,
        provider: 'google',
        emailAddress: profile.email.toLowerCase(),
        scopes: tokens.scope ? tokens.scope.split(' ') : [],
      });
    } else {
      if (tokens.scope) {
        emailAccount.scopes = tokens.scope.split(' ');
      }
    }

    emailAccount.setTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token, // If null on re-login, existing refresh token remains intact
      expiryDate: tokens.expiry_date,
    });
    await emailAccount.save();

    // 5. Generate application JWT session
    const jwtToken = signJwtToken(user);

    // Set secure HTTP-only cookie
    res.cookie('mm_token', jwtToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // 6. Redirect back to frontend with token parameter for client-side storage
    res.redirect(`${env.FRONTEND_URL}/?token=${jwtToken}&auth_success=true`);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 * Returns current authenticated user and their connected email accounts.
 */
export async function getMe(req, res, next) {
  try {
    const user = req.user;
    const connectedAccounts = await EmailAccount.find({ userId: user._id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        user,
        connectedAccounts,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 * Clears authentication session.
 */
export function logout(req, res) {
  res.clearCookie('mm_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
}


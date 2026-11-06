// backend/src/models/emailAccount.model.js
// Connected Email Account schema and model.

import mongoose from 'mongoose';
import { encrypt, decrypt } from '../utils/crypto.js';

const emailAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['google'],
      default: 'google',
      required: true,
    },
    emailAddress: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    encryptedAccessToken: {
      type: String,
      default: null,
      select: false, // Never return in default queries
    },
    encryptedRefreshToken: {
      type: String,
      default: null,
      select: false, // Never return in default queries
    },
    tokenExpiry: {
      type: Date,
      default: null,
    },
    scopes: {
      type: [String],
      default: [],
    },
    lastHistoryId: {
      type: String,
      default: null,
    },
    watchExpiration: {
      type: Date,
      default: null,
    },
    connectionStatus: {
      type: String,
      enum: ['connected', 'disconnected', 'expired', 'revoked'],
      default: 'connected',
      index: true,
    },
    lastSyncedAt: {
      type: Date,
      default: null,
    },
    watchStatus: {
      type: String,
      enum: ['inactive', 'active', 'expired', 'error'],
      default: 'inactive',
    },
    syncInProgress: {
      type: Boolean,
      default: false,
    },
    lastSyncError: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        delete ret.__v;
        delete ret.encryptedAccessToken;
        delete ret.encryptedRefreshToken;
        return ret;
      },
    },
  },
);

// Compound index: prevent connecting the same email address under multiple active records for the same provider
emailAccountSchema.index({ provider: 1, emailAddress: 1 }, { unique: true });
emailAccountSchema.index({ userId: 1, emailAddress: 1 });

/**
 * Set and encrypt the OAuth tokens.
 */
emailAccountSchema.methods.setTokens = function ({ accessToken, refreshToken, expiryDate }) {
  if (accessToken) {
    this.encryptedAccessToken = encrypt(accessToken);
  }
  if (refreshToken) {
    this.encryptedRefreshToken = encrypt(refreshToken);
  }
  if (expiryDate) {
    this.tokenExpiry = new Date(expiryDate);
  }
  this.connectionStatus = 'connected';
};

/**
 * Retrieve decrypted access token.
 */
emailAccountSchema.methods.getDecryptedAccessToken = function () {
  return this.encryptedAccessToken ? decrypt(this.encryptedAccessToken) : null;
};

/**
 * Retrieve decrypted refresh token.
 */
emailAccountSchema.methods.getDecryptedRefreshToken = function () {
  return this.encryptedRefreshToken ? decrypt(this.encryptedRefreshToken) : null;
};

/**
 * Check if the current access token has expired or is expiring in less than 2 minutes.
 */
emailAccountSchema.methods.isTokenExpired = function () {
  if (!this.tokenExpiry) return true;
  return new Date().getTime() >= new Date(this.tokenExpiry).getTime() - 120_000;
};

export const EmailAccount = mongoose.model('EmailAccount', emailAccountSchema);
export default EmailAccount;


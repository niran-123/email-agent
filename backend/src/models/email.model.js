// backend/src/models/email.model.js
// Synced email messages schema and model for Phase 3 ingestion.

import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, default: 0 },
    attachmentId: { type: String, default: null },
  },
  { _id: false },
);

const emailSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailAccount',
      required: true,
      index: true,
    },
    gmailMessageId: {
      type: String,
      required: true,
    },
    threadId: {
      type: String,
      required: true,
    },
    historyId: {
      type: String,
      default: null,
    },
    sender: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    senderName: {
      type: String,
      default: '',
      trim: true,
    },
    recipient: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
    cc: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
    bcc: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
    subject: {
      type: String,
      default: '(No Subject)',
      trim: true,
    },
    bodyText: {
      type: String,
      default: '',
    },
    bodyHtml: {
      type: String,
      default: null,
      select: false, // Omit heavy HTML by default to avoid memory bloat
    },
    snippet: {
      type: String,
      default: '',
    },
    receivedAt: {
      type: Date,
      required: true,
      index: true,
    },
    labels: {
      type: [String],
      default: [],
      index: true,
    },
    attachments: [attachmentSchema],
    processingStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'skipped'],
      default: 'pending',
      index: true,
    },
    syncStatus: {
      type: String,
      enum: ['synced', 'updated', 'deleted'],
      default: 'synced',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Virtual getters for backwards compatibility with Phase 2 frontend / services
emailSchema.virtual('from').get(function () {
  return {
    email: this.sender,
    name: this.senderName || '',
  };
});

emailSchema.virtual('to').get(function () {
  return (this.recipient || []).map((email) => ({ email, name: '' }));
});

emailSchema.virtual('hasAttachments').get(function () {
  return (this.attachments || []).length > 0;
});

// ── Compound Indexes (Phase 3 Requirements) ───────────────────────────────────
// 1. Idempotent unique index on accountId + gmailMessageId
emailSchema.index({ accountId: 1, gmailMessageId: 1 }, { unique: true });

// 2. User + receivedAt (for timeline / sorting)
emailSchema.index({ userId: 1, receivedAt: -1 });

// 3. User + processingStatus (for AI agent worker queue polling)
emailSchema.index({ userId: 1, processingStatus: 1 });

// 4. Account + receivedAt (for per-account sync queries)
emailSchema.index({ accountId: 1, receivedAt: -1 });

// 5. threadId (for thread reconstruction)
emailSchema.index({ threadId: 1 });

export const Email = mongoose.model('Email', emailSchema);
export default Email;

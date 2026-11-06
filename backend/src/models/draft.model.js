// backend/src/models/draft.model.js
// AI-generated email reply draft model with approval lifecycle.

import mongoose from 'mongoose';

const draftSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    emailId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Email',
      required: true,
      index: true,
    },
    threadId: {
      type: String,
      default: null,
      index: true,
    },
    recipient: {
      type: [String],
      default: [],
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    bodyText: {
      type: String,
      required: true,
    },
    bodyHtml: {
      type: String,
      default: '',
    },
    tone: {
      type: String,
      enum: ['PROFESSIONAL', 'CONCISE', 'CASUAL', 'FORMAL', 'DECLINE', 'URGENT_ACKNOWLEDGEMENT'],
      default: 'PROFESSIONAL',
    },
    status: {
      type: String,
      enum: ['drafted', 'approved', 'sent', 'discarded'],
      default: 'drafted',
      index: true,
    },
    gmailDraftId: {
      type: String,
      default: null,
    },
    reasoningSummary: {
      type: String,
      default: '',
    },
    suggestedActionsTaken: {
      type: [String],
      default: [],
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.9,
    },
    model: {
      type: String,
      default: 'gpt-4o-mini',
    },
    promptVersion: {
      type: String,
      default: '1.0.0',
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

draftSchema.index({ userId: 1, createdAt: -1 });
draftSchema.index({ emailId: 1, status: 1 });

export const Draft = mongoose.model('Draft', draftSchema);
export default Draft;

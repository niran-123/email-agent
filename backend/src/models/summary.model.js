// backend/src/models/summary.model.js
// AI-generated email summary and intelligence model.

import mongoose from 'mongoose';

const summarySchema = new mongoose.Schema(
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
    },
    summary: {
      type: String,
      required: true,
    },
    detailedSummary: {
      type: String,
      required: true,
    },
    keyPoints: {
      type: [String],
      default: [],
    },
    priority: {
      type: String,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['WORK', 'EDUCATION', 'PERSONAL', 'FINANCE', 'PROMOTIONS', 'OTHER'],
      required: true,
      index: true,
    },
    senderIntent: {
      type: String,
      required: true,
    },
    requiresResponse: {
      type: Boolean,
      default: false,
      index: true,
    },
    requiresAction: {
      type: Boolean,
      default: false,
      index: true,
    },
    suggestedNextSteps: {
      type: [String],
      default: [],
    },
    classificationConfidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 1.0,
    },
    reasoningSummary: {
      type: String,
      default: '',
    },
    model: {
      type: String,
      required: true,
    },
    promptVersion: {
      type: String,
      required: true,
    },
    analyzedAt: {
      type: Date,
      default: Date.now,
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

// Unique index preventing duplicate summaries for the same email and analysis version
summarySchema.index({ emailId: 1, promptVersion: 1 }, { unique: true });
summarySchema.index({ userId: 1, analyzedAt: -1 });

export const Summary = mongoose.model('Summary', summarySchema);
export default Summary;

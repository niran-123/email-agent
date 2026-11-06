// backend/src/models/actionItem.model.js
// Extracted actionable tasks and obligations model.

import mongoose from 'mongoose';

const actionItemSchema = new mongoose.Schema(
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
    task: {
      type: String,
      required: true,
      trim: true,
    },
    deadline: {
      type: Date,
      default: null,
      index: true,
    },
    deadlineText: {
      type: String,
      default: null,
      trim: true,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.9,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'dismissed'],
      default: 'pending',
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

actionItemSchema.index({ userId: 1, status: 1 });
actionItemSchema.index({ userId: 1, deadline: 1 });

export const ActionItem = mongoose.model('ActionItem', actionItemSchema);
export default ActionItem;

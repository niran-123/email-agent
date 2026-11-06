// backend/src/controllers/analysis.controller.js
// Controllers for AI email summarization, summary retrieval, and action items management.

import { Email } from '../models/email.model.js';
import { Summary } from '../models/summary.model.js';
import { ActionItem } from '../models/actionItem.model.js';
import { processEmailAnalysis } from '../services/emailProcessing.service.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * POST /api/emails/:id/summarize
 * Triggers AI analysis on a specific email. Enforces user ownership.
 */
export async function triggerEmailSummarize(req, res, next) {
  try {
    const email = await Email.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!email) {
      throw new AppError('Email not found or does not belong to you', 404, 'EMAIL_NOT_FOUND');
    }

    const force = req.body?.force === true || req.query?.force === 'true';
    const result = await processEmailAnalysis(email._id, { force });

    res.status(200).json({
      success: true,
      message: 'Email analyzed successfully',
      data: {
        summary: result.summary,
        actionItems: result.actionItems,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/emails/:id/summary
 * Retrieves the AI summary and action items for a given email ID.
 */
export async function getEmailSummary(req, res, next) {
  try {
    const email = await Email.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!email) {
      throw new AppError('Email not found or does not belong to you', 404, 'EMAIL_NOT_FOUND');
    }

    const [summary, actionItems] = await Promise.all([
      Summary.findOne({ emailId: email._id }).sort({ analyzedAt: -1 }),
      ActionItem.find({ emailId: email._id }),
    ]);

    if (!summary) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'No analysis has been generated for this email yet. Call POST /api/emails/:id/summarize.',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        summary,
        actionItems,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/summaries
 * List summaries for authenticated user with optional priority / category filters.
 */
export async function listSummaries(req, res, next) {
  try {
    const query = { userId: req.user._id };

    if (req.query.priority) {
      query.priority = req.query.priority.toUpperCase();
    }
    if (req.query.category) {
      query.category = req.query.category.toUpperCase();
    }
    if (req.query.requiresAction !== undefined) {
      query.requiresAction = req.query.requiresAction === 'true';
    }

    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 50);

    const [total, summaries] = await Promise.all([
      Summary.countDocuments(query),
      Summary.find(query)
        .sort({ analyzedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('emailId', 'subject sender senderName receivedAt snippet labels'),
    ]);

    res.status(200).json({
      success: true,
      data: summaries,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/summaries/:id
 * Retrieve a specific Summary document by ID.
 */
export async function getSummaryById(req, res, next) {
  try {
    const summary = await Summary.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).populate('emailId', 'subject sender senderName recipient receivedAt snippet labels');

    if (!summary) {
      throw new AppError('Summary not found', 404, 'SUMMARY_NOT_FOUND');
    }

    const actionItems = await ActionItem.find({ emailId: summary.emailId?._id || summary.emailId });

    res.status(200).json({
      success: true,
      data: {
        summary,
        actionItems,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/actions
 * List action items for authenticated user with optional status filter.
 */
export async function listActionItems(req, res, next) {
  try {
    const query = { userId: req.user._id };

    if (req.query.status) {
      query.status = req.query.status.toLowerCase();
    }
    if (req.query.hasDeadline === 'true') {
      query.deadline = { $ne: null };
    }

    const actions = await ActionItem.find(query)
      .sort({ deadline: 1, createdAt: -1 })
      .populate('emailId', 'subject sender senderName receivedAt');

    res.status(200).json({
      success: true,
      data: actions,
      count: actions.length,
    });
  } catch (err) {
    next(err);
  }
}


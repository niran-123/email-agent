// backend/src/services/emailProcessing.service.js
// Pipeline orchestrator: retrieves emails, prepares safe inputs, invokes AI agent, and persists summaries & action items.

import { Email } from '../models/email.model.js';
import { Summary } from '../models/summary.model.js';
import { ActionItem } from '../models/actionItem.model.js';
import { analyzeEmail } from '../agents/email-analysis.agent.js';
import { PROMPT_VERSION } from '../agents/prompts/email-analysis.prompt.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Process AI analysis on a single stored email.
 * Guarantees that the email is marked 'completed' ONLY after summary and action items are saved.
 *
 * @param {string} emailId - MongoDB ObjectId of the Email document
 * @param {object} [options]
 * @param {boolean} [options.force=false] - Force re-analysis even if already completed
 * @param {string} [options.model]
 * @param {boolean} [options.allowMockFallback=true]
 * @returns {Promise<{ email: object, summary: object, actionItems: Array<object> }>}
 */
export async function processEmailAnalysis(emailId, options = {}) {
  const email = await Email.findById(emailId);
  if (!email) {
    throw new AppError(`Email not found: ${emailId}`, 404, 'EMAIL_NOT_FOUND');
  }

  // Idempotency check: if already completed and not forcing re-analysis
  if (email.processingStatus === 'completed' && !options.force) {
    const [existingSummary, existingActions] = await Promise.all([
      Summary.findOne({ emailId: email._id, promptVersion: PROMPT_VERSION }),
      ActionItem.find({ emailId: email._id }),
    ]);

    if (existingSummary) {
      return { email, summary: existingSummary, actionItems: existingActions };
    }
  }

  // 1. Mark as processing
  email.processingStatus = 'processing';
  await email.save();

  try {
    // 2. Prepare safe, sanitized AI input
    let threadContext = '';
    if (email.threadId) {
      // Fetch up to 2 preceding messages from the same thread for context
      const threadHistory = await Email.find({
        threadId: email.threadId,
        _id: { $ne: email._id },
        receivedAt: { $lt: email.receivedAt },
      })
        .sort({ receivedAt: -1 })
        .limit(2);

      if (threadHistory.length > 0) {
        threadContext = threadHistory
          .reverse()
          .map((m) => `[From: ${m.sender} at ${m.receivedAt?.toISOString()}]\n${m.snippet || m.bodyText}`)
          .join('\n---\n');
      }
    }

    const agentInput = {
      subject: email.subject,
      sender: email.sender,
      senderName: email.senderName,
      recipient: email.recipient,
      receivedAt: email.receivedAt,
      bodyText: email.bodyText || email.snippet || '',
      threadContext,
    };

    // 3. Execute AI Agent analysis with Structured Outputs
    const { analysis, model, promptVersion, analyzedAt } = await analyzeEmail(agentInput, options);

    // 4. Persist Summary document
    const summaryDoc = await Summary.findOneAndUpdate(
      {
        emailId: email._id,
        promptVersion,
      },
      {
        $set: {
          userId: email.userId,
          emailId: email._id,
          summary: analysis.summary,
          detailedSummary: analysis.detailedSummary,
          keyPoints: analysis.keyPoints,
          priority: analysis.priority,
          category: analysis.category,
          senderIntent: analysis.senderIntent,
          requiresResponse: analysis.requiresResponse,
          requiresAction: analysis.requiresAction,
          suggestedNextSteps: analysis.suggestedNextSteps,
          classificationConfidence: analysis.classificationConfidence,
          reasoningSummary: analysis.reasoningSummary,
          model,
          promptVersion,
          analyzedAt,
        },
      },
      { upsert: true, new: true },
    );

    // 5. Persist ActionItem documents
    // Clear any previous items for this email to avoid duplicate stacking on re-run
    await ActionItem.deleteMany({ emailId: email._id });

    const createdActionItems = [];
    if (analysis.actionItems && analysis.actionItems.length > 0) {
      for (const item of analysis.actionItems) {
        let resolvedDeadline = null;
        if (item.deadline) {
          const parsedDate = new Date(item.deadline);
          if (!isNaN(parsedDate.getTime())) {
            resolvedDeadline = parsedDate;
          }
        }

        const actionDoc = new ActionItem({
          userId: email.userId,
          emailId: email._id,
          task: item.task,
          deadline: resolvedDeadline,
          deadlineText: item.deadlineText || null,
          confidence: item.confidence ?? 0.9,
          status: 'pending',
        });
        await actionDoc.save();
        createdActionItems.push(actionDoc);
      }
    }

    // 6. ONLY mark complete once summary and action items are safely stored
    email.processingStatus = 'completed';
    await email.save();

    console.log(
      `[EmailProcessing] ✅ Analyzed email ${email._id} (${analysis.priority} / ${analysis.category}, ${createdActionItems.length} actions)`,
    );

    return {
      email,
      summary: summaryDoc,
      actionItems: createdActionItems,
    };
  } catch (err) {
    // 7. Record failure safely
    email.processingStatus = 'failed';
    await email.save();
    console.error(`[EmailProcessing] ❌ Analysis failed for email ${email._id}:`, err.message);
    throw err;
  }
}


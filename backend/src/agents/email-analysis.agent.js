// backend/src/agents/email-analysis.agent.js
// Core AI analysis agent for email triage, summary generation, priority classification, and action extraction.

import { EmailAnalysisSchema } from './schemas/email-analysis.schema.js';
import { SYSTEM_PROMPT, PROMPT_VERSION, buildUserPrompt } from './prompts/email-analysis.prompt.js';
import { parseStructuredCompletion } from '../services/openai.service.js';
import { env } from '../config/env.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Execute email analysis using OpenAI Structured Outputs.
 *
 * @param {object} input
 * @param {string} input.subject
 * @param {string} input.sender
 * @param {string} [input.senderName]
 * @param {string|string[]} input.recipient
 * @param {Date|string} input.receivedAt
 * @param {string} input.bodyText
 * @param {string} [input.threadContext]
 * @param {object} [options]
 * @param {string} [options.model]
 * @param {boolean} [options.allowMockFallback=true] - Allows deterministic test rule-engine when OPENAI_API_KEY is not set
 * @returns {Promise<{ analysis: import('./schemas/email-analysis.schema.js').EmailAnalysis, model: string, promptVersion: string, analyzedAt: Date }>}
 */
export async function analyzeEmail(input, options = {}) {
  const { subject, sender, senderName, recipient, receivedAt, bodyText, threadContext } = input;

  if (!sender && !bodyText && !subject) {
    throw new AppError('Email must contain at least subject, sender, or body text to analyze', 400, 'INVALID_INPUT');
  }

  const userPrompt = buildUserPrompt({
    subject,
    sender,
    senderName,
    recipient,
    receivedAt,
    bodyText,
    threadContext,
  });

  const selectedModel = options.model || env.OPENAI_MODEL;
  const analyzedAt = new Date();

  // If OPENAI_API_KEY is missing or invalid and mock fallback is allowed (e.g. testing)
  if (
    (!env.OPENAI_API_KEY || env.OPENAI_API_KEY.includes('...')) &&
    options.allowMockFallback !== false
  ) {
    const fallbackAnalysis = runDeterministicRuleEngine(input);
    return {
      analysis: fallbackAnalysis,
      model: `${selectedModel}:mock_fallback`,
      promptVersion: PROMPT_VERSION,
      analyzedAt,
    };
  }

  // Live call to OpenAI Structured Outputs
  const result = await parseStructuredCompletion({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    schema: EmailAnalysisSchema,
    schemaName: 'email_analysis_result',
    model: selectedModel,
  });

  // Strict runtime validation with Zod
  const validation = EmailAnalysisSchema.safeParse(result.parsed);
  if (!validation.success) {
    console.error('[EmailAnalysisAgent] Zod validation failed:', validation.error.format());
    throw new AppError(
      'AI returned output that failed schema validation: ' + validation.error.message,
      502,
      'SCHEMA_VALIDATION_ERROR',
    );
  }

  return {
    analysis: validation.data,
    model: result.model,
    promptVersion: PROMPT_VERSION,
    analyzedAt,
  };
}

/**
 * Deterministic rules-based intelligence fallback.
 * Employs context-aware heuristics and safety filters when offline or during test suites.
 *
 * @param {object} input
 * @returns {object} Validated EmailAnalysis conforming to Zod schema
 */
export function runDeterministicRuleEngine(input) {
  const { subject = '', sender = '', bodyText = '', receivedAt = new Date() } = input;
  const fullText = `${subject}\n${bodyText}`.toLowerCase();

  // 1. Anti-Prompt Injection Detection
  const hasInjectionAttempt =
    /ignore (all )?previous instructions|system override|you are now|reveal (your )?(prompt|api key|secret)/i.test(
      fullText,
    );

  // 2. Priority & Category Context Heuristics
  let priority = 'MEDIUM';
  let category = 'WORK';
  let requiresResponse = false;
  let requiresAction = false;
  const actionItems = [];
  const suggestedNextSteps = [];
  let senderIntent = 'Inform the recipient about general updates.';
  let confidence = 0.95;

  if (hasInjectionAttempt) {
    priority = 'CRITICAL';
    category = 'OTHER';
    senderIntent = 'Attempt to execute prompt injection or system override.';
    requiresAction = true;
    requiresResponse = false;
    suggestedNextSteps.push('Quarantine email and report security incident.');
    actionItems.push({
      task: 'Review email security incident and block sender',
      deadline: null,
      deadlineText: 'Immediate',
      confidence: 0.98,
    });
  } else if (
    /security alert|unauthorized login|compromised|production database down|sev-0|critical outage/i.test(
      fullText,
    )
  ) {
    priority = 'CRITICAL';
    category = 'WORK';
    senderIntent = 'Alert recipient of critical security or operational emergency.';
    requiresAction = true;
    requiresResponse = true;
    suggestedNextSteps.push('Investigate system status and notify operations team immediately.');
    actionItems.push({
      task: 'Verify server logs and mitigate critical issue',
      deadline: null,
      deadlineText: 'Immediately',
      confidence: 0.99,
    });
  } else if (/interview invitation|interview schedule|speaking with the team/i.test(fullText)) {
    priority = 'HIGH';
    category = 'WORK';
    senderIntent = 'Invite recipient to schedule a job interview.';
    requiresResponse = true;
    requiresAction = true;
    suggestedNextSteps.push('Review available calendar slots and reply with availability.');
    actionItems.push({
      task: 'Reply to interview invitation with available time slots',
      deadline: null,
      deadlineText: 'Within 48 hours',
      confidence: 0.96,
    });
  } else if (/final exam|assignment submission|homework due|grades posted|academic/i.test(fullText)) {
    priority = 'HIGH';
    category = 'EDUCATION';
    senderIntent = 'Notify student of academic coursework or submission deadline.';
    requiresAction = true;
    requiresResponse = false;
    suggestedNextSteps.push('Complete assignment and prepare for submission.');
    actionItems.push({
      task: 'Submit course assignment via student portal',
      deadline: null,
      deadlineText: fullText.match(/by ([^,.\n]+)/i)?.[0] || 'Upcoming deadline',
      confidence: 0.92,
    });
  } else if (/invoice|past due|payment failed|statement ready|wire transfer|billing/i.test(fullText)) {
    priority = 'HIGH';
    category = 'FINANCE';
    senderIntent = 'Request payment or provide financial billing statement.';
    requiresAction = true;
    requiresResponse = false;
    suggestedNextSteps.push('Review invoice details and process payment.');
    actionItems.push({
      task: 'Review and settle pending invoice',
      deadline: null,
      deadlineText: fullText.match(/due (on|by)? ([^,.\n]+)/i)?.[0] || null,
      confidence: 0.94,
    });
  } else if (/unsubscribe|sale|discount|limited time offer|coupon|% off/i.test(fullText)) {
    priority = 'LOW';
    category = 'PROMOTIONS';
    senderIntent = 'Promote promotional products or commercial offers.';
    requiresResponse = false;
    requiresAction = false;
    suggestedNextSteps.push('Archive or ignore marketing announcement.');
  } else if (/weekly digest|newsletter|issue #|monthly recap/i.test(fullText)) {
    priority = 'LOW';
    category = 'OTHER';
    senderIntent = 'Deliver periodic newsletter publication.';
    requiresResponse = false;
    requiresAction = false;
    suggestedNextSteps.push('Read when convenient or archive.');
  } else if (
    /please send|can you review|action required|need your approval|deadline is/i.test(fullText)
  ) {
    priority = 'HIGH';
    category = 'WORK';
    senderIntent = 'Request specific action or approval from recipient.';
    requiresAction = true;
    requiresResponse = true;
    suggestedNextSteps.push('Review document and provide requested feedback.');
    const deadlineMatch =
      fullText.match(/by ([^,.\n]+)/i)?.[0] ||
      fullText.match(/(sometime [^,.\n]+|as soon as possible|when you get a chance|soon|eod|end of week|next week)/i)?.[0] ||
      null;
    // If the matched string looks like a standard parseable ISO date, convert to ISO, otherwise null for ambiguous phrases
    let parsedDeadline = null;
    if (deadlineMatch) {
      const dateOnly = deadlineMatch.replace(/^by\s+/i, '').trim();
      const parsed = Date.parse(dateOnly);
      if (!isNaN(parsed) && !/sometime|soon|chance|week/i.test(deadlineMatch)) {
        parsedDeadline = new Date(parsed).toISOString();
      }
    }
    actionItems.push({
      task: 'Review requested materials and provide response',
      deadline: parsedDeadline,
      deadlineText: deadlineMatch,
      confidence: 0.9,
    });
  }

  // Clean summary synthesis
  const snippet = bodyText.slice(0, 150).replace(/\s+/g, ' ').trim();
  const summary = `${subject}: ${snippet}...`;
  const detailedSummary = `Email from ${sender} regarding "${subject}". Content overview: ${bodyText.slice(0, 350).replace(/\s+/g, ' ')}.`;

  const keyPoints = [
    `Subject: ${subject || 'No Subject'}`,
    `Sender identified as ${sender}`,
    senderIntent,
  ];

  const reasoningSummary = `Assigned ${priority} priority and ${category} category based on email intent ("${senderIntent}") and obligation assessment.`;

  return EmailAnalysisSchema.parse({
    summary: summary.slice(0, 250),
    detailedSummary,
    keyPoints,
    priority,
    category,
    senderIntent,
    requiresResponse,
    requiresAction,
    actionItems,
    suggestedNextSteps: suggestedNextSteps.length > 0 ? suggestedNextSteps : ['No immediate action required.'],
    classificationConfidence: confidence,
    reasoningSummary,
  });
}

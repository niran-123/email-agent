// backend/src/agents/draft-reply.agent.js
// Core AI agent for generating context-aware email reply drafts.

import { DraftReplySchema } from './schemas/draft-reply.schema.js';
import {
  DRAFT_SYSTEM_PROMPT,
  DRAFT_PROMPT_VERSION,
  buildDraftUserPrompt,
} from './prompts/draft-reply.prompt.js';
import { parseStructuredCompletion } from '../services/openai.service.js';
import { env } from '../config/env.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Generate an AI reply draft for an email.
 *
 * @param {object} input
 * @param {object} input.email - Email document/payload (subject, sender, senderName, bodyText, receivedAt)
 * @param {object} [input.summary] - Phase 4 AI summary if present
 * @param {Array<object>} [input.actionItems] - Extracted action items
 * @param {string} [input.tone='PROFESSIONAL'] - PROFESSIONAL, CONCISE, CASUAL, FORMAL, DECLINE, URGENT_ACKNOWLEDGEMENT
 * @param {string} [input.userInstructions] - Additional guidance provided by the user
 * @param {string} [input.threadContext] - Prior messages
 * @param {object} [options]
 * @param {string} [options.model]
 * @param {boolean} [options.allowMockFallback=true]
 * @returns {Promise<{ draft: import('./schemas/draft-reply.schema.js').DraftReply, model: string, promptVersion: string, generatedAt: Date }>}
 */
export async function generateDraftReply(input, options = {}) {
  const { email, tone = 'PROFESSIONAL' } = input;

  if (!email || (!email.subject && !email.bodyText && !email.snippet)) {
    throw new AppError('Cannot generate reply for an empty email', 400, 'INVALID_INPUT');
  }

  const userPrompt = buildDraftUserPrompt(input);
  const selectedModel = options.model || env.OPENAI_MODEL;
  const generatedAt = new Date();

  // Offline / test rule engine fallback
  if (
    (!env.OPENAI_API_KEY || env.OPENAI_API_KEY.includes('...')) &&
    options.allowMockFallback !== false
  ) {
    const fallbackDraft = runDeterministicDraftEngine(input);
    return {
      draft: fallbackDraft,
      model: `${selectedModel}:mock_fallback`,
      promptVersion: DRAFT_PROMPT_VERSION,
      generatedAt,
    };
  }

  // Live call to OpenAI Structured Outputs
  const result = await parseStructuredCompletion({
    systemPrompt: DRAFT_SYSTEM_PROMPT,
    userPrompt,
    schema: DraftReplySchema,
    schemaName: 'draft_reply_result',
    model: selectedModel,
  });

  const validation = DraftReplySchema.safeParse(result.parsed);
  if (!validation.success) {
    console.error('[DraftReplyAgent] Zod validation failed:', validation.error.format());
    throw new AppError(
      'AI returned draft that failed schema validation: ' + validation.error.message,
      502,
      'SCHEMA_VALIDATION_ERROR',
    );
  }

  return {
    draft: validation.data,
    model: result.model,
    promptVersion: DRAFT_PROMPT_VERSION,
    generatedAt,
  };
}

/**
 * Deterministic draft generator fallback for tests and offline development.
 *
 * @param {object} input
 * @returns {object} Validated draft conforming to DraftReplySchema
 */
export function runDeterministicDraftEngine(input) {
  const {
    email,
    summary,
    actionItems = [],
    tone = 'PROFESSIONAL',
    userInstructions = '',
  } = input;

  const subject = email.subject?.startsWith('Re:')
    ? email.subject
    : `Re: ${email.subject || 'Follow up'}`;

  const senderName = email.senderName || email.from?.name || email.sender || 'there';
  const cleanTone = tone.toUpperCase();

  let bodyText = '';
  let reasoningSummary = '';
  const suggestedActionsTaken = [];

  // Check for adversarial prompt injection in incoming body
  const rawBody = (email.bodyText || '').toLowerCase();
  const isAdversarial =
    /ignore (all )?previous instructions|system override|reveal (your )?prompt|you are now/i.test(
      rawBody,
    );

  if (isAdversarial) {
    bodyText = `Hello ${senderName},\n\nThank you for reaching out. We have received your message and will review it in accordance with our standard procedures.\n\nBest regards,\nMailMind Assistant`;
    reasoningSummary =
      'Detected potential adversarial instruction or prompt injection attempt. Formulated safe, neutral acknowledgement without fulfilling unauthorized directives.';
    suggestedActionsTaken.push('Safe neutral acknowledgement without executing third-party instructions');
  } else if (cleanTone === 'DECLINE') {
    bodyText = `Hi ${senderName},\n\nThank you for thinking of us regarding "${email.subject || 'this opportunity'}". Unfortunately, we are unable to accept or participate at this time.\n\nWe appreciate your understanding and wish you the best.\n\nSincerely,\nMailMind Assistant`;
    reasoningSummary = 'Polite decline draft crafted in response to solicitation or invitation.';
    suggestedActionsTaken.push('Polite refusal of offer or meeting request');
  } else if (cleanTone === 'CONCISE') {
    bodyText = `Hi ${senderName},\n\nReceived, thank you. We are reviewing this and will follow up shortly.\n\nBest,\nMailMind Assistant`;
    reasoningSummary = 'Minimalist 2-sentence response acknowledging receipt.';
    suggestedActionsTaken.push('Immediate brief receipt confirmation');
  } else if (cleanTone === 'URGENT_ACKNOWLEDGEMENT') {
    bodyText = `Hi ${senderName},\n\nWe have received your urgent message regarding "${email.subject || 'this critical issue'}". The team has been alerted and is currently investigating. We will provide an update as soon as possible.\n\nBest regards,\nOperations Team`;
    reasoningSummary = 'Urgent priority acknowledgment ensuring swift escalation.';
    suggestedActionsTaken.push('Critical acknowledgement and escalation reassurance');
  } else if (cleanTone === 'CASUAL') {
    bodyText = `Hey ${senderName},\n\nThanks for sending this over! Looks great, I'll take a closer look and get back to you soon.\n\nCheers,\nMailMind Assistant`;
    reasoningSummary = 'Friendly and informal communication draft for casual or internal contact.';
    suggestedActionsTaken.push('Warm informal receipt');
  } else {
    // PROFESSIONAL (Default)
    const taskMention =
      actionItems.length > 0
        ? `Regarding the action items (${actionItems.map((a) => a.task).join('; ')}), we are actively working on them.`
        : 'Thank you for following up with the details.';

    const extraNote = userInstructions ? `\n\n${userInstructions}` : '';

    bodyText = `Dear ${senderName},\n\nThank you for your email. ${taskMention}${extraNote}\n\nPlease let us know if you require any additional information in the meantime.\n\nKind regards,\nMailMind Assistant`;
    reasoningSummary =
      'Professional business reply addressing core email context and action obligations.';
    suggestedActionsTaken.push('Acknowledged action items and provided professional follow-up');
  }

  return DraftReplySchema.parse({
    subject,
    bodyText,
    bodyHtml: `<p>${bodyText.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`,
    tone: cleanTone,
    reasoningSummary,
    suggestedActionsTaken,
    confidence: 0.94,
  });
}

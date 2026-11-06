// backend/src/agents/schemas/draft-reply.schema.js
// Zod schema for validated Structured Outputs from the AI Draft Generation Agent.

import { z } from 'zod';

export const ToneEnum = z.enum([
  'PROFESSIONAL',
  'CONCISE',
  'CASUAL',
  'FORMAL',
  'DECLINE',
  'URGENT_ACKNOWLEDGEMENT',
]);

export const DraftReplySchema = z.object({
  subject: z
    .string()
    .describe('Standard reply subject, typically starting with "Re: " followed by the original thread topic.'),
  bodyText: z
    .string()
    .describe('Clean, well-structured plain-text reply body ready for human review and dispatch.'),
  bodyHtml: z
    .string()
    .optional()
    .describe('Optional sanitized HTML version with paragraph and list tags if rich formatting is beneficial.'),
  tone: ToneEnum.describe(
    'The communication tone used in the draft: PROFESSIONAL, CONCISE, CASUAL, FORMAL, DECLINE, or URGENT_ACKNOWLEDGEMENT.',
  ),
  reasoningSummary: z
    .string()
    .describe('Brief explanation of why this reply strategy and tone were chosen based on the email context.'),
  suggestedActionsTaken: z
    .array(z.string())
    .describe('Specific questions answered or commitments agreed to within this draft.'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence score between 0.0 and 1.0 indicating how well the draft addresses the sender intent.'),
});

export default DraftReplySchema;


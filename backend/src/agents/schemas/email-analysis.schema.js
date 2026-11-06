// backend/src/agents/schemas/email-analysis.schema.js
// Zod schema for validated Structured Outputs from the AI email analysis agent.

import { z } from 'zod';

export const PriorityEnum = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
export const CategoryEnum = z.enum([
  'WORK',
  'EDUCATION',
  'PERSONAL',
  'FINANCE',
  'PROMOTIONS',
  'OTHER',
]);

export const ActionItemSchema = z.object({
  task: z.string().describe('Clear verb-based task description of the user obligation or action.'),
  deadline: z
    .string()
    .nullable()
    .describe('Resolved ISO 8601 date string if contextual dates are explicitly clear, otherwise null.'),
  deadlineText: z
    .string()
    .nullable()
    .describe('The exact literal deadline text mentioned in the email, or null if none.'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence score between 0.0 and 1.0 that this is a required user action item.'),
});

export const EmailAnalysisSchema = z.object({
  summary: z
    .string()
    .describe('Concise, 1-2 sentence executive summary of the email purpose and content.'),
  detailedSummary: z
    .string()
    .describe('Expanded, detailed paragraph capturing background, nuance, and key details.'),
  keyPoints: z
    .array(z.string())
    .min(1)
    .describe('List of key takeaways or core facts from the email.'),
  priority: PriorityEnum.describe(
    'Priority level: CRITICAL (security/emergencies), HIGH (urgent work/interviews/deadlines), MEDIUM (regular communication), LOW (promotions/newsletters).',
  ),
  category: CategoryEnum.describe(
    'Classification category: WORK, EDUCATION, PERSONAL, FINANCE, PROMOTIONS, or OTHER.',
  ),
  senderIntent: z
    .string()
    .describe('Clear explanation of what the sender is seeking, informing, or requesting.'),
  requiresResponse: z
    .boolean()
    .describe('True if the sender explicitly or contextually expects a reply from the recipient.'),
  requiresAction: z
    .boolean()
    .describe('True if this email necessitates any action, task, or decision by the recipient.'),
  actionItems: z
    .array(ActionItemSchema)
    .describe('List of extracted actionable obligations and tasks.'),
  suggestedNextSteps: z
    .array(z.string())
    .describe('Recommended next steps for the recipient to resolve or reply to this email.'),
  classificationConfidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence score between 0.0 and 1.0 for the priority and category classification.'),
  reasoningSummary: z
    .string()
    .describe('Brief, evidence-based explanation referencing facts from the email supporting the assigned priority and action requirements.'),
});

export default EmailAnalysisSchema;


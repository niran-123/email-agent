// backend/src/services/openai.service.js
// OpenAI client configured with Structured Outputs using the official SDK.

import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { env } from '../config/env.js';
import { AppError } from '../middlewares/errorHandler.js';

let openaiClient = null;

/**
 * Get or initialize the singleton OpenAI client.
 */
export function getOpenAIClient() {
  if (openaiClient) return openaiClient;

  if (!env.OPENAI_API_KEY) {
    console.warn('[OpenAI] ⚠️ OPENAI_API_KEY is not configured in .env');
  }

  openaiClient = new OpenAI({
    apiKey: env.OPENAI_API_KEY || 'sk-mock-key-for-dev',
  });

  return openaiClient;
}

/**
 * Call OpenAI Chat Completions using Structured Outputs with a Zod schema.
 *
 * @template T
 * @param {object} params
 * @param {string} params.systemPrompt
 * @param {string} params.userPrompt
 * @param {import('zod').ZodType<T>} params.schema
 * @param {string} [params.schemaName='response']
 * @param {string} [params.model]
 * @param {number} [params.temperature=0.1] - Low temperature for consistent classification
 * @returns {Promise<{ parsed: T, model: string, usage: object }>}
 */
export async function parseStructuredCompletion({
  systemPrompt,
  userPrompt,
  schema,
  schemaName = 'structured_response',
  model = env.OPENAI_MODEL,
  temperature = 0.1,
}) {
  const client = getOpenAIClient();

  if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY.includes('...')) {
    throw new AppError(
      'OPENAI_API_KEY is not configured or is a placeholder in .env',
      503,
      'OPENAI_KEY_MISSING',
    );
  }

  try {
    const completion = await client.beta.chat.completions.parse({
      model,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: zodResponseFormat(schema, schemaName),
    });

    const choice = completion.choices[0];
    if (choice?.message?.refusal) {
      throw new AppError(`OpenAI refused to complete request: ${choice.message.refusal}`, 400, 'AI_REFUSAL');
    }

    if (!choice?.message?.parsed) {
      throw new AppError('OpenAI returned empty structured response', 502, 'EMPTY_AI_RESPONSE');
    }

    return {
      parsed: choice.message.parsed,
      model: completion.model || model,
      usage: completion.usage || {},
    };
  } catch (err) {
    if (err instanceof AppError) throw err;

    console.error('[OpenAI] Completion error:', err.message);

    if (err.status === 401 || err.code === 'invalid_api_key') {
      throw new AppError('Invalid OpenAI API key. Check OPENAI_API_KEY in .env', 401, 'INVALID_API_KEY');
    }
    if (err.status === 429) {
      throw new AppError('OpenAI rate limit or quota exceeded. Please retry later.', 429, 'OPENAI_RATE_LIMIT');
    }

    throw new AppError(`OpenAI completion failed: ${err.message}`, 502, 'OPENAI_ERROR');
  }
}


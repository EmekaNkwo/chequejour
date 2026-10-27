/**
 * One guarded request to the language model: build the messages, generate, then check
 * the reply. Features call these instead of the service so no unchecked text slips out.
 */
import { z } from 'zod';
import { AiError } from '../../domain/ai/errors';
import { checkText, parseModelJson, type TextCheck } from '../../domain/ai/guards';
import type { ModelEntry } from '../../domain/ai/manifest';
import { generate, type ChatMessage } from '../../services/ai/llm';

/** Phones write a few tokens a second on the CPU, after reading the prompt. */
const BASE_MS = 25_000;
const PER_TOKEN_MS = 250;

export function llmTimeoutMs(maxTokens: number): number {
  return BASE_MS + maxTokens * PER_TOKEN_MS;
}

export interface AskOptions {
  model: ModelEntry;
  messages: readonly ChatMessage[];
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
  onText?: (soFar: string) => void;
}

/** JSON schema for the runtime's grammar, without the meta keys it does not need. */
export function grammarSchema(schema: z.ZodType): object {
  const { $schema: _meta, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

/** A reply in a fixed JSON shape, parsed and validated; throws AiError('rejected') otherwise. */
export async function askJson<T>(options: AskOptions, schema: z.ZodType<T>): Promise<T> {
  const raw = await generate({ ...options, jsonSchema: grammarSchema(schema), timeoutMs: llmTimeoutMs(options.maxTokens) });
  return parseModelJson(raw, schema);
}

/** A free-text reply that passed the text checks. */
export async function askText(options: AskOptions, check: TextCheck): Promise<string> {
  const raw = await generate({ ...options, timeoutMs: llmTimeoutMs(options.maxTokens) });
  return checkText(raw, check);
}

/** How much warmer the second try is, so it doesn't write the same rejected answer again. */
export const RETRY_TEMPERATURE_STEP = 0.2;

/**
 * Runs `attempt` (given the try number, 0 or 1) and asks once more if the answer failed the
 * checks. The prompt is still in the model's cache, so a retry costs only the writing time.
 */
export async function withRetry<T>(attempt: (tryNumber: number) => Promise<T>, signal?: AbortSignal): Promise<T> {
  try {
    return await attempt(0);
  } catch (e: unknown) {
    if (!(e instanceof AiError) || e.failure !== 'rejected' || signal?.aborted) throw e;
    return attempt(1);
  }
}

import { checkExplanation, EXPLAIN_SCHEMA, explainMessages, fromReply, type ExplainInput, type Explanation } from '../../domain/ai/explain';
import type { ModelEntry } from '../../domain/ai/manifest';
import { askJson, RETRY_TEMPERATURE_STEP, withRetry } from './ask';

/** Explanations should be factual and steady: little randomness. */
const TEMPERATURE = 0.2;
/** Two short sentences and an example need about 90 tokens; this leaves room. */
const MAX_TOKENS = 200;

export async function explainMistake(model: ModelEntry, mistake: ExplainInput, signal?: AbortSignal): Promise<Explanation> {
  return withRetry(async (tryNumber) => {
    const temperature = TEMPERATURE + tryNumber * RETRY_TEMPERATURE_STEP;
    const value = await askJson({ model, messages: explainMessages(mistake), maxTokens: MAX_TOKENS, temperature, signal }, EXPLAIN_SCHEMA);
    return checkExplanation(fromReply(value), mistake);
  }, signal);
}

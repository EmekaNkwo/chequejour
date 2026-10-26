import { checkExplanation, EXPLAIN_SCHEMA, explainMessages, type ExplainInput, type Explanation } from '../../domain/ai/explain';
import type { ModelEntry } from '../../domain/ai/manifest';
import { askJson } from './ask';

/** Explanations should be factual and steady: little randomness. */
const TEMPERATURE = 0.2;
const MAX_TOKENS = 260;

export async function explainMistake(model: ModelEntry, mistake: ExplainInput, signal?: AbortSignal): Promise<Explanation> {
  const value = await askJson({ model, messages: explainMessages(mistake), maxTokens: MAX_TOKENS, temperature: TEMPERATURE, signal }, EXPLAIN_SCHEMA);
  return checkExplanation(value, mistake);
}

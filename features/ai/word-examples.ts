import type { ModelEntry } from '../../domain/ai/manifest';
import { checkWordExamples, WORD_EXAMPLES_SCHEMA, wordExamplesMessages, type ExampleWord, type WordExample } from '../../domain/ai/word-examples';
import { askJson, withRetry } from './ask';

/** Some variety so the sentences differ from each other and from the course. */
const TEMPERATURE = 0.6;
const MAX_TOKENS = 260;

export async function wordExamples(model: ModelEntry, word: ExampleWord, signal?: AbortSignal): Promise<WordExample[]> {
  // Already varied enough: the retry keeps the same temperature.
  return withRetry(async () => {
    const value = await askJson({ model, messages: wordExamplesMessages(word), maxTokens: MAX_TOKENS, temperature: TEMPERATURE, signal }, WORD_EXAMPLES_SCHEMA);
    return checkWordExamples(value, word);
  }, signal);
}

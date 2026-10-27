/**
 * Loads the language model while the learner reads a screen that offers an AI answer, and
 * reads the feature's fixed opening (instructions, worked example) into its cache, so the answer comes sooner.
 */
import { useEffect } from 'react';
import type { ModelEntry } from '../../domain/ai/manifest';
import { fixedPrefix } from '../../domain/ai/prompt-prefix';
import { warmLlm, type ChatMessage } from '../../services/ai/llm';

/** `messages`: the feature's prompt; everything before the learner's message is read ahead. */
export function useWarmLlm(model: ModelEntry | null, messages?: readonly ChatMessage[]): void {
  const prefix = messages ? fixedPrefix(messages) : [];
  const key = `${model?.id ?? ''}|${JSON.stringify(prefix)}`;
  useEffect(() => {
    if (model) warmLlm(model, prefix);
    // Keyed on the model and the opening's text: new objects with the same content must not warm again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

import { checkPartnerReply, conversationMessages, type ConversationTask, type Turn } from '../../domain/ai/conversation';
import type { ModelEntry } from '../../domain/ai/manifest';
import { askText, withRetry } from './ask';

/** A little variety keeps the role-play natural; replies are still checked. */
const TEMPERATURE = 0.7;
const MAX_TOKENS = 110;

export async function partnerReply(model: ModelEntry, task: ConversationTask, turns: readonly Turn[], signal?: AbortSignal, onText?: (soFar: string) => void): Promise<string> {
  // A rejected line would stop the conversation; one more try is quicker than starting over.
  return withRetry(async () => {
    const raw = await askText({ model, messages: conversationMessages(task, turns), maxTokens: MAX_TOKENS, temperature: TEMPERATURE, signal, onText }, { language: 'fr', maxChars: 400 });
    return checkPartnerReply(raw);
  }, signal);
}

import type { ModelEntry } from '../../domain/ai/manifest';
import { checkWritingFeedback, WRITING_FEEDBACK_SCHEMA, writingFeedbackMessages, type WritingFeedback, type WritingFeedbackInput } from '../../domain/ai/writing-feedback';
import { askJson } from './ask';

const TEMPERATURE = 0.2;
const MAX_TOKENS = 600;

export async function writingFeedback(model: ModelEntry, input: WritingFeedbackInput, signal?: AbortSignal): Promise<WritingFeedback> {
  const value = await askJson({ model, messages: writingFeedbackMessages(input), maxTokens: MAX_TOKENS, temperature: TEMPERATURE, signal }, WRITING_FEEDBACK_SCHEMA);
  return checkWritingFeedback(value, input);
}

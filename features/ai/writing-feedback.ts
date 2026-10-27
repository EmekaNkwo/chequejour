import type { ModelEntry } from '../../domain/ai/manifest';
import { checkWritingFeedback, writingFeedbackMessages, writingMaxChars, writingMaxTokens, type CheckedWritingFeedback, type WritingFeedbackInput } from '../../domain/ai/writing-feedback';
import { askText, RETRY_TEMPERATURE_STEP, withRetry } from './ask';

/** Low: the model should copy the text and fix it, not get creative. */
const TEMPERATURE = 0.1;

/** `onText` gets the corrected copy as it is written, for showing finished sentences early. */
export async function writingFeedback(model: ModelEntry, input: WritingFeedbackInput, signal?: AbortSignal, onText?: (soFar: string) => void): Promise<CheckedWritingFeedback> {
  return withRetry(async (tryNumber) => {
    const temperature = TEMPERATURE + tryNumber * RETRY_TEMPERATURE_STEP;
    const messages = writingFeedbackMessages(input);
    const corrected = await askText({ model, messages, maxTokens: writingMaxTokens(input.text), temperature, signal, onText }, { language: 'fr', maxChars: writingMaxChars(input.text) });
    return checkWritingFeedback(corrected, input);
  }, signal);
}

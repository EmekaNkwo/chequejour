import type { ModelEntry } from '../../domain/ai/manifest';
import { checkSpeakingFeedback, fromSpeakingReply, SPEAKING_FEEDBACK_SCHEMA, speakingFeedbackMessages, type CheckedSpeakingFeedback, type SpeakingFeedbackInput } from '../../domain/ai/speaking-feedback';
import { askJson, RETRY_TEMPERATURE_STEP, withRetry } from './ask';

const TEMPERATURE = 0.3;
const MAX_TOKENS = 450;

export async function speakingFeedback(model: ModelEntry, input: SpeakingFeedbackInput, signal?: AbortSignal): Promise<CheckedSpeakingFeedback> {
  return withRetry(async (tryNumber) => {
    const temperature = TEMPERATURE + tryNumber * RETRY_TEMPERATURE_STEP;
    const value = await askJson({ model, messages: speakingFeedbackMessages(input), maxTokens: MAX_TOKENS, temperature, signal }, SPEAKING_FEEDBACK_SCHEMA);
    return checkSpeakingFeedback(fromSpeakingReply(value), input);
  }, signal);
}

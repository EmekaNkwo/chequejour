import type { ModelEntry } from '../../domain/ai/manifest';
import { checkSpeakingFeedback, SPEAKING_FEEDBACK_SCHEMA, speakingFeedbackMessages, type SpeakingFeedback, type SpeakingFeedbackInput } from '../../domain/ai/speaking-feedback';
import { askJson } from './ask';

const TEMPERATURE = 0.3;
const MAX_TOKENS = 450;

export async function speakingFeedback(model: ModelEntry, input: SpeakingFeedbackInput, signal?: AbortSignal): Promise<SpeakingFeedback> {
  const value = await askJson({ model, messages: speakingFeedbackMessages(input), maxTokens: MAX_TOKENS, temperature: TEMPERATURE, signal }, SPEAKING_FEEDBACK_SCHEMA);
  return checkSpeakingFeedback(value, input);
}

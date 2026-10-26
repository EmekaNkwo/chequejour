/**
 * The AI features a learner can switch on or off (Settings → AI pack). AI-generated
 * practice is the riskiest use, so it starts off; the rest start on but only appear
 * once the AI pack is installed.
 */
export interface AiFeatureToggles {
  writing: boolean;
  speaking: boolean;
  conversation: boolean;
  explain: boolean;
  generatedPractice: boolean;
}

export type AiFeature = keyof AiFeatureToggles;

export const DEFAULT_AI_FEATURES: AiFeatureToggles = {
  writing: true,
  speaking: true,
  conversation: true,
  explain: true,
  generatedPractice: false,
};

/** Features that need the language model; speaking feedback needs only Whisper. */
export const LLM_FEATURES: readonly AiFeature[] = ['writing', 'conversation', 'explain', 'generatedPractice'];

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

/** Features that need the language model; speech transcripts need only the phone's recognizer. */
export const LLM_FEATURES: readonly AiFeature[] = ['writing', 'conversation', 'explain', 'generatedPractice'];

export interface InstalledModels {
  /** The phone's on-device French speech recognition is ready. */
  speechReady: boolean;
  llmId: string | null;
  installedIds: readonly string[];
}

/**
 * A feature runs when the learner left it on and what it needs is there. The conversation
 * partner needs only the language model: without speech recognition the learner types.
 */
export function featureReady(feature: AiFeature, toggles: AiFeatureToggles, models: InstalledModels): boolean {
  if (!toggles[feature]) return false;
  if (!LLM_FEATURES.includes(feature)) return models.speechReady;
  return models.llmId !== null && models.installedIds.includes(models.llmId);
}

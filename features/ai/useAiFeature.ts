import { featureReady, type AiFeature } from '../../domain/ai/features';
import type { ModelEntry } from '../../domain/ai/manifest';
import { useApp } from '../app/AppContext';
import { useAiPack } from './useAiPack';

export interface AiFeatureAccess {
  ready: boolean;
  /**
   * The installed language model, when the feature is ready: always set for language-model
   * features; for speaking, set only on phones that also have one (for spoken feedback).
   */
  llm: ModelEntry | null;
}

/** Whether `feature` can run now, and with which model. */
export function useAiFeature(feature: AiFeature): AiFeatureAccess {
  const { settings } = useApp();
  const pack = useAiPack();
  // Speech recognition is checked where it is used (useSpeechAi, the conversation screen); here only the toggle and models count.
  const ready = featureReady(feature, settings.aiFeatures, { speechReady: true, llmId: pack.plan.llm?.id ?? null, installedIds: pack.installedIds });
  const llm = pack.plan.llm && pack.installedIds.includes(pack.plan.llm.id) ? pack.plan.llm : null;
  return { ready, llm: ready ? llm : null };
}

import { featureReady, type AiFeature } from '../../domain/ai/features';
import type { ModelEntry } from '../../domain/ai/manifest';
import { useApp } from '../app/AppContext';
import { useAiPack } from './useAiPack';

export interface AiFeatureAccess {
  ready: boolean;
  /** The language model to use; set whenever `ready` is true for a language-model feature. */
  llm: ModelEntry | null;
}

/** Whether `feature` can run now, and with which model. */
export function useAiFeature(feature: AiFeature): AiFeatureAccess {
  const { settings } = useApp();
  const pack = useAiPack();
  const ready = featureReady(feature, settings.aiFeatures, { sttId: pack.plan.stt.id, llmId: pack.plan.llm?.id ?? null, installedIds: pack.installedIds });
  return { ready, llm: ready ? pack.plan.llm : null };
}

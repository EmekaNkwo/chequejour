import { useEffect, useSyncExternalStore } from 'react';
import { logError } from '../app/log';
import { getState, refresh, subscribe, type AiPackState } from './ai-pack-controller';

/** The AI pack's install state, kept current while the component is mounted. */
export function useAiPack(): AiPackState {
  useEffect(() => {
    refresh().catch((e: unknown) => logError('AI pack state', e));
  }, []);
  return useSyncExternalStore(subscribe, getState);
}

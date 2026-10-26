/** Frees every on-device model's memory, e.g. when the app goes to the background. */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { unloadLlm } from '../../services/ai/llm';
import { unloadStt } from '../../services/ai/stt';
import { logError } from '../app/log';

export async function unloadAllEngines(): Promise<void> {
  await Promise.all([
    unloadStt().catch((e: unknown) => logError('unload speech model', e)),
    unloadLlm().catch((e: unknown) => logError('unload language model', e)),
  ]);
}

/** Unloads the models whenever the app leaves the foreground, so a backgrounded app holds little memory. */
export function useReleaseEnginesInBackground(): void {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') void unloadAllEngines();
    });
    return () => sub.remove();
  }, []);
}

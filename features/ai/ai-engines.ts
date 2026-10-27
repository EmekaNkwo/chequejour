/** Frees the on-device language model's memory, e.g. when the app goes to the background. */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { unloadLlm } from '../../services/ai/llm';
import { logError } from '../app/log';

export async function unloadAllEngines(): Promise<void> {
  await unloadLlm().catch((e: unknown) => logError('unload language model', e));
}

/**
 * How long the app must stay in the background before the models are freed. Android briefly
 * reports "background" while it checks the microphone permission at the start of a
 * recording; unloading then threw both models away just before they were needed.
 */
export const BACKGROUND_UNLOAD_MS = 5_000;

/** Unloads the models once the app has left the foreground, so a backgrounded app holds little memory. */
export function useReleaseEnginesInBackground(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cancel = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const sub = AppState.addEventListener('change', (next) => {
      cancel();
      if (next === 'background') {
        timer = setTimeout(() => {
          timer = null;
          void unloadAllEngines();
        }, BACKGROUND_UNLOAD_MS);
      }
    });
    return () => {
      cancel();
      sub.remove();
    };
  }, []);
}

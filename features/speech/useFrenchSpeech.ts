import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { OfflineSpeechStatus } from '../../domain/offline-speech';
import { logError } from '../app/log';
import { expoSpeechApi, triggerFrenchDownload } from './expo-speech-api';
import { checkOfflineFrench, type SpeechFacts } from './offline-french';

export interface FrenchSpeechApi extends SpeechFacts {
  triggerFrenchDownload: (locale: string) => Promise<void>;
}

export interface FrenchSpeech {
  /** Null while checking. */
  status: OfflineSpeechStatus | null;
  ready: boolean;
  /** The phone can fetch its French model itself (Android 13+). */
  canInstall: boolean;
  install: () => Promise<void>;
}

const INSTALL_LOCALE = 'fr-FR';
const expoFrenchSpeechApi: FrenchSpeechApi = { ...expoSpeechApi, triggerFrenchDownload };

/**
 * Whether the phone's on-device French recognizer is ready, for transcripts and the
 * conversation partner. Checked again whenever the app comes back to the front, since
 * the learner installs French from the phone's settings.
 */
export function useFrenchSpeech(api: FrenchSpeechApi = expoFrenchSpeechApi): FrenchSpeech {
  const [status, setStatus] = useState<OfflineSpeechStatus | null>(null);

  const check = useCallback(
    () =>
      checkOfflineFrench(api)
        .then(setStatus)
        .catch((e: unknown) => {
          logError('french speech check', e);
          setStatus({ status: 'unsupported' });
        }),
    [api],
  );

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  const install = useCallback(async () => {
    try {
      await api.triggerFrenchDownload(INSTALL_LOCALE);
    } catch (e: unknown) {
      logError('french speech download', e);
    }
    await check();
  }, [api, check]);

  const canInstall = status?.status === 'needs-pack' && api.platform === 'android';
  return { status, ready: status?.status === 'ready', canInstall, install };
}

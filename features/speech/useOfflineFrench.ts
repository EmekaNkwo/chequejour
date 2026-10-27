import { useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useEffect, useState } from 'react';
import type { OfflineSpeechStatus } from '../../domain/offline-speech';
import { logError } from '../app/log';
import { expoSpeechApi, stopRecognition } from './expo-speech-api';
import { checkOfflineFrench, startOfflineFrench, type StartResult } from './offline-french';

export interface OfflineFrench {
  /** Null while checking. */
  status: OfflineSpeechStatus | null;
  listening: boolean;
  /** The last final transcript; null before the first try or after reset. */
  heard: string | null;
  error: string | null;
  listen: () => Promise<StartResult>;
  stop: () => void;
  reset: () => void;
}

export function useOfflineFrench(): OfflineFrench {
  const [status, setStatus] = useState<OfflineSpeechStatus | null>(null);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkOfflineFrench(expoSpeechApi)
      .then(setStatus)
      .catch((e: unknown) => {
        logError('offline speech check', e);
        setStatus({ status: 'unsupported' });
      });
  }, []);

  useSpeechRecognitionEvent('result', (e) => {
    if (e.isFinal) setHeard(e.results[0]?.transcript ?? '');
  });
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('error', (e) => {
    setListening(false);
    setError(e.error === 'no-speech' || e.error === 'speech-timeout' ? "Nothing was heard. Try again, a little louder." : 'Speech recognition stopped. Please try again.');
    if (e.error !== 'no-speech' && e.error !== 'speech-timeout') logError('offline speech', e.message);
  });

  const listen = useCallback(async () => {
    setError(null);
    setHeard(null);
    const result = await startOfflineFrench(expoSpeechApi);
    if (result === 'started') setListening(true);
    else if (result === 'unavailable') setStatus(await checkOfflineFrench(expoSpeechApi));
    return result;
  }, []);

  const stop = useCallback(() => {
    try {
      stopRecognition();
    } catch (e: unknown) {
      logError('stop offline speech', e);
    }
  }, []);

  const reset = useCallback(() => {
    setHeard(null);
    setError(null);
  }, []);

  return { status, listening, heard, error, listen, stop, reset };
}

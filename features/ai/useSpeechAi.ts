/**
 * What the phone's on-device recognizer heard in a recording, for shadowing and speaking
 * practice. Ready only when the phone has offline French speech recognition and the
 * learner left speaking feedback on; otherwise screens keep their non-AI behaviour.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { aiFailureOf, type AiFailure } from '../../domain/ai/errors';
import { featureReady } from '../../domain/ai/features';
import { transcribe } from '../../services/ai/stt';
import { useApp } from '../app/AppContext';
import { logError } from '../app/log';
import { recordingUri } from '../skills/recordings';
import { useFrenchSpeech, type FrenchSpeech } from '../speech/useFrenchSpeech';
import type { SavedRecording } from '../speaking/useRecorder';

export type Transcript = { status: 'working' } | { status: 'done'; text: string } | { status: 'failed'; failure: AiFailure };

export interface SpeechAi {
  ready: boolean;
  /** The phone's French recognizer, to offer installing French when it is missing. */
  speech: FrenchSpeech;
  /** The learner left speech feedback on (it may still need French installed). */
  wanted: boolean;
  /** Transcripts by recording file name. */
  transcripts: Readonly<Record<string, Transcript>>;
  /** Transcribes a WAV take in the background; other takes are ignored. */
  request: (take: SavedRecording) => void;
}

export function useSpeechAi(): SpeechAi {
  const { settings } = useApp();
  const speech = useFrenchSpeech();
  const ready = featureReady('speaking', settings.aiFeatures, { speechReady: speech.ready, llmId: null, installedIds: [] });
  const [transcripts, setTranscripts] = useState<Record<string, Transcript>>({});
  const controller = useRef(new AbortController());

  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    return () => current.abort();
  }, []);

  const request = useCallback(
    (take: SavedRecording) => {
      if (!ready || !take.wav) return;
      const set = (t: Transcript) => setTranscripts((all) => ({ ...all, [take.fileName]: t }));
      set({ status: 'working' });
      const signal = controller.current.signal;
      transcribe({ uri: recordingUri(take.fileName), durationMs: take.durationMs, signal })
        .then((text) => {
          if (!signal.aborted) set({ status: 'done', text });
        })
        .catch((e: unknown) => {
          if (signal.aborted) return;
          logError('transcribe recording', e);
          set({ status: 'failed', failure: aiFailureOf(e) });
        });
    },
    [ready],
  );

  return { ready, speech, wanted: settings.aiFeatures.speaking, transcripts, request };
}

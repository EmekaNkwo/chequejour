/**
 * What the speech model heard in a recording, for shadowing and speaking practice. Ready
 * only when the AI pack's speech model is installed and the learner left speaking
 * feedback on; otherwise screens keep their non-AI behaviour.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { aiFailureOf, type AiFailure } from '../../domain/ai/errors';
import { transcribe } from '../../services/ai/stt';
import { useApp } from '../app/AppContext';
import { logError } from '../app/log';
import { recordingUri } from '../skills/recordings';
import type { SavedRecording } from '../speaking/useRecorder';
import { useAiPack } from './useAiPack';

export type Transcript = { status: 'working' } | { status: 'done'; text: string } | { status: 'failed'; failure: AiFailure };

export interface SpeechAi {
  ready: boolean;
  /** Transcripts by recording file name. */
  transcripts: Readonly<Record<string, Transcript>>;
  /** Transcribes a WAV take in the background; other takes are ignored. */
  request: (take: SavedRecording) => void;
}

export function useSpeechAi(): SpeechAi {
  const { settings } = useApp();
  const pack = useAiPack();
  const ready = settings.aiFeatures.speaking && pack.installedIds.includes(pack.plan.stt.id);
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
      transcribe({ model: pack.plan.stt, uri: recordingUri(take.fileName), durationMs: take.durationMs, signal })
        .then((text) => {
          if (!signal.aborted) set({ status: 'done', text });
        })
        .catch((e: unknown) => {
          if (signal.aborted) return;
          logError('transcribe recording', e);
          set({ status: 'failed', failure: aiFailureOf(e) });
        });
    },
    [ready, pack.plan.stt],
  );

  return { ready, transcripts, request };
}

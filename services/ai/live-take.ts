/**
 * A live take: the phone's on-device recognizer listens to the microphone while the
 * learner speaks (and, when asked, keeps the audio in a cache file), so what was said is
 * ready the moment they stop. Like file transcription it only ever runs with a confirmed
 * on-device French model, so audio can't be sent online.
 */
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { AiError } from '../../domain/ai/errors';
import { cleanTranscript } from '../../domain/ai/transcript';
import { expoSpeechApi } from '../../features/speech/expo-speech-api';
import { checkOfflineFrench, type SpeechApi } from '../../features/speech/offline-french';
import { acquireRecognizer } from './recognizer-lock';

/** Errors that only mean nothing was said. */
const SILENCE = new Set(['no-speech', 'speech-timeout']);
/** How long the recognizer may take to start listening. */
const READY_TIMEOUT_MS = 5_000;
/** How long it may take to hand over its last words after stop. */
const STOP_TIMEOUT_MS = 10_000;
/**
 * Told to stop mid-segment, the recognizer drops that segment (the learner's last words)
 * with an error. It closes a segment after a short silence (about 0.6 s here), so on stop
 * it gets this long to close the one the learner just finished.
 */
const SETTLE_MS = 1_500;

export interface LiveEvents {
  /** Listening: from here on, what the learner says is heard. */
  ready: () => void;
  audioStart: (timestamp: number) => void;
  audioEnd: (uri: string | null, timestamp: number) => void;
  result: (transcript: string, isFinal: boolean) => void;
  error: (code: string, message: string) => void;
  end: () => void;
}

/** The parts of the recognizer used for live takes, injectable for tests. */
export interface LiveRecognizerApi extends Omit<SpeechApi, 'start'> {
  startLive: (options: { lang: string; persist: boolean }) => void;
  stop: () => void;
  abort: () => void;
  /** Subscribes to the recognizer's events; returns the unsubscribe. */
  listen: (handlers: LiveEvents) => () => void;
}

export interface LiveResult {
  /** The recording in the cache, when the audio was kept. */
  uri: string | null;
  durationMs: number;
  /** What was heard, tidied; '' when nothing was. */
  transcript: string;
  /** Why recognition failed part-way, if it did. */
  error: string | null;
}

export interface LiveSession {
  /** Stops listening and hands back the take once the recognizer has finished. */
  stop: () => Promise<LiveResult>;
  /** Stops at once, without its last words: for leaving a screen mid-take. Resolves to the cache file to delete, if any. */
  abort: () => Promise<string | null>;
}

export interface LiveOptions {
  /** Keep the audio in a cache file. */
  persist: boolean;
  /** Called when the recognizer stops on its own (an error), not because of stop(). */
  onEnd?: () => void;
}

/** Starts a live take; resolves once the recognizer is listening. */
export async function startLiveTake(api: LiveRecognizerApi, { persist, onEnd }: LiveOptions): Promise<LiveSession> {
  const status = await checkOfflineFrench(api);
  if (status.status !== 'ready') throw new AiError('unavailable', 'On-device French speech recognition is not available on this phone.');
  if (!(await api.requestPermissions())) throw new AiError('unavailable', 'Speech recognition is not allowed.');
  const release = await acquireRecognizer();

  const parts: string[] = [];
  let error: string | null = null;
  let audio = { uri: null as string | null, start: 0, end: 0 };
  let stopping = false;
  let ended = false;
  let segmentClosed: () => void = () => undefined;
  let markReady: () => void = () => undefined;
  let failStart: (e: AiError) => void = () => undefined;
  let markEnded: () => void = () => undefined;
  const endedPromise = new Promise<void>((resolve) => {
    markEnded = resolve;
  });

  const cleanUp = () => {
    if (ended) return;
    ended = true;
    unsubscribe();
    release();
    markEnded();
    segmentClosed();
  };
  const unsubscribe = api.listen({
    ready: () => markReady(),
    audioStart: (timestamp) => {
      audio = { ...audio, start: timestamp };
    },
    audioEnd: (uri, timestamp) => {
      audio = { ...audio, uri, end: timestamp };
    },
    result: (transcript, isFinal) => {
      if (!isFinal) return;
      parts.push(transcript);
      segmentClosed();
    },
    error: (code, message) => {
      // Once told to stop, the error is about the unfinished segment; what was said is in.
      if (SILENCE.has(code) || stopping) return;
      error = message || code;
      failStart(new AiError('failed', error));
    },
    end: () => {
      const early = !stopping;
      failStart(new AiError('failed', error ?? 'Speech recognition stopped before it started.'));
      cleanUp();
      if (early) onEnd?.();
    },
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new AiError('timeout', 'Speech recognition did not start.')), READY_TIMEOUT_MS);
      markReady = () => {
        clearTimeout(timer);
        resolve();
      };
      failStart = (e) => {
        clearTimeout(timer);
        reject(e);
      };
      api.startLive({ lang: status.locale, persist });
    });
  } catch (e: unknown) {
    stopping = true;
    if (!ended) api.abort();
    cleanUp();
    throw e instanceof AiError ? e : new AiError('failed', e instanceof Error ? e.message : 'Speech recognition could not start.');
  } finally {
    failStart = () => undefined;
  }

  const result = (): LiveResult => ({
    uri: audio.uri,
    durationMs: audio.start > 0 && audio.end > audio.start ? Math.round(audio.end - audio.start) : 0,
    transcript: cleanTranscript(parts.join(' ')),
    error,
  });

  /** Asks the recognizer to finish, and waits until it has (or gives up waiting). */
  const finish = async (action: () => void): Promise<LiveResult> => {
    if (!ended) {
      stopping = true;
      action();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const late = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, STOP_TIMEOUT_MS);
      });
      await Promise.race([endedPromise, late]);
      clearTimeout(timer);
      if (!ended) {
        api.abort();
        cleanUp();
      }
    }
    return result();
  };

  /** Waits for the segment under way to close, or a moment. */
  const settle = async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    await new Promise<void>((resolve) => {
      segmentClosed = resolve;
      timer = setTimeout(resolve, SETTLE_MS);
    });
    clearTimeout(timer);
    segmentClosed = () => undefined;
  };

  return {
    stop: async () => {
      if (!ended) await settle();
      return finish(() => api.stop());
    },
    abort: async () => (await finish(() => api.abort())).uri,
  };
}

export const expoLiveRecognizer: LiveRecognizerApi = {
  ...expoSpeechApi,
  startLive: ({ lang, persist }) =>
    ExpoSpeechRecognitionModule.start({
      lang,
      // Never the network recognizer: the availability check above confirmed an on-device model.
      requiresOnDeviceRecognition: true,
      interimResults: false,
      maxAlternatives: 1,
      // A speaking take has pauses; keep listening until the learner stops.
      continuous: true,
      recordingOptions: { persist },
    }),
  stop: () => ExpoSpeechRecognitionModule.stop(),
  abort: () => ExpoSpeechRecognitionModule.abort(),
  listen: ({ ready, audioStart, audioEnd, result, error, end }) => {
    const subs = [
      ExpoSpeechRecognitionModule.addListener('start', () => ready()),
      ExpoSpeechRecognitionModule.addListener('audiostart', (e) => audioStart(e.timestamp)),
      ExpoSpeechRecognitionModule.addListener('audioend', (e) => audioEnd(e.uri, e.timestamp)),
      ExpoSpeechRecognitionModule.addListener('result', (e) => result(e.results[0]?.transcript ?? '', e.isFinal)),
      ExpoSpeechRecognitionModule.addListener('error', (e) => error(e.error, e.message)),
      ExpoSpeechRecognitionModule.addListener('end', () => end()),
    ];
    return () => subs.forEach((s) => s.remove());
  },
};

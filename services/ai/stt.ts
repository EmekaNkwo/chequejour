/**
 * French speech-to-text for recordings, using the phone's own on-device recognizer
 * (Apple's on iPhone, Google's on Android 13+). Nothing is downloaded by the app and, like the live
 * check, it only ever runs with a confirmed on-device French model, so audio can't be
 * sent online. The phone has one recognizer, so recordings are transcribed one at a time.
 */
import { AudioEncodingAndroid, ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { AiError } from '../../domain/ai/errors';
import { cleanTranscript, sttTimeoutMs } from '../../domain/ai/transcript';
import { expoSpeechApi } from '../../features/speech/expo-speech-api';
import { checkOfflineFrench, type SpeechApi } from '../../features/speech/offline-french';

/** Errors that only mean nothing was said. */
const SILENCE = new Set(['no-speech', 'speech-timeout']);
const SAMPLE_RATE = 16_000;

export interface RecognizerEvents {
  result: (transcript: string, isFinal: boolean) => void;
  error: (code: string, message: string) => void;
  end: () => void;
}

/** The parts of the recognizer used for files, injectable for tests. */
export interface FileRecognizerApi extends Omit<SpeechApi, 'start'> {
  startFile: (options: { lang: string; uri: string }) => void;
  abort: () => void;
  /** Subscribes to the recognizer's events; returns the unsubscribe. */
  listen: (handlers: RecognizerEvents) => () => void;
}

export interface TranscribeRequest {
  /** A 16 kHz mono 16-bit WAV file. */
  uri: string;
  durationMs: number;
  signal?: AbortSignal;
}

let queue: Promise<unknown> = Promise.resolve();

/** What was said in the recording, tidied; '' when nothing was heard. */
export function transcribeFile(api: FileRecognizerApi, request: TranscribeRequest): Promise<string> {
  const job = queue.then(() => runOnce(api, request));
  queue = job.catch(() => undefined);
  return job;
}

async function runOnce(api: FileRecognizerApi, { uri, durationMs, signal }: TranscribeRequest): Promise<string> {
  if (signal?.aborted) throw new AiError('cancelled', 'Cancelled before it started.');
  const status = await checkOfflineFrench(api);
  if (status.status !== 'ready') throw new AiError('unavailable', 'On-device French speech recognition is not available on this phone.');
  if (!(await api.requestPermissions())) throw new AiError('unavailable', 'Speech recognition is not allowed.');
  return new Promise<string>((resolve, reject) => {
    const parts: string[] = [];
    let settled = false;
    const finish = (outcome: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      unsubscribe();
      outcome();
    };
    const stop = (error: AiError) => {
      api.abort();
      finish(() => reject(error));
    };
    const onAbort = () => stop(new AiError('cancelled', 'Cancelled.'));
    const timer = setTimeout(() => stop(new AiError('timeout', `No transcript within ${Math.round(sttTimeoutMs(durationMs) / 1000)} s.`)), sttTimeoutMs(durationMs));
    const unsubscribe = api.listen({
      result: (transcript, isFinal) => {
        if (isFinal) parts.push(transcript);
      },
      error: (code, message) => {
        if (SILENCE.has(code)) return;
        finish(() => reject(new AiError('failed', message || code)));
      },
      end: () => finish(() => resolve(cleanTranscript(parts.join(' ')))),
    });
    signal?.addEventListener('abort', onAbort);
    try {
      api.startFile({ lang: status.locale, uri });
    } catch (e: unknown) {
      finish(() => reject(new AiError('failed', e instanceof Error ? e.message : 'Speech recognition could not start.')));
    }
  });
}

const expoFileRecognizer: FileRecognizerApi = {
  ...expoSpeechApi,
  startFile: ({ lang, uri }) =>
    ExpoSpeechRecognitionModule.start({
      lang,
      // Never the network recognizer: the availability check above confirmed an on-device model.
      requiresOnDeviceRecognition: true,
      interimResults: false,
      maxAlternatives: 1,
      // A speaking take has pauses; keep going to the end of the file.
      continuous: true,
      audioSource: { uri, audioChannels: 1, audioEncoding: AudioEncodingAndroid.ENCODING_PCM_16BIT, sampleRate: SAMPLE_RATE },
    }),
  abort: () => ExpoSpeechRecognitionModule.abort(),
  listen: ({ result, error, end }) => {
    const subs = [
      ExpoSpeechRecognitionModule.addListener('result', (e) => result(e.results[0]?.transcript ?? '', e.isFinal)),
      ExpoSpeechRecognitionModule.addListener('error', (e) => error(e.error, e.message)),
      ExpoSpeechRecognitionModule.addListener('end', () => end()),
    ];
    return () => subs.forEach((s) => s.remove());
  },
};

/** Transcribes a recording with the phone's on-device recognizer. */
export function transcribe(request: TranscribeRequest): Promise<string> {
  return transcribeFile(expoFileRecognizer, request);
}

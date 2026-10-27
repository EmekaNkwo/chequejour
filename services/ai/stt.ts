/**
 * French speech-to-text for recordings, using the phone's own on-device recognizer
 * (Apple's on iPhone, Google's on Android 13+). Nothing is downloaded by the app and, like the live
 * check, it only ever runs with a confirmed on-device French model, so audio can't be
 * sent online. Used when a live take could not start; the phone has one recognizer, so
 * recordings are transcribed one at a time.
 */
import { File, Paths } from 'expo-file-system';
import { AudioEncodingAndroid, ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { AiError } from '../../domain/ai/errors';
import { cleanTranscript, sttTimeoutMs } from '../../domain/ai/transcript';
import { withLeadingSilence } from '../../domain/ai/wav';
import { expoSpeechApi } from '../../features/speech/expo-speech-api';
import { checkOfflineFrench, type SpeechApi } from '../../features/speech/offline-french';
import { acquireRecognizer } from './recognizer-lock';

/** Errors that only mean nothing was said. */
const SILENCE = new Set(['no-speech', 'speech-timeout']);
const SAMPLE_RATE = 16_000;
/**
 * The file is fed to the recognizer from the moment it is asked to listen, and a
 * recognizer that is still starting drops what arrives: often the learner's first words.
 * It drops this silence instead.
 */
const LEAD_IN_MS = 5_000;
/**
 * Pause per 4 KB fed (about 130 ms of audio). The library's 15 ms for on-device recognition
 * gets through the lead-in in about half a second, before the recognizer is listening;
 * 50 ms stretches it to about two seconds.
 */
const CHUNK_DELAY_MS = 50;

export interface RecognizerEvents {
  result: (transcript: string, isFinal: boolean) => void;
  error: (code: string, message: string) => void;
  end: () => void;
}

/** The parts of the recognizer used for files, injectable for tests. */
export interface FileRecognizerApi extends Omit<SpeechApi, 'start'> {
  startFile: (options: { lang: string; uri: string }) => void;
  abort: () => void;
  /** The file to hand the recognizer, and how to clean it up afterwards. */
  prepare: (uri: string) => Promise<{ uri: string; dispose: () => void }>;
  /** Subscribes to the recognizer's events; returns the unsubscribe. */
  listen: (handlers: RecognizerEvents) => () => void;
}

export interface TranscribeRequest {
  /** A 16 kHz mono 16-bit WAV file. */
  uri: string;
  durationMs: number;
  signal?: AbortSignal;
}

/** What was said in the recording, tidied; '' when nothing was heard. */
export async function transcribeFile(api: FileRecognizerApi, request: TranscribeRequest): Promise<string> {
  const release = await acquireRecognizer();
  try {
    return await runOnce(api, request);
  } finally {
    release();
  }
}

async function runOnce(api: FileRecognizerApi, { uri, durationMs, signal }: TranscribeRequest): Promise<string> {
  if (signal?.aborted) throw new AiError('cancelled', 'Cancelled before it started.');
  const status = await checkOfflineFrench(api);
  if (status.status !== 'ready') throw new AiError('unavailable', 'On-device French speech recognition is not available on this phone.');
  if (!(await api.requestPermissions())) throw new AiError('unavailable', 'Speech recognition is not allowed.');
  const input = await api.prepare(uri);
  try {
    return await listenToFile(api, status.locale, input.uri, durationMs, signal);
  } finally {
    input.dispose();
  }
}

function listenToFile(api: FileRecognizerApi, lang: string, uri: string, durationMs: number, signal: AbortSignal | undefined): Promise<string> {
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
      api.startFile({ lang, uri });
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
      audioSource: { uri, audioChannels: 1, audioEncoding: AudioEncodingAndroid.ENCODING_PCM_16BIT, sampleRate: SAMPLE_RATE, chunkDelayMillis: CHUNK_DELAY_MS },
    }),
  abort: () => ExpoSpeechRecognitionModule.abort(),
  prepare: async (uri) => {
    const padded = new File(Paths.cache, `speech-input-${Date.now()}.wav`);
    padded.create({ overwrite: true });
    await padded.write(withLeadingSilence(await new File(uri).bytes(), LEAD_IN_MS));
    return {
      uri: padded.uri,
      dispose: () => {
        try {
          padded.delete();
        } catch {
          // A cache file; the system clears it too.
        }
      },
    };
  },
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

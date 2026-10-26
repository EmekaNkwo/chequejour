/**
 * Records the microphone as 16 kHz mono PCM for the speech model and writes it out as a
 * WAV file in the cache. The native recorder only streams base64 chunks; they are kept
 * in memory (about 32 KB a second) and written once recording stops.
 */
import AudioRecord from '@fugood/react-native-audio-pcm-stream';
import { File, Paths } from 'expo-file-system';
import type { EmitterSubscription } from 'react-native';
import { WAV_FORMAT, WAV_HEADER_BYTES, base64ToBytes, buildWav, pcmDurationMs } from '../../domain/ai/wav';

/** Android's VOICE_RECOGNITION source: tuned for speech, without call-style processing. */
const VOICE_RECOGNITION = 6;
/** The native thread may still hand over a last chunk just after stop. */
const LAST_CHUNK_MS = 150;

export interface PcmRecording {
  uri: string;
  durationMs: number;
}

let chunks: Uint8Array[] = [];
let subscription: EmitterSubscription | null = null;
/** A stop already under way, so overlapping callers share it instead of racing. */
let stopping: Promise<Uint8Array[] | null> | null = null;

export async function startPcm(): Promise<void> {
  if (subscription) await discardPcm();
  chunks = [];
  await AudioRecord.init({ ...WAV_FORMAT, audioSource: VOICE_RECOGNITION, wavFile: '' });
  subscription = AudioRecord.on('data', (base64) => {
    // A private buffer that grows many times a second: appended in place, not copied.
    chunks.push(base64ToBytes(base64));
  });
  try {
    AudioRecord.start();
  } catch (e: unknown) {
    subscription.remove();
    subscription = null;
    throw e;
  }
}

export function isPcmRecording(): boolean {
  return subscription !== null;
}

/** Stops the microphone and hands back what was recorded (once, whoever asks first). */
function stopCapture(): Promise<Uint8Array[] | null> {
  if (stopping) return stopping;
  const current = subscription;
  if (!current) return Promise.resolve(null);
  stopping = (async () => {
    try {
      await AudioRecord.stop();
      await new Promise((resolve) => setTimeout(resolve, LAST_CHUNK_MS));
    } finally {
      current.remove();
      subscription = null;
    }
    const recorded = chunks;
    chunks = [];
    return recorded;
  })().finally(() => {
    stopping = null;
  });
  return stopping;
}

/** Stops and writes the WAV file; null when nothing was recorded. */
export async function stopPcm(now: number = Date.now()): Promise<PcmRecording | null> {
  const recorded = await stopCapture();
  if (!recorded || recorded.length === 0) return null;
  const wav = buildWav(recorded);
  const file = new File(Paths.cache, `speech-${now}.wav`);
  file.create({ overwrite: true });
  await file.write(wav);
  return { uri: file.uri, durationMs: pcmDurationMs(wav.length - WAV_HEADER_BYTES) };
}

/** Stops without writing anything: for leaving a screen mid-recording. */
export async function discardPcm(): Promise<void> {
  await stopCapture();
}

/** Deletes a recording file from the cache; never throws. */
export function deleteTake(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Cache files are cleared by the system too; a failed delete is not worth an error.
  }
}

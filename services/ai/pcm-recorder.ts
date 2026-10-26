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

export async function startPcm(): Promise<void> {
  chunks = [];
  await AudioRecord.init({ ...WAV_FORMAT, audioSource: VOICE_RECOGNITION, wavFile: '' });
  subscription?.remove();
  subscription = AudioRecord.on('data', (base64) => {
    // A private buffer that grows many times a second: appended in place, not copied.
    chunks.push(base64ToBytes(base64));
  });
  AudioRecord.start();
}

export function isPcmRecording(): boolean {
  return subscription !== null;
}

/** Stops and writes the WAV file; null when nothing was recorded. */
export async function stopPcm(now: number = Date.now()): Promise<PcmRecording | null> {
  if (!subscription) return null;
  await AudioRecord.stop();
  await new Promise((resolve) => setTimeout(resolve, LAST_CHUNK_MS));
  subscription.remove();
  subscription = null;
  const recorded = chunks;
  chunks = [];
  if (recorded.length === 0) return null;
  const wav = buildWav(recorded);
  const file = new File(Paths.cache, `speech-${now}.wav`);
  file.create({ overwrite: true });
  await file.write(wav);
  return { uri: file.uri, durationMs: pcmDurationMs(wav.length - WAV_HEADER_BYTES) };
}

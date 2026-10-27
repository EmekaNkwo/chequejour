/**
 * A take for speech recognition: recognised live when the phone allows it, so what was
 * said is ready the moment the learner stops. When live recognition can't start, it falls
 * back to recording a 16 kHz WAV file that is transcribed afterwards.
 */
import { logError } from '../../features/app/log';
import { expoLiveRecognizer, startLiveTake, type LiveSession } from './live-take';
import { deleteTake, discardPcm, startPcm, stopPcm } from './pcm-recorder';

export interface SpeechTake {
  /** The recording in the cache; null when the audio wasn't kept. */
  uri: string | null;
  durationMs: number;
  /** What was heard; null when the file still needs transcribing. */
  transcript: string | null;
}

export interface SpeechTakeOptions {
  /** Keep the audio in a cache file (a saved try); otherwise only the words are kept. */
  keepAudio: boolean;
  /** Called if live recognition stops on its own mid-take. */
  onEnd?: () => void;
}

type Current = { kind: 'live'; session: LiveSession; startedAt: number } | { kind: 'file' } | null;

let current: Current = null;

export function isSpeechTakeRecording(): boolean {
  return current !== null;
}

export async function startSpeechTake({ keepAudio, onEnd }: SpeechTakeOptions): Promise<void> {
  if (current) await discardSpeechTake();
  try {
    const session = await startLiveTake(expoLiveRecognizer, { persist: keepAudio, onEnd });
    current = { kind: 'live', session, startedAt: Date.now() };
  } catch (e: unknown) {
    logError('live speech take, recording a file instead', e);
    await startPcm();
    current = { kind: 'file' };
  }
}

/** Stops and hands back the take; null when nothing was recording. */
export async function stopSpeechTake(): Promise<SpeechTake | null> {
  const take = current;
  current = null;
  if (!take) return null;
  if (take.kind === 'file') {
    const file = await stopPcm();
    return file && { uri: file.uri, durationMs: file.durationMs, transcript: null };
  }
  const result = await take.session.stop();
  // Recognition broke part-way and heard nothing: the file, if kept, can still be transcribed.
  const failed = result.error !== null && result.transcript === '' && result.uri !== null;
  return {
    uri: result.uri,
    durationMs: result.durationMs || Date.now() - take.startedAt,
    transcript: failed ? null : result.transcript,
  };
}

/** Stops without keeping anything: for leaving a screen mid-take. */
export async function discardSpeechTake(): Promise<void> {
  const take = current;
  current = null;
  if (!take) return;
  if (take.kind === 'file') {
    await discardPcm();
    return;
  }
  const uri = await take.session.abort();
  if (uri) deleteTake(uri);
}

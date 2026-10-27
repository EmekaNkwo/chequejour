/**
 * One shared audio output for the whole app. Bundled clips play through a single
 * expo-audio player; when a clip is missing, the same text is read by the device's
 * French text-to-speech voice. Only one thing plays at a time.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import * as Speech from 'expo-speech';
import { AUDIO_CLIPS } from '../../content/build/audio-manifest';
import { DEFAULT_RATE, type PlaybackRate } from '../../domain/playback';
import { logError } from '../app/log';

export interface PlaybackState {
  key: string | null;
  playing: boolean;
  /** 0–1 for clips; TTS jumps from 0 to 1 when it finishes. */
  progress: number;
  source: 'clip' | 'tts' | null;
}

export interface PlayOptions {
  rate?: PlaybackRate;
  onFinish?: (key: string) => void;
}

type Listener = (state: PlaybackState) => void;

let player: AudioPlayer | null = null;
let state: PlaybackState = { key: null, playing: false, progress: 0, source: null };
let finishCallback: ((key: string) => void) | undefined;
/** Bumped on every play/stop so callbacks from an earlier sound are ignored. */
let generation = 0;
/** What is playing, so a speed change can restart text-to-speech. */
let current: { key: string; text: string; rate: PlaybackRate } | null = null;
const listeners = new Set<Listener>();

function emit(next: Partial<PlaybackState>): void {
  state = { ...state, ...next };
  listeners.forEach((l) => l(state));
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function hasClip(key: string): boolean {
  return AUDIO_CLIPS[key] !== undefined;
}

let modeSet = false;
async function ensureMode(): Promise<void> {
  if (modeSet) return;
  modeSet = true;
  await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' }).catch((e: unknown) => logError('audio mode', e));
}

function finished(key: string): void {
  emit({ playing: false, progress: 1 });
  const cb = finishCallback;
  finishCallback = undefined;
  cb?.(key);
}

/** The clip generation the player's status events belong to. */
let clipGeneration = 0;

function onStatus(status: AudioStatus): void {
  if (state.source !== 'clip' || !state.key || clipGeneration !== generation) return;
  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : state.progress;
  if (status.didJustFinish) {
    finished(state.key);
  } else {
    emit({ playing: status.playing, progress });
  }
}

function getPlayer(): AudioPlayer {
  if (!player) {
    player = createAudioPlayer(null, { updateInterval: 250 });
    player.addListener('playbackStatusUpdate', onStatus);
  }
  return player;
}

/**
 * Sets the audio mode and creates the player ahead of the first play, so that work can
 * overlap with other start-up work (the widget's background task reads settings meanwhile).
 */
export async function warmUp(): Promise<void> {
  getPlayer();
  await ensureMode();
}

export async function stop(): Promise<void> {
  generation += 1;
  finishCallback = undefined;
  if (state.source === 'clip') player?.pause();
  if (state.source === 'tts') await Speech.stop();
  emit({ playing: false });
}

/** Plays the clip for `key`, or speaks `text` if the clip isn't bundled. */
export async function play(key: string, text: string, options: PlayOptions = {}): Promise<void> {
  await stop();
  await ensureMode();
  const mine = ++generation;
  const isCurrent = () => mine === generation;
  finishCallback = options.onFinish;
  const rate = options.rate ?? DEFAULT_RATE;
  current = { key, text, rate };
  const clip = AUDIO_CLIPS[key];
  try {
    if (clip !== undefined) {
      const p = getPlayer();
      clipGeneration = mine;
      emit({ key, playing: true, progress: 0, source: 'clip' });
      p.replace(clip);
      p.setPlaybackRate(rate, 'high');
      await p.seekTo(0);
      p.play();
      return;
    }
    emit({ key, playing: true, progress: 0, source: 'tts' });
    Speech.speak(text, {
      language: 'fr-FR',
      rate,
      onDone: () => {
        if (isCurrent()) finished(key);
      },
      onStopped: () => {
        if (isCurrent()) emit({ playing: false });
      },
      onError: (error) => {
        logError('tts', error);
        if (isCurrent()) emit({ playing: false });
      },
    });
  } catch (error: unknown) {
    logError('audio play', error);
    emit({ playing: false });
  }
}

/**
 * Changes the speed of what is playing now. Clips change in place; text-to-speech
 * can't change mid-sentence, so it starts the sentence again at the new speed.
 */
export async function setRate(rate: PlaybackRate): Promise<void> {
  if (!current || !state.playing || current.rate === rate) return;
  if (state.source === 'clip') {
    current = { ...current, rate };
    player?.setPlaybackRate(rate, 'high');
    return;
  }
  const onFinish = finishCallback;
  await play(current.key, current.text, { rate, onFinish });
}

/** Whether the device has a French TTS voice, for the fallback notice in settings. */
export async function hasFrenchVoice(): Promise<boolean> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices.some((v) => v.language.toLowerCase().startsWith('fr'));
  } catch {
    return false;
  }
}

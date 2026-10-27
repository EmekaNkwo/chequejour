import { useEffect, useState } from 'react';
import { useApp } from '../app/AppContext';
import type { PlaybackRate } from '../../domain/playback';
import { logError } from '../app/log';
import { play, setRate, stop, subscribe, type PlaybackState, type PlayOptions } from './audio-controller';

export function usePlayback(): PlaybackState {
  const [state, setState] = useState<PlaybackState>({ key: null, playing: false, progress: 0, source: null });
  useEffect(() => subscribe(setState), []);
  return state;
}

export interface Speaker {
  state: PlaybackState;
  isPlaying: (key: string) => boolean;
  /** Plays at the speed chosen in settings unless `rate` is given. */
  speak: (key: string, text: string, options?: PlayOptions) => void;
  stop: () => void;
  rate: PlaybackRate;
  /** Saves the speed for all audio and applies it to what is playing now. */
  changeRate: (rate: PlaybackRate) => void;
}

export function useSpeaker(): Speaker {
  const { settings, updateSetting } = useApp();
  const state = usePlayback();
  useEffect(() => () => void stop(), []);
  return {
    state,
    isPlaying: (key) => state.playing && state.key === key,
    speak: (key, text, options) => void play(key, text, { rate: options?.rate ?? settings.playbackRate, onFinish: options?.onFinish }),
    stop: () => void stop(),
    rate: settings.playbackRate,
    changeRate: (rate) => {
      setRate(rate).catch((e: unknown) => logError('playback rate', e));
      updateSetting('playbackRate', rate).catch((e: unknown) => logError('save playback rate', e));
    },
  };
}

/** Auto-plays once when a screen opens, if enabled in settings. */
export function useAutoPlay(key: string | null, text: string | null): void {
  const { settings } = useApp();
  useEffect(() => {
    if (!settings.autoPlay || !key || !text) return;
    const t = setTimeout(() => void play(key, text, { rate: settings.playbackRate }), 350);
    return () => clearTimeout(t);
    // The speed is read when the screen opens; changing it later shouldn't replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, text, settings.autoPlay]);
}

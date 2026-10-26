/**
 * Microphone recording for speaking practice, shared by the speaking task screen, the
 * mock speaking test and shadowing. Files are saved on the phone only.
 */
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import type { ProgressRepository } from '../../data/progress-repo';
import { isPcmRecording, startPcm, stopPcm } from '../../services/ai/pcm-recorder';
import { logError } from '../app/log';
import { stop as stopSharedAudio } from '../audio/audio-controller';
import { recordingUri, saveRecording } from '../skills/recordings';

export interface Recorder {
  /** null until permission has been asked. */
  micAllowed: boolean | null;
  isRecording: boolean;
  busy: boolean;
  askPermission: () => Promise<boolean>;
  /** Starts recording; false when the microphone isn't available. */
  start: () => Promise<boolean>;
  /** Stops and saves under `taskId`; null when nothing was recording. */
  stopAndSave: (progress: ProgressRepository, taskId: string) => Promise<SavedRecording | null>;
}

export interface SavedRecording {
  fileName: string;
  durationMs: number;
  /** True when saved as 16 kHz WAV, which the speech model can read. */
  wav: boolean;
}

export interface RecorderOptions {
  /** Record 16 kHz WAV for the speech model instead of compressed audio. */
  wav?: boolean;
}

const idleMode = () => setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

export function useRecorder({ wav = false }: RecorderOptions = {}): Recorder {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 500);
  // The format is fixed when a recording starts, even if the AI pack changes meanwhile.
  const wavTake = useRef(false);
  const [pcmRecording, setPcmRecording] = useState(false);
  const [micAllowed, setMicAllowed] = useState<boolean | null>(null);
  // State lags a render behind; callers often ask and then start in the same handler.
  const allowedRef = useRef<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const starting = useRef<Promise<boolean>>(Promise.resolve(false));
  const startedAt = useRef(0);

  useEffect(
    () => () => {
      if (recorder.isRecording) recorder.stop().catch((e: unknown) => logError('stop recording on leave', e));
      if (isPcmRecording()) stopPcm().catch((e: unknown) => logError('stop WAV recording on leave', e));
      idleMode().catch((e: unknown) => logError('audio mode on leave', e));
    },
    [recorder],
  );

  const askPermission = async (): Promise<boolean> => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      allowedRef.current = permission.granted;
      setMicAllowed(permission.granted);
      return permission.granted;
    } catch (error: unknown) {
      logError('mic permission', error);
      allowedRef.current = false;
      setMicAllowed(false);
      return false;
    }
  };

  const start = async (): Promise<boolean> => {
    const allowed = allowedRef.current ?? (await askPermission());
    if (!allowed) return false;
    starting.current = (async () => {
      try {
        await stopSharedAudio();
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        wavTake.current = wav;
        if (wav) {
          await startPcm();
          setPcmRecording(true);
        } else {
          await recorder.prepareToRecordAsync();
          recorder.record();
        }
        startedAt.current = Date.now();
        return true;
      } catch (error: unknown) {
        logError('start recording', error);
        return false;
      }
    })();
    return starting.current;
  };

  const stopAndSave = async (progress: ProgressRepository, taskId: string) => {
    // Stop can be tapped while the recorder is still starting; wait so it isn't left running.
    await starting.current;
    if (wavTake.current) return stopWav(progress, taskId);
    if (!recorder.isRecording && !state.isRecording) return null;
    setBusy(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      const durationMs = Math.max(state.durationMillis, Date.now() - startedAt.current);
      if (!uri) return null;
      const fileName = await saveRecording(progress, taskId, uri, durationMs, Date.now());
      return { fileName, durationMs, wav: false };
    } finally {
      await idleMode().catch((e: unknown) => logError('audio mode', e));
      setBusy(false);
    }
  };

  const stopWav = async (progress: ProgressRepository, taskId: string): Promise<SavedRecording | null> => {
    if (!isPcmRecording()) return null;
    setBusy(true);
    try {
      const take = await stopPcm();
      if (!take) return null;
      const fileName = await saveRecording(progress, taskId, take.uri, take.durationMs, Date.now());
      return { fileName, durationMs: take.durationMs, wav: true };
    } finally {
      setPcmRecording(false);
      await idleMode().catch((e: unknown) => logError('audio mode', e));
      setBusy(false);
    }
  };

  return { micAllowed, isRecording: state.isRecording || pcmRecording, busy, askPermission, start, stopAndSave };
}

export interface RecordingPlayer {
  /** Key of what is playing, if anything. */
  playingKey: string | null;
  /** Plays a stored recording (file name) under `key`; tapping the same key again pauses. */
  toggle: (key: string, stored: string) => void;
  /** Plays a stored recording and resolves when it ends. */
  playToEnd: (key: string, stored: string) => Promise<void>;
  stop: () => void;
}

export function useRecordingPlayer(): RecordingPlayer {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [key, setKey] = useState<string | null>(null);
  const ended = useRef<(() => void) | null>(null);
  const playingKey = status.playing ? key : null;

  useEffect(() => {
    if (status.didJustFinish && ended.current) {
      const done = ended.current;
      ended.current = null;
      done();
    }
  }, [status.didJustFinish]);

  const playFile = async (k: string, stored: string) => {
    await stopSharedAudio();
    player.replace({ uri: recordingUri(stored) });
    await player.seekTo(0);
    player.play();
    setKey(k);
  };

  return {
    playingKey,
    toggle: (k, stored) => {
      if (playingKey === k) {
        player.pause();
        setKey(null);
        return;
      }
      playFile(k, stored).catch((e: unknown) => logError('play recording', e));
    },
    playToEnd: (k, stored) =>
      new Promise<void>((resolve) => {
        ended.current = resolve;
        playFile(k, stored).catch((e: unknown) => {
          logError('play recording', e);
          ended.current = null;
          resolve();
        });
      }),
    stop: () => {
      player.pause();
      setKey(null);
      if (ended.current) {
        const done = ended.current;
        ended.current = null;
        done();
      }
    },
  };
}

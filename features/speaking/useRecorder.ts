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
import { deleteTake } from '../../services/ai/pcm-recorder';
import { discardSpeechTake, isSpeechTakeRecording, startSpeechTake, stopSpeechTake } from '../../services/ai/speech-take';
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
  /** True when saved as 16 kHz WAV, which the phone's recognizer can read. */
  wav: boolean;
  /** What the recognizer heard while recording; null when it still has to be transcribed (or wasn't asked). */
  transcript: string | null;
}

export interface RecorderOptions {
  /** Record for speech recognition (recognised live, or as 16 kHz WAV) instead of compressed audio. */
  speech?: boolean;
}

const idleMode = () => setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

export function useRecorder({ speech = false }: RecorderOptions = {}): Recorder {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 500);
  // The kind of take is fixed when a recording starts, even if settings change meanwhile.
  const speechTake = useRef(false);
  const [speechRecording, setSpeechRecording] = useState(false);
  const unmounted = useRef(false);
  const [micAllowed, setMicAllowed] = useState<boolean | null>(null);
  // State lags a render behind; callers often ask and then start in the same handler.
  const allowedRef = useRef<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const starting = useRef<Promise<boolean>>(Promise.resolve(false));
  const startedAt = useRef(0);

  useEffect(() => {
    unmounted.current = false;
    return () => {
      if (recorder.isRecording) recorder.stop().catch((e: unknown) => logError('stop recording on leave', e));
      unmounted.current = true;
      if (isSpeechTakeRecording()) discardSpeechTake().catch((e: unknown) => logError('stop speech recording on leave', e));
      idleMode().catch((e: unknown) => logError('audio mode on leave', e));
    };
  }, [recorder]);

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
        speechTake.current = speech;
        if (speech) {
          await startSpeechTake({ keepAudio: true, onEnd: () => logError('live speech take', new Error('Recognition stopped mid-take.')) });
          // The screen may have closed while the microphone was starting.
          if (unmounted.current) {
            await discardSpeechTake();
            return false;
          }
          setSpeechRecording(true);
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
    if (speechTake.current) return stopSpeech(progress, taskId);
    if (!recorder.isRecording && !state.isRecording) return null;
    setBusy(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      const durationMs = Math.max(state.durationMillis, Date.now() - startedAt.current);
      if (!uri) return null;
      const fileName = await saveRecording(progress, taskId, uri, durationMs, Date.now());
      return { fileName, durationMs, wav: false, transcript: null };
    } finally {
      await idleMode().catch((e: unknown) => logError('audio mode', e));
      setBusy(false);
    }
  };

  const stopSpeech = async (progress: ProgressRepository, taskId: string): Promise<SavedRecording | null> => {
    if (!isSpeechTakeRecording()) return null;
    setBusy(true);
    try {
      const take = await stopSpeechTake();
      if (!take?.uri) return null;
      const uri = take.uri;
      try {
        const fileName = await saveRecording(progress, taskId, uri, take.durationMs, Date.now());
        return { fileName, durationMs: take.durationMs, wav: take.transcript === null, transcript: take.transcript };
      } catch (e: unknown) {
        // Not saved: don't leave the voice recording behind in the cache.
        deleteTake(uri);
        throw e;
      }
    } finally {
      setSpeechRecording(false);
      await idleMode().catch((e: unknown) => logError('audio mode', e));
      setBusy(false);
    }
  };

  return { micAllowed, isRecording: state.isRecording || speechRecording, busy, askPermission, start, stopAndSave };
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

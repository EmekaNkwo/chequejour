import { act, renderHook } from '@testing-library/react-native';
import { requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import type { ProgressRepository } from '../../data/progress-repo';
import { recentErrors } from '../app/log';
import { stop as stopSharedAudio } from '../audio/audio-controller';
import { saveRecording } from '../skills/recordings';
import { useRecorder, useRecordingPlayer } from '../speaking/useRecorder';

const mockRecorder = {
  isRecording: false,
  uri: null as string | null,
  prepareToRecordAsync: jest.fn(async () => undefined),
  record: jest.fn(),
  stop: jest.fn(async () => undefined),
};
const mockRecorderState = { isRecording: false, durationMillis: 0 };
const mockPlayer = { replace: jest.fn(), seekTo: jest.fn(async () => undefined), play: jest.fn(), pause: jest.fn() };
const mockPlayerStatus = { playing: false, didJustFinish: false };

jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: { preset: 'high' } },
  requestRecordingPermissionsAsync: jest.fn(),
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioRecorder: () => mockRecorder,
  useAudioRecorderState: () => ({ ...mockRecorderState }),
  useAudioPlayer: () => mockPlayer,
  useAudioPlayerStatus: () => ({ ...mockPlayerStatus }),
}));
jest.mock('../audio/audio-controller', () => ({ stop: jest.fn(async () => undefined) }));
jest.mock('../skills/recordings', () => ({
  saveRecording: jest.fn(async (_p: unknown, taskId: string) => `${taskId}.m4a`),
  recordingUri: (stored: string) => `file:///documents/recordings/${stored}`,
}));

const askMic = requestRecordingPermissionsAsync as jest.Mock;
const audioMode = setAudioModeAsync as jest.Mock;
const progress = {} as ProgressRepository;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  Object.assign(mockRecorder, { isRecording: false, uri: null });
  Object.assign(mockRecorderState, { isRecording: false, durationMillis: 0 });
  Object.assign(mockPlayerStatus, { playing: false, didJustFinish: false });
  mockRecorder.record.mockImplementation(() => {
    mockRecorder.isRecording = true;
  });
  mockRecorder.stop.mockImplementation(async () => {
    mockRecorder.isRecording = false;
    mockRecorder.uri = 'file:///cache/rec.m4a';
  });
});

describe('useRecorder', () => {
  it('asks for the microphone on first start, then records and saves', async () => {
    askMic.mockResolvedValue({ granted: true });
    const { result } = await renderHook(() => useRecorder());
    expect(result.current.micAllowed).toBeNull();
    let started = false;
    await act(async () => {
      started = await result.current.start();
    });
    expect(started).toBe(true);
    expect(result.current.micAllowed).toBe(true);
    expect(stopSharedAudio).toHaveBeenCalled();
    expect(audioMode).toHaveBeenCalledWith({ allowsRecording: true, playsInSilentMode: true });
    expect(mockRecorder.prepareToRecordAsync).toHaveBeenCalled();
    expect(mockRecorder.record).toHaveBeenCalled();

    let saved: Awaited<ReturnType<typeof result.current.stopAndSave>> = null;
    await act(async () => {
      saved = await result.current.stopAndSave(progress, 'u01-sp01');
    });
    expect(saved).toEqual({ fileName: 'u01-sp01.m4a', durationMs: expect.any(Number) });
    expect(saveRecording).toHaveBeenCalledWith(progress, 'u01-sp01', 'file:///cache/rec.m4a', expect.any(Number), expect.any(Number));
    expect(audioMode).toHaveBeenLastCalledWith({ allowsRecording: false, playsInSilentMode: true });
    expect(result.current.busy).toBe(false);

    // Permission is remembered for the next take.
    await act(async () => {
      await result.current.start();
    });
    expect(askMic).toHaveBeenCalledTimes(1);
  });

  it('uses the recorder duration when it is longer than the wall clock', async () => {
    askMic.mockResolvedValue({ granted: true });
    const { result, rerender } = await renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });
    Object.assign(mockRecorderState, { isRecording: true, durationMillis: 3_600_000 });
    await rerender({});
    expect(result.current.isRecording).toBe(true);
    let saved: { durationMs: number } | null = null;
    await act(async () => {
      saved = await result.current.stopAndSave(progress, 't');
    });
    expect(saved).toMatchObject({ durationMs: 3_600_000 });
  });

  it('does not record without microphone permission', async () => {
    askMic.mockResolvedValue({ granted: false });
    const { result } = await renderHook(() => useRecorder());
    let started = true;
    await act(async () => {
      started = await result.current.start();
    });
    expect(started).toBe(false);
    expect(result.current.micAllowed).toBe(false);
    expect(mockRecorder.record).not.toHaveBeenCalled();
  });

  it('treats a failed permission prompt as denied', async () => {
    askMic.mockRejectedValue(new Error('no prompt'));
    const { result } = await renderHook(() => useRecorder());
    let allowed = true;
    await act(async () => {
      allowed = await result.current.askPermission();
    });
    expect(allowed).toBe(false);
    expect(result.current.micAllowed).toBe(false);
    expect(recentErrors()[0]).toMatchObject({ where: 'mic permission', message: 'no prompt' });
  });

  it('reports a recorder that fails to start', async () => {
    askMic.mockResolvedValue({ granted: true });
    mockRecorder.prepareToRecordAsync.mockRejectedValueOnce(new Error('busy mic'));
    const { result } = await renderHook(() => useRecorder());
    let started = true;
    await act(async () => {
      started = await result.current.start();
    });
    expect(started).toBe(false);
    expect(recentErrors()[0]).toMatchObject({ where: 'start recording', message: 'busy mic' });
  });

  it('returns null when nothing was recording or no file was made', async () => {
    askMic.mockResolvedValue({ granted: true });
    const { result } = await renderHook(() => useRecorder());
    let saved: unknown = 'x';
    await act(async () => {
      saved = await result.current.stopAndSave(progress, 't');
    });
    expect(saved).toBeNull();
    expect(mockRecorder.stop).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.start();
    });
    mockRecorder.stop.mockImplementationOnce(async () => {
      mockRecorder.isRecording = false;
      mockRecorder.uri = null;
    });
    await act(async () => {
      saved = await result.current.stopAndSave(progress, 't');
    });
    expect(saved).toBeNull();
    expect(saveRecording).not.toHaveBeenCalled();
    expect(audioMode).toHaveBeenLastCalledWith({ allowsRecording: false, playsInSilentMode: true });
  });

  it('stops a running recording and resets the audio mode when the screen closes', async () => {
    askMic.mockResolvedValue({ granted: true });
    const { result, unmount } = await renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });
    mockRecorder.stop.mockRejectedValueOnce(new Error('already stopped'));
    audioMode.mockRejectedValueOnce(new Error('mode busy'));
    await unmount();
    await act(async () => undefined);
    expect(mockRecorder.stop).toHaveBeenCalled();
    const where = recentErrors().slice(0, 2).map((e) => e.where).sort();
    expect(where).toEqual(['audio mode on leave', 'stop recording on leave']);
  });
});

describe('useRecordingPlayer', () => {
  it('plays a stored recording and pauses it on a second tap', async () => {
    const { result, rerender } = await renderHook(() => useRecordingPlayer());
    await act(async () => result.current.toggle('a', 'a.m4a'));
    expect(stopSharedAudio).toHaveBeenCalled();
    expect(mockPlayer.replace).toHaveBeenCalledWith({ uri: 'file:///documents/recordings/a.m4a' });
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayer.play).toHaveBeenCalled();
    expect(result.current.playingKey).toBeNull();
    mockPlayerStatus.playing = true;
    await rerender({});
    expect(result.current.playingKey).toBe('a');
    await act(async () => result.current.toggle('a', 'a.m4a'));
    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(result.current.playingKey).toBeNull();
  });

  it('resolves playToEnd when the recording finishes', async () => {
    const { result, rerender } = await renderHook(() => useRecordingPlayer());
    let done = false;
    await act(async () => {
      void result.current.playToEnd('b', 'b.m4a').then(() => {
        done = true;
      });
    });
    expect(done).toBe(false);
    mockPlayerStatus.didJustFinish = true;
    await act(async () => rerender({}));
    expect(done).toBe(true);
  });

  it('resolves playToEnd when stopped or when playback fails', async () => {
    const { result } = await renderHook(() => useRecordingPlayer());
    let stopped = false;
    await act(async () => {
      void result.current.playToEnd('c', 'c.m4a').then(() => {
        stopped = true;
      });
    });
    await act(async () => result.current.stop());
    expect(stopped).toBe(true);
    expect(mockPlayer.pause).toHaveBeenCalled();
    await act(async () => result.current.stop());

    mockPlayer.seekTo.mockRejectedValueOnce(new Error('bad file'));
    await act(async () => {
      await result.current.playToEnd('d', 'd.m4a');
    });
    expect(recentErrors()[0]).toMatchObject({ where: 'play recording', message: 'bad file' });

    mockPlayer.seekTo.mockRejectedValueOnce(new Error('bad again'));
    await act(async () => result.current.toggle('e', 'e.m4a'));
    expect(recentErrors()[0]).toMatchObject({ where: 'play recording', message: 'bad again' });
  });
});

import { AiError } from '../../domain/ai/errors';
import { startLiveTake } from '../../services/ai/live-take';
import { deleteTake, discardPcm, startPcm, stopPcm } from '../../services/ai/pcm-recorder';
import { discardSpeechTake, isSpeechTakeRecording, startSpeechTake, stopSpeechTake } from '../../services/ai/speech-take';

jest.mock('../../services/ai/live-take', () => ({ startLiveTake: jest.fn(), expoLiveRecognizer: {} }));
jest.mock('../../services/ai/pcm-recorder', () => ({
  startPcm: jest.fn(async () => undefined),
  stopPcm: jest.fn(async () => ({ uri: 'file:///cache/speech-1.wav', durationMs: 3000 })),
  discardPcm: jest.fn(async () => undefined),
  deleteTake: jest.fn(),
}));

const live = startLiveTake as jest.Mock;
const session = { stop: jest.fn(), abort: jest.fn() };

beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  live.mockResolvedValue(session);
  session.stop.mockResolvedValue({ uri: 'file:///cache/recording_1.wav', durationMs: 4000, transcript: 'Je prends le bus', error: null });
  session.abort.mockResolvedValue('file:///cache/recording_1.wav');
  await discardSpeechTake();
  jest.clearAllMocks();
});

describe('a take for speech recognition', () => {
  it('is recognised live, so the transcript is ready when it stops', async () => {
    await startSpeechTake({ keepAudio: true });
    expect(live).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ persist: true }));
    expect(isSpeechTakeRecording()).toBe(true);
    await expect(stopSpeechTake()).resolves.toEqual({ uri: 'file:///cache/recording_1.wav', durationMs: 4000, transcript: 'Je prends le bus' });
    expect(isSpeechTakeRecording()).toBe(false);
    expect(startPcm).not.toHaveBeenCalled();
  });

  it('keeps no audio when it isn’t wanted', async () => {
    await startSpeechTake({ keepAudio: false });
    expect(live).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ persist: false }));
  });

  it('falls back to recording a file for later transcription when live recognition can’t start', async () => {
    live.mockRejectedValueOnce(new AiError('failed', 'busy'));
    await startSpeechTake({ keepAudio: true });
    expect(startPcm).toHaveBeenCalled();
    await expect(stopSpeechTake()).resolves.toEqual({ uri: 'file:///cache/speech-1.wav', durationMs: 3000, transcript: null });
    expect(stopPcm).toHaveBeenCalled();
  });

  it('asks for the file to be transcribed when live recognition failed part-way', async () => {
    session.stop.mockResolvedValueOnce({ uri: 'file:///cache/recording_1.wav', durationMs: 4000, transcript: '', error: 'Audio recording error.' });
    await startSpeechTake({ keepAudio: true });
    await expect(stopSpeechTake()).resolves.toMatchObject({ transcript: null });
  });

  it('keeps what was heard before a part-way failure', async () => {
    session.stop.mockResolvedValueOnce({ uri: null, durationMs: 4000, transcript: 'Bonjour', error: 'Audio recording error.' });
    await startSpeechTake({ keepAudio: false });
    await expect(stopSpeechTake()).resolves.toMatchObject({ transcript: 'Bonjour' });
  });

  it('throws a take away, deleting its audio', async () => {
    await startSpeechTake({ keepAudio: true });
    await discardSpeechTake();
    expect(session.abort).toHaveBeenCalled();
    expect(deleteTake).toHaveBeenCalledWith('file:///cache/recording_1.wav');
    expect(isSpeechTakeRecording()).toBe(false);
    live.mockRejectedValueOnce(new AiError('failed', 'busy'));
    await startSpeechTake({ keepAudio: true });
    await discardSpeechTake();
    expect(discardPcm).toHaveBeenCalled();
  });

  it('gives nothing back when nothing was recording', async () => {
    await expect(stopSpeechTake()).resolves.toBeNull();
  });
});

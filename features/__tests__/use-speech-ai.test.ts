import { act, renderHook } from '@testing-library/react-native';
import { AiError } from '../../domain/ai/errors';
import { transcribe } from '../../services/ai/stt';
import { useSpeechAi } from '../ai/useSpeechAi';

const mockState = { speaking: true, french: true };
jest.mock('../app/AppContext', () => ({ useApp: () => ({ settings: { aiFeatures: { speaking: mockState.speaking } } }) }));
jest.mock('../speech/useFrenchSpeech', () => ({ useFrenchSpeech: () => ({ ready: mockState.french }) }));
jest.mock('../../services/ai/stt', () => ({ transcribe: jest.fn() }));
jest.mock('../skills/recordings', () => ({ recordingUri: (name: string) => `file:///rec/${name}` }));

const run = transcribe as jest.Mock;
const take = { fileName: 'a.wav', durationMs: 3000, wav: true, transcript: null };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  Object.assign(mockState, { speaking: true, french: true });
});

describe('useSpeechAi', () => {
  it('is ready only with on-device French recognition and speaking feedback on', async () => {
    expect((await renderHook(() => useSpeechAi())).result.current.ready).toBe(true);
    mockState.speaking = false;
    expect((await renderHook(() => useSpeechAi())).result.current.ready).toBe(false);
    Object.assign(mockState, { speaking: true, french: false });
    expect((await renderHook(() => useSpeechAi())).result.current.ready).toBe(false);
  });

  it('transcribes a WAV take and keeps the text by file name', async () => {
    run.mockResolvedValue('Bonjour');
    const { result } = await renderHook(() => useSpeechAi());
    await act(async () => {
      result.current.request(take);
    });
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ uri: 'file:///rec/a.wav', durationMs: 3000 }));
    expect(result.current.transcripts['a.wav']).toEqual({ status: 'done', text: 'Bonjour' });
  });

  it('shows a take recognised live at once, without transcribing it again', async () => {
    const { result } = await renderHook(() => useSpeechAi());
    await act(async () => {
      result.current.request({ ...take, wav: false, transcript: 'Je prends le bus' });
    });
    expect(result.current.transcripts['a.wav']).toEqual({ status: 'done', text: 'Je prends le bus' });
    expect(run).not.toHaveBeenCalled();
  });

  it('records why a transcription failed', async () => {
    run.mockRejectedValue(new AiError('timeout', 'slow'));
    const { result } = await renderHook(() => useSpeechAi());
    await act(async () => {
      result.current.request(take);
    });
    expect(result.current.transcripts['a.wav']).toEqual({ status: 'failed', failure: 'timeout' });
  });

  it('ignores compressed takes and requests while not ready', async () => {
    const { result } = await renderHook(() => useSpeechAi());
    await act(async () => {
      result.current.request({ ...take, wav: false });
    });
    mockState.speaking = false;
    const off = await renderHook(() => useSpeechAi());
    await act(async () => {
      off.result.current.request(take);
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('cancels a running transcription when the screen closes', async () => {
    let signal: AbortSignal | undefined;
    run.mockImplementation((req: { signal: AbortSignal }) => {
      signal = req.signal;
      return new Promise(() => undefined);
    });
    const { result, unmount } = await renderHook(() => useSpeechAi());
    await act(async () => {
      result.current.request(take);
    });
    expect(result.current.transcripts['a.wav']).toEqual({ status: 'working' });
    await unmount();
    expect(signal?.aborted).toBe(true);
  });
});

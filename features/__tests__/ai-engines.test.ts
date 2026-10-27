import { renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { unloadLlm } from '../../services/ai/llm';
import { BACKGROUND_UNLOAD_MS, useReleaseEnginesInBackground } from '../ai/ai-engines';

jest.mock('../../services/ai/llm', () => ({ unloadLlm: jest.fn(async () => undefined) }));

let listener: ((state: AppStateStatus) => void) | null = null;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    listener = handler as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(() => jest.useRealTimers());

describe('freeing the models when the app leaves', () => {
  it('frees them once the app has stayed in the background', async () => {
    await renderHook(() => useReleaseEnginesInBackground());
    listener?.('background');
    await jest.advanceTimersByTimeAsync(BACKGROUND_UNLOAD_MS);
    expect(unloadLlm).toHaveBeenCalledTimes(1);
  });

  it('keeps them through a brief trip, like the microphone permission check', async () => {
    await renderHook(() => useReleaseEnginesInBackground());
    listener?.('background');
    await jest.advanceTimersByTimeAsync(600);
    listener?.('active');
    await jest.advanceTimersByTimeAsync(BACKGROUND_UNLOAD_MS * 2);
    expect(unloadLlm).not.toHaveBeenCalled();
  });
});

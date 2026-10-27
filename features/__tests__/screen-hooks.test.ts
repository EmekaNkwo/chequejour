import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { answerToast } from '../../domain/toast';
import { useApp } from '../app/AppContext';
import { recentErrors } from '../app/log';
import { useLoad } from '../app/useLoad';
import { play, setRate, stop } from '../audio/audio-controller';
import { useAutoPlay, usePlayback, useSpeaker } from '../audio/useAudio';
import { useAnswerToast } from '../exercises/useAnswerToast';
import { useStudyTimer } from '../progress/useStudyTimer';
import { useCountdown } from '../skills/useCountdown';

jest.mock('../app/AppContext', () => ({ useApp: jest.fn() }));
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return { useFocusEffect: (effect: () => void) => useEffect(effect, [effect]) };
});
const mockToastApi = { show: jest.fn(() => 7), dismiss: jest.fn(), confirm: jest.fn() };
jest.mock('../../components/ui/Toast', () => ({ useToast: () => mockToastApi }));
jest.mock('../audio/audio-controller', () => ({
  play: jest.fn(async () => undefined),
  stop: jest.fn(async () => undefined),
  setRate: jest.fn(async () => undefined),
  subscribe: jest.fn((listener: (s: unknown) => void) => {
    listener({ key: 'clip1', playing: true, progress: 0.2, source: 'clip' });
    return jest.fn();
  }),
}));

const mockedUseApp = useApp as jest.Mock;

function appWith(overrides: Record<string, unknown> = {}) {
  const app = {
    dataVersion: 0,
    invalidate: jest.fn(),
    progress: { addStudy: jest.fn(async () => undefined) },
    settings: { playbackRate: 1, autoPlay: true },
    updateSetting: jest.fn(async () => undefined),
    ...overrides,
  };
  mockedUseApp.mockReturnValue(app);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useCountdown', () => {
  beforeEach(() => jest.useFakeTimers());

  it('counts down in whole seconds and calls onDone once at zero', async () => {
    const onDone = jest.fn();
    const { result } = await renderHook(() => useCountdown(onDone));
    expect(result.current).toMatchObject({ remaining: 0, running: false });
    await act(() => result.current.start(3));
    expect(result.current).toMatchObject({ remaining: 3, running: true });
    await act(() => jest.advanceTimersByTime(1250));
    expect(result.current.remaining).toBe(2);
    // One tick per act, as on a device where React re-renders between 250 ms ticks.
    for (let i = 0; i < 16; i += 1) await act(() => jest.advanceTimersByTime(250));
    expect(result.current).toMatchObject({ remaining: 0, running: false });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('calls onDone once even when several ticks run before a re-render', async () => {
    const onDone = jest.fn();
    const { result } = await renderHook(() => useCountdown(onDone));
    await act(() => result.current.start(1));
    await act(() => jest.advanceTimersByTime(5000));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(result.current.running).toBe(false);
  });

  it('stops without calling onDone and uses the latest callback', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const { result, rerender } = await renderHook(({ cb }: { cb: () => void }) => useCountdown(cb), { initialProps: { cb: first } });
    await act(() => result.current.start(2));
    await act(() => result.current.stop());
    await act(() => jest.advanceTimersByTime(5000));
    expect(result.current.running).toBe(false);
    expect(first).not.toHaveBeenCalled();
    await rerender({ cb: second });
    await act(() => result.current.start(1));
    await act(() => jest.advanceTimersByTime(1000));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('useStudyTimer', () => {
  let onChange: (state: AppStateStatus) => void;
  const remove = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(2026, 9, 26, 10, 0, 0) });
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      onChange = handler as (state: AppStateStatus) => void;
      return { remove } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
  });

  it('adds foreground time every 30 seconds and on leaving the screen', async () => {
    const app = appWith();
    const { unmount } = await renderHook(() => useStudyTimer());
    await act(() => jest.advanceTimersByTime(30_000));
    expect(app.progress.addStudy).toHaveBeenLastCalledWith('2026-10-26', { seconds: 30 });
    await act(() => jest.advanceTimersByTime(5_000));
    await unmount();
    expect(app.progress.addStudy).toHaveBeenLastCalledWith('2026-10-26', { seconds: 5 });
    expect(remove).toHaveBeenCalled();
    expect(app.invalidate).toHaveBeenCalled();
  });

  it('stops counting in the background and caps long gaps', async () => {
    const app = appWith();
    await renderHook(() => useStudyTimer());
    jest.setSystemTime(Date.now() + 10_000);
    await act(() => onChange('background'));
    expect(app.progress.addStudy).toHaveBeenCalledWith('2026-10-26', { seconds: 10 });
    await act(() => jest.advanceTimersByTime(60_000));
    expect(app.progress.addStudy).toHaveBeenCalledTimes(1);
    await act(() => onChange('active'));
    jest.setSystemTime(Date.now() + 600_000);
    await act(() => jest.advanceTimersByTime(0));
    await act(() => onChange('inactive'));
    expect(app.progress.addStudy).toHaveBeenLastCalledWith('2026-10-26', { seconds: 120 });
  });

  it('skips chunks under a second and logs failed saves', async () => {
    const app = appWith({ progress: { addStudy: jest.fn(async () => Promise.reject(new Error('disk full'))) } });
    const { unmount } = await renderHook(() => useStudyTimer());
    jest.setSystemTime(Date.now() + 500);
    await act(() => onChange('background'));
    expect(app.progress.addStudy).not.toHaveBeenCalled();
    await act(() => onChange('active'));
    await act(() => jest.advanceTimersByTime(30_000));
    await unmount();
    expect(recentErrors()[0]).toMatchObject({ where: 'study timer', message: 'disk full' });
  });
});

describe('useLoad', () => {
  it('loads on focus, exposes data and reloads on demand', async () => {
    appWith();
    let n = 0;
    const loader = jest.fn(async () => (n += 1));
    const { result } = await renderHook(() => useLoad('test', loader, []));
    expect(result.current).toMatchObject({ data: 1, error: null, loading: false });
    await act(async () => result.current.reload());
    expect(result.current.data).toBe(2);
  });

  it('reloads when progress changes', async () => {
    appWith();
    const loader = jest.fn(async () => 'x');
    const { rerender } = await renderHook(() => useLoad('test', loader, []));
    appWith({ dataVersion: 1 });
    await rerender({});
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('shows a friendly error and logs the cause', async () => {
    appWith();
    const { result } = await renderHook(() => useLoad('home', async () => Promise.reject(new Error('db locked')), []));
    expect(result.current).toMatchObject({ data: null, error: 'Something went wrong loading this screen.', loading: false });
    expect(recentErrors()[0]).toMatchObject({ where: 'home', message: 'db locked' });
  });

  it('keeps only the newest result when loads overlap', async () => {
    appWith();
    const resolvers: ((v: string) => void)[] = [];
    const loader = () => new Promise<string>((resolve) => resolvers.push(resolve));
    const { result } = await renderHook(() => useLoad('test', loader, []));
    await act(async () => result.current.reload());
    expect(result.current.loading).toBe(true);
    await act(async () => resolvers[1]('new'));
    await act(async () => resolvers[0]('old'));
    expect(result.current.data).toBe('new');
  });
});

describe('useAnswerToast', () => {
  it('shows answer feedback and dismisses it on clear and unmount', async () => {
    const { result, unmount } = await renderHook(() => useAnswerToast());
    const outcome = { result: 'wrong' as const, expected: 'le chat' };
    await act(() => result.current.show(outcome, 'Because.'));
    expect(mockToastApi.show).toHaveBeenCalledWith(answerToast(outcome, 'Because.'));
    await act(() => result.current.clear());
    expect(mockToastApi.dismiss).toHaveBeenCalledWith(7);
    await act(() => result.current.clear());
    expect(mockToastApi.dismiss).toHaveBeenCalledTimes(1);
    await act(() => result.current.show(outcome, 'Again.'));
    await unmount();
    expect(mockToastApi.dismiss).toHaveBeenCalledTimes(2);
  });
});

describe('audio hooks', () => {
  it('follows the shared playback state', async () => {
    const { result } = await renderHook(() => usePlayback());
    expect(result.current).toEqual({ key: 'clip1', playing: true, progress: 0.2, source: 'clip' });
  });

  it('speaks at the saved speed unless one is given, and stops on unmount', async () => {
    appWith({ settings: { playbackRate: 0.75, autoPlay: false } });
    const { result, unmount } = await renderHook(() => useSpeaker());
    expect(result.current.rate).toBe(0.75);
    expect(result.current.isPlaying('clip1')).toBe(true);
    expect(result.current.isPlaying('other')).toBe(false);
    const onFinish = jest.fn();
    result.current.speak('k', 'texte', { onFinish });
    expect(play).toHaveBeenLastCalledWith('k', 'texte', { rate: 0.75, onFinish });
    result.current.speak('k', 'texte', { rate: 1.5 });
    expect(play).toHaveBeenLastCalledWith('k', 'texte', { rate: 1.5, onFinish: undefined });
    result.current.stop();
    expect(stop).toHaveBeenCalledTimes(1);
    await unmount();
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it('applies and saves a new speed, logging failures', async () => {
    const app = appWith({ updateSetting: jest.fn(async () => Promise.reject(new Error('save failed'))) });
    (setRate as jest.Mock).mockRejectedValueOnce(new Error('rate failed'));
    const { result } = await renderHook(() => useSpeaker());
    await act(async () => result.current.changeRate(1.25));
    expect(setRate).toHaveBeenCalledWith(1.25);
    expect(app.updateSetting).toHaveBeenCalledWith('playbackRate', 1.25);
    expect(recentErrors().slice(0, 2).map((e) => e.where).sort()).toEqual(['playback rate', 'save playback rate']);
  });

  it('auto-plays shortly after opening when enabled', async () => {
    jest.useFakeTimers();
    appWith({ settings: { playbackRate: 1.25, autoPlay: true } });
    const { unmount } = await renderHook(() => useAutoPlay('k', 'texte'));
    expect(play).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(350));
    expect(play).toHaveBeenCalledWith('k', 'texte', { rate: 1.25 });
    await unmount();
  });

  it('does not auto-play when disabled, without content, or if the screen closes first', async () => {
    jest.useFakeTimers();
    appWith({ settings: { playbackRate: 1, autoPlay: false } });
    await renderHook(() => useAutoPlay('k', 'texte'));
    appWith();
    await renderHook(() => useAutoPlay(null, 'texte'));
    await renderHook(() => useAutoPlay('k', null));
    const { unmount } = await renderHook(() => useAutoPlay('k', 'texte'));
    await unmount();
    await act(() => jest.advanceTimersByTime(1000));
    expect(play).not.toHaveBeenCalled();
  });
});

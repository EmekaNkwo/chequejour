import { PLAY_WORD_ACTION, playFromWidget, playWordAction, type WidgetPlayer } from '../widget/widget-play';

function fakePlayer(finishAfter: number | null = 0) {
  const calls: { key: string; text: string; rate: number | undefined }[] = [];
  const player: WidgetPlayer = {
    play: async (key, text, options) => {
      calls.push({ key, text, rate: options?.rate });
      if (finishAfter !== null) setTimeout(() => options?.onFinish?.(key), finishAfter);
    },
    stop: jest.fn(async () => undefined),
  };
  return { player, calls };
}

describe('widget pronunciation button', () => {
  it('carries the word clip and text on the button', () => {
    expect(playWordAction({ fr: 'le réveil', audioKey: 'w:u01-w001' })).toEqual({ clickAction: PLAY_WORD_ACTION, clickActionData: { key: 'w:u01-w001', text: 'le réveil' } });
  });

  it('plays the clip at the learner speed and waits until it finishes', async () => {
    const { player, calls } = fakePlayer(5);
    await expect(playFromWidget(PLAY_WORD_ACTION, { key: 'w:u01-w001', text: 'le réveil' }, player, 0.75)).resolves.toBe('played');
    expect(calls).toEqual([{ key: 'w:u01-w001', text: 'le réveil', rate: 0.75 }]);
  });

  it('ignores other clicks and malformed data', async () => {
    const { player, calls } = fakePlayer();
    expect(await playFromWidget('OTHER', { key: 'k', text: 't' }, player, 1)).toBe('ignored');
    expect(await playFromWidget(PLAY_WORD_ACTION, undefined, player, 1)).toBe('ignored');
    expect(await playFromWidget(PLAY_WORD_ACTION, { key: 3, text: 't' }, player, 1)).toBe('ignored');
    expect(await playFromWidget(PLAY_WORD_ACTION, { key: '', text: 't' }, player, 1)).toBe('ignored');
    expect(calls).toHaveLength(0);
  });

  it('gives up waiting after a time limit so the background task always ends', async () => {
    jest.useFakeTimers();
    const { player } = fakePlayer(null);
    const result = playFromWidget(PLAY_WORD_ACTION, { key: 'k', text: 't' }, player, 1);
    await jest.advanceTimersByTimeAsync(20_000);
    await expect(result).resolves.toBe('timed-out');
    expect(player.stop).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('reports a failure to play instead of throwing', async () => {
    const player: WidgetPlayer = { play: async () => Promise.reject(new Error('no audio')), stop: async () => undefined };
    expect(await playFromWidget(PLAY_WORD_ACTION, { key: 'k', text: 't' }, player, 1)).toBe('failed');
  });
});

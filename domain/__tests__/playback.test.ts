import { DEFAULT_RATE, formatRate, isPlaybackRate, legacyRate, PLAYBACK_RATES } from '../playback';

describe('playback rates', () => {
  it('offers slow to fast speeds around normal', () => {
    expect(PLAYBACK_RATES).toEqual([0.5, 0.75, 1, 1.25, 1.5]);
    expect(DEFAULT_RATE).toBe(1);
  });

  it('formats rates as short labels', () => {
    expect(formatRate(0.5)).toBe('0.5×');
    expect(formatRate(0.75)).toBe('0.75×');
    expect(formatRate(1)).toBe('1×');
    expect(formatRate(1.25)).toBe('1.25×');
  });

  it('only accepts the listed rates', () => {
    expect(isPlaybackRate(0.75)).toBe(true);
    expect(isPlaybackRate(0.7)).toBe(false);
    expect(isPlaybackRate('1')).toBe(false);
  });

  it('maps the old normal/slow setting to a rate', () => {
    expect(legacyRate('slow')).toBe(0.75);
    expect(legacyRate('normal')).toBe(1);
    expect(legacyRate(undefined)).toBeNull();
    expect(legacyRate('fast')).toBeNull();
  });
});

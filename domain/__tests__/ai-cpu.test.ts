import { DEFAULT_THREADS, fastCoreCount } from '../ai/cpu';

describe('threads for the language model', () => {
  it('uses only the fast cores of a big.LITTLE phone', () => {
    // Helio G99: six small cores and two big ones.
    expect(fastCoreCount([348, 348, 348, 348, 348, 348, 1024, 1024])).toBe(2);
    // Snapdragon 8 Gen 2 style: prime, four performance, three efficiency cores.
    expect(fastCoreCount([411, 411, 411, 795, 795, 795, 795, 1024])).toBe(5);
  });

  it('uses every core when they are all alike, up to a limit', () => {
    expect(fastCoreCount([1024, 1024, 1024, 1024])).toBe(4);
    expect(fastCoreCount(Array.from({ length: 12 }, () => 1024))).toBe(8);
  });

  it('falls back to the usual default when the capacities are unknown', () => {
    expect(fastCoreCount([])).toBe(DEFAULT_THREADS);
    expect(fastCoreCount([Number.NaN, 0])).toBe(DEFAULT_THREADS);
  });

  it('never goes below two threads', () => {
    expect(fastCoreCount([300, 300, 300, 300, 300, 300, 300, 1024])).toBe(2);
  });
});

import { addDays, dayNumber, daysBetween, lastNDays, startOfWeek, toDayKey } from '../dates';
import { computeStreak } from '../streak';

describe('dates', () => {
  it('formats local day keys', () => {
    expect(toDayKey(new Date(2026, 2, 5, 23, 59))).toBe('2026-03-05');
  });
  it('adds days across month, year and DST boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
  });
  it('lists the last n days oldest first', () => {
    expect(lastNDays('2026-10-25', 3)).toEqual(['2026-10-23', '2026-10-24', '2026-10-25']);
  });
  it('finds Monday as the start of the week', () => {
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19');
    expect(startOfWeek('2026-10-19')).toBe('2026-10-19');
  });
  it('day numbers are consecutive', () => {
    expect(dayNumber('2026-10-26') - dayNumber('2026-10-25')).toBe(1);
  });
});

const days = (...keys: string[]): Set<string> => new Set(keys);

describe('computeStreak', () => {
  const today = '2026-10-25';
  it('counts consecutive days including today', () => {
    const s = computeStreak(days('2026-10-23', '2026-10-24', '2026-10-25'), today);
    expect(s.current).toBe(3);
    expect(s.activeToday).toBe(true);
  });
  it('does not break when today is not yet done', () => {
    expect(computeStreak(days('2026-10-23', '2026-10-24'), today).current).toBe(2);
  });
  it('forgives one missed day as a rest day', () => {
    const s = computeStreak(days('2026-10-21', '2026-10-22', '2026-10-24', '2026-10-25'), today);
    expect(s.current).toBe(4);
    expect(s.restDays).toEqual(['2026-10-23']);
    expect(s.restAvailable).toBe(false);
  });
  it('breaks on two missed days in a row', () => {
    expect(computeStreak(days('2026-10-20', '2026-10-21', '2026-10-24', '2026-10-25'), today).current).toBe(2);
  });
  it('breaks on a second missed day within a week', () => {
    // misses on 22nd and 24th
    const s = computeStreak(days('2026-10-20', '2026-10-21', '2026-10-23', '2026-10-25'), today);
    expect(s.current).toBe(2);
    expect(s.restDays).toEqual(['2026-10-24']);
  });
  it('allows rest days a week apart', () => {
    const active: string[] = [];
    for (let i = 0; i < 20; i += 1) {
      const d = addDays(today, -i);
      if (i !== 3 && i !== 11) active.push(d);
    }
    const s = computeStreak(new Set(active), today);
    expect(s.current).toBe(18);
    expect(s.restDays).toHaveLength(2);
  });
  it('is zero with no activity', () => {
    expect(computeStreak(days(), today)).toEqual({ current: 0, activeToday: false, restDays: [], restAvailable: true });
  });
});

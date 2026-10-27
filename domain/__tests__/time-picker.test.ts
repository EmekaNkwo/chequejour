import { dateToTime, timeToDate } from '../dates';

describe('time picker conversion', () => {
  it('keeps any minute, not just 15-minute steps', () => {
    const d = timeToDate({ hour: 7, minute: 10 }, new Date(2026, 9, 25, 22, 41, 33));
    expect(d.getHours()).toBe(7);
    expect(d.getMinutes()).toBe(10);
    expect(d.getSeconds()).toBe(0);
    expect(dateToTime(d)).toEqual({ hour: 7, minute: 10 });
  });

  it('round-trips midnight and the last minute of the day', () => {
    expect(dateToTime(timeToDate({ hour: 0, minute: 0 }))).toEqual({ hour: 0, minute: 0 });
    expect(dateToTime(timeToDate({ hour: 23, minute: 59 }))).toEqual({ hour: 23, minute: 59 });
  });

  it('does not modify the base date', () => {
    const base = new Date(2026, 9, 25, 12, 0);
    timeToDate({ hour: 6, minute: 5 }, base);
    expect(base.getHours()).toBe(12);
  });
});

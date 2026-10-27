import { horizonDays } from '../notification-plan';
import { DEFAULT_REMINDER, isReminderDay, planReminders, reminderText } from '../reminder-plan';

const ctx = { anchor: '2026-10-20', examDate: null, dailyGoal: 15 };
const days = horizonDays('2026-10-21', 30);

describe('missed-day reminders', () => {
  it('fires after 1, 2, 4, 7 and 12 missed days, then weekly', () => {
    const fired = Array.from({ length: 30 }, (_, i) => i).filter(isReminderDay);
    expect(fired).toEqual([1, 2, 4, 7, 12, 19, 26]);
  });

  it('plans from the last study day, at the reminder time, never in the past', () => {
    const now = new Date(2026, 9, 21, 12, 0);
    const plan = planReminders(DEFAULT_REMINDER, days, ctx, now);
    expect(plan.map((p) => p.day)).toEqual(['2026-10-22', '2026-10-23', '2026-10-25', '2026-10-28', '2026-11-02', '2026-11-09', '2026-11-16']);
    expect(plan[0]).toMatchObject({ id: 'reminder-2026-10-22', kind: 'reminder', url: '/session' });
    expect(plan[0].fireAt.getHours()).toBe(19);
    expect(plan[0].fireAt.getMinutes()).toBe(30);
  });

  it('plans nothing on the day studied or when turned off', () => {
    const today = { ...ctx, anchor: '2026-10-21' };
    const plan = planReminders(DEFAULT_REMINDER, horizonDays('2026-10-21', 3), today, new Date(2026, 9, 21, 8));
    // Studied on the 21st: the 22nd is the first missed day, so the reminder is on the 23rd.
    expect(plan.map((p) => p.day)).toEqual(['2026-10-23']);
    expect(planReminders({ ...DEFAULT_REMINDER, enabled: false }, days, ctx, new Date(2026, 9, 21))).toEqual([]);
  });

  it('skips a reminder whose time today has already passed', () => {
    const plan = planReminders(DEFAULT_REMINDER, horizonDays('2026-10-22', 1), ctx, new Date(2026, 9, 22, 20, 0));
    expect(plan).toEqual([]);
  });

  it('gets firmer as days pass and mentions the exam countdown', () => {
    expect(reminderText(1, '2026-10-22', ctx).body).toContain('missed yesterday');
    expect(reminderText(4, '2026-10-25', ctx).body).toContain('4 days without French');
    expect(reminderText(12, '2026-11-02', ctx).body).toContain("It's been 12 days");
    expect(reminderText(2, '2026-10-23', { ...ctx, examDate: '2026-11-02' }).body).toContain('10 days to your TCF');
    expect(reminderText(2, '2026-11-01', { ...ctx, examDate: '2026-11-02' }).body).toContain('Your TCF is tomorrow');
  });
});

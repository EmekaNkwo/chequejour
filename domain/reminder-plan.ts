/**
 * "Come back" reminders after missed days. Counted from the last day the learner
 * actually studied: one after a single missed day, then backing off (2, 4, 7 and 12
 * missed days), then once a week. Studying moves the anchor, so the app recomputes the
 * plan whenever the last study day changes, on launch and on returning to the app.
 */
import { atTime, daysBetween, type DayKey } from './dates';
import type { NotificationToggle, PlannedNotification } from './notification-plan';

export const DEFAULT_REMINDER: NotificationToggle = { enabled: true, time: { hour: 19, minute: 30 } };

/** Missed days after which a reminder fires; after the last one, every WEEKLY_AFTER days. */
export const REMINDER_STEPS: readonly number[] = [1, 2, 4, 7, 12];
const WEEKLY_AFTER = 7;
/** Reminders are planned further ahead than daily items, so a long break still gets some. */
export const REMINDER_HORIZON_DAYS = 30;

export function isReminderDay(missed: number): boolean {
  if (missed < 1) return false;
  if (REMINDER_STEPS.includes(missed)) return true;
  const last = REMINDER_STEPS[REMINDER_STEPS.length - 1];
  return missed > last && (missed - last) % WEEKLY_AFTER === 0;
}

export interface ReminderContext {
  /** Last day with real study, or the install day for a learner who hasn't started. */
  anchor: DayKey;
  /** Days to the learner's TCF on the reminder's day is computed from this, if set. */
  examDate: DayKey | null;
  dailyGoal: number;
}

/** Text for a reminder `missed` days after the last study day. Pure and deterministic. */
export function reminderText(missed: number, day: DayKey, ctx: ReminderContext): { title: string; body: string } {
  const examDays = ctx.examDate ? daysBetween(day, ctx.examDate) : null;
  const exam = examDays !== null && examDays > 0 ? ` ${examDays === 1 ? 'Your TCF is tomorrow' : `${examDays} days to your TCF`}: every session counts.` : '';
  const goal = `${ctx.dailyGoal} minutes`;
  if (missed === 1) return { title: 'On continue ? Your French is waiting', body: `You missed yesterday. ${goal} today keeps your progress going.${exam}` };
  if (missed <= 4) return { title: 'Ça fait quelques jours…', body: `${missed} days without French. Your reviews are piling up — ${goal} clears the most urgent ones.${exam}` };
  return { title: 'Votre français vous attend', body: `It's been ${missed} days. Start small: one review session, ${goal}. Your words are still there.${exam}` };
}

export function planReminders(toggle: NotificationToggle, days: readonly DayKey[], ctx: ReminderContext, now: Date): PlannedNotification[] {
  if (!toggle.enabled) return [];
  return days.flatMap((day): PlannedNotification[] => {
    const missed = daysBetween(ctx.anchor, day) - 1;
    const fireAt = atTime(day, toggle.time);
    if (!isReminderDay(missed) || fireAt.getTime() <= now.getTime()) return [];
    return [{ id: `reminder-${day}`, kind: 'reminder', day, fireAt, ...reminderText(missed, day, ctx), url: '/session' }];
  });
}

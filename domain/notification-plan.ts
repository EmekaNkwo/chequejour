/**
 * Computes the local notifications to schedule. Each day's notification is a one-off
 * DATE trigger carrying that day's item, scheduled HORIZON_DAYS ahead, so they keep
 * firing for two weeks even if the app isn't opened. The app recomputes the plan on
 * every launch and when it returns to the foreground, which also covers reboots and
 * time-zone changes.
 */
import { addDays, atTime, type DayKey, type TimeOfDay } from './dates';
import type { DailyAssignment } from './daily-items';

export const HORIZON_DAYS = 14;

export interface NotificationToggle {
  enabled: boolean;
  time: TimeOfDay;
}

export interface NotificationSettings {
  word: NotificationToggle;
  sentence: NotificationToggle;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  word: { enabled: true, time: { hour: 8, minute: 0 } },
  sentence: { enabled: true, time: { hour: 18, minute: 0 } },
};

export interface NotificationTexts {
  word: (wordId: string) => { title: string; body: string } | null;
  sentence: (sentenceId: string) => { title: string; body: string } | null;
}

export interface PlannedNotification {
  /** Stable identifier, e.g. "word-2026-10-25". */
  id: string;
  kind: 'word' | 'sentence' | 'reminder';
  day: DayKey;
  fireAt: Date;
  title: string;
  body: string;
  /** Deep link opened when the notification is tapped. */
  url: string;
}

export function horizonDays(today: DayKey, days: number = HORIZON_DAYS): DayKey[] {
  return Array.from({ length: days }, (_, i) => addDays(today, i));
}

export function planNotifications(
  settings: NotificationSettings,
  assignments: readonly DailyAssignment[],
  texts: NotificationTexts,
  now: Date,
): PlannedNotification[] {
  const planned: PlannedNotification[] = [];
  for (const a of assignments) {
    for (const kind of ['word', 'sentence'] as const) {
      const toggle = settings[kind];
      if (!toggle.enabled) continue;
      const fireAt = atTime(a.day, toggle.time);
      if (fireAt.getTime() <= now.getTime()) continue;
      const text = kind === 'word' ? texts.word(a.wordId) : texts.sentence(a.sentenceId);
      if (!text) continue;
      planned.push({
        id: `${kind}-${a.day}`,
        kind,
        day: a.day,
        fireAt,
        title: text.title,
        body: text.body,
        url: `/daily/${kind}?day=${a.day}`,
      });
    }
  }
  return planned.sort((x, y) => x.fireAt.getTime() - y.fireAt.getTime());
}

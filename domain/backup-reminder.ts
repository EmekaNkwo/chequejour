/**
 * Backup reminders: progress lives only on the phone, so the app nudges the learner to
 * export a backup every so often. Counted from the last successful export, or from the
 * install day for a learner who has never backed up. An export resets the count.
 */
import { addDays, atTime, daysBetween, toDayKey, type DayKey, type TimeOfDay } from './dates';
import type { PlannedNotification } from './notification-plan';

export const BACKUP_INTERVALS = [7, 14, 30] as const;
export type BackupInterval = (typeof BACKUP_INTERVALS)[number];

export interface BackupReminderSettings {
  /** Days between reminders; null switches reminders off. */
  intervalDays: BackupInterval | null;
  /** Also send a local notification on the due day. */
  notify: boolean;
}

export const DEFAULT_BACKUP_REMINDER: BackupReminderSettings = { intervalDays: 14, notify: false };
export const BACKUP_NOTIFY_TIME: TimeOfDay = { hour: 10, minute: 0 };

export function daysSinceBackup(lastBackup: DayKey | null, installDay: DayKey | null, today: DayKey): number {
  const anchor = lastBackup ?? installDay ?? today;
  return Math.max(0, daysBetween(anchor, today));
}

export function backupDue(settings: BackupReminderSettings, lastBackup: DayKey | null, installDay: DayKey | null, today: DayKey): boolean {
  return settings.intervalDays !== null && daysSinceBackup(lastBackup, installDay, today) >= settings.intervalDays;
}

export function lastBackupLabel(lastBackup: DayKey | null, today: DayKey): string {
  if (!lastBackup) return 'No backup yet';
  const days = Math.max(0, daysBetween(lastBackup, today));
  if (days === 0) return 'Last backup: today';
  if (days === 1) return 'Last backup: yesterday';
  return `Last backup: ${days} days ago`;
}

/** The next backup notification: on the due day, or today/tomorrow when already overdue. */
export function planBackupNotification(settings: BackupReminderSettings, lastBackup: DayKey | null, installDay: DayKey | null, now: Date): PlannedNotification[] {
  if (!settings.notify || settings.intervalDays === null) return [];
  const today = toDayKey(now);
  const due = addDays(lastBackup ?? installDay ?? today, settings.intervalDays);
  let day = daysBetween(today, due) > 0 ? due : today;
  if (atTime(day, BACKUP_NOTIFY_TIME).getTime() <= now.getTime()) day = addDays(day, 1);
  const days = daysSinceBackup(lastBackup, installDay, day);
  return [
    {
      id: `backup-${day}`,
      kind: 'backup',
      day,
      fireAt: atTime(day, BACKUP_NOTIFY_TIME),
      title: 'Time for a backup',
      body: lastBackup ? `Your last backup was ${days} days ago. Export one to keep your progress safe.` : 'Your progress lives only on this phone. Export a backup to keep it safe.',
      url: '/settings',
    },
  ];
}

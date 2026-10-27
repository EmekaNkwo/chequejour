import { backupDue, daysSinceBackup, DEFAULT_BACKUP_REMINDER, lastBackupLabel, planBackupNotification } from '../backup-reminder';

const on = DEFAULT_BACKUP_REMINDER;

describe('backup reminder timing', () => {
  it('counts days since the last backup, or since install when there was none', () => {
    expect(daysSinceBackup('2026-10-01', null, '2026-10-26')).toBe(25);
    expect(daysSinceBackup(null, '2026-10-20', '2026-10-26')).toBe(6);
    expect(daysSinceBackup(null, null, '2026-10-26')).toBe(0);
  });

  it('is due once the interval has passed, every 14 days by default', () => {
    expect(on.intervalDays).toBe(14);
    expect(backupDue(on, '2026-10-12', null, '2026-10-25')).toBe(false);
    expect(backupDue(on, '2026-10-12', null, '2026-10-26')).toBe(true);
    expect(backupDue({ ...on, intervalDays: 7 }, '2026-10-19', null, '2026-10-26')).toBe(true);
  });

  it('is never due when switched off, and a fresh export clears it', () => {
    expect(backupDue({ ...on, intervalDays: null }, '2025-01-01', null, '2026-10-26')).toBe(false);
    expect(backupDue(on, '2026-10-26', null, '2026-10-26')).toBe(false);
  });

  it('labels the last backup in plain words', () => {
    expect(lastBackupLabel(null, '2026-10-26')).toBe('No backup yet');
    expect(lastBackupLabel('2026-10-26', '2026-10-26')).toBe('Last backup: today');
    expect(lastBackupLabel('2026-10-25', '2026-10-26')).toBe('Last backup: yesterday');
    expect(lastBackupLabel('2026-10-12', '2026-10-26')).toBe('Last backup: 14 days ago');
  });

  it('plans one notification on the due day, only when notifications are on', () => {
    const now = new Date(2026, 9, 26, 9, 0);
    expect(planBackupNotification(on, '2026-10-20', null, now)).toEqual([]);
    const [n] = planBackupNotification({ ...on, notify: true }, '2026-10-20', null, now);
    expect(n).toMatchObject({ id: 'backup-2026-11-03', kind: 'backup', day: '2026-11-03', url: '/settings' });
    expect(n.fireAt).toEqual(new Date(2026, 10, 3, 10, 0));
    expect(planBackupNotification({ ...on, intervalDays: null, notify: true }, '2026-10-20', null, now)).toEqual([]);
  });

  it('when a backup is already overdue, reminds today if there is still time, else tomorrow', () => {
    const notify = { ...on, notify: true };
    expect(planBackupNotification(notify, '2026-09-01', null, new Date(2026, 9, 26, 9, 0))[0].day).toBe('2026-10-26');
    expect(planBackupNotification(notify, '2026-09-01', null, new Date(2026, 9, 26, 11, 0))[0].day).toBe('2026-10-27');
    expect(planBackupNotification(notify, null, '2026-10-26', new Date(2026, 9, 26, 9, 0))[0].day).toBe('2026-11-09');
  });
});

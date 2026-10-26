/**
 * @jest-environment node
 */
import { ContentRepository } from '../../data/content-repo';
import { seedContentIfNeeded } from '../../data/content-seed';
import { migrate } from '../../data/migrations';
import { ProgressRepository } from '../../data/progress-repo';
import type { ContentBundle } from '../../domain/content-types';
import { DEFAULT_NOTIFICATION_SETTINGS, type PlannedNotification } from '../../domain/notification-plan';
import { DEFAULT_REMINDER } from '../../domain/reminder-plan';
import { createNodeDb } from '../../test-utils/node-db';
import { syncNotifications, type NotificationsApi } from '../notifications/sync';

const words = Array.from({ length: 40 }, (_, i) => ({
  id: `u01-w${String(i + 1).padStart(3, '0')}`,
  fr: `mot${i}`,
  en: `word ${i}`,
  pos: 'noun' as const,
  gender: 'm' as const,
  level: 'A2' as const,
  core: i < 20,
  example: { fr: `Exemple ${i}.`, en: `Example ${i}.` },
}));

const bundle: ContentBundle = {
  version: 1,
  builtAt: 'x',
  units: [{ id: 'u01', order: 1, level: 'A2', theme: 't', titleFr: 't', description: 'd', vocab: words, grammar: [], exercises: [], checkpoint: [], listening: [], reading: [], writing: [], speaking: [] }],
  sentences: Array.from({ length: 50 }, (_, i) => ({
    id: `s${String(i + 1).padStart(3, '0')}`,
    fr: `Phrase ${i}.`,
    en: `S ${i}`,
    grammarNote: 'n',
    grammarTag: 'present' as const,
    // s001–s030 are A2, s031–s050 are A2+
    level: i < 30 ? ('A2' as const) : ('A2+' as const),
  })),
  placement: { version: 1, questions: [] },
  mockTests: [],
};

class FakeNotifications implements NotificationsApi {
  scheduled = new Map<string, PlannedNotification>();
  constructor(public permission = true) {}
  async canNotify() {
    return this.permission;
  }
  async cancelAll() {
    this.scheduled.clear();
  }
  async schedule(n: PlannedNotification) {
    this.scheduled.set(n.id, n);
  }
}

async function setup() {
  const db = createNodeDb();
  await migrate(db);
  await seedContentIfNeeded(db, bundle);
  // Reminders are covered separately below; off here so counts stay word + sentence.
  const reminder = { toggle: { ...DEFAULT_REMINDER, enabled: false }, examDate: null, dailyGoal: 15, installDay: null };
  return { content: new ContentRepository(db), progress: new ProgressRepository(db), reminder };
}

describe('notification sync', () => {
  it('schedules two weeks of word and sentence notifications with real content', async () => {
    const deps = await setup();
    const api = new FakeNotifications();
    const result = await syncNotifications(api, { ...deps, settings: DEFAULT_NOTIFICATION_SETTINGS, today: '2026-10-25', learner: { openUnitIds: ['u01'], level: 'A2' }, now: new Date(2026, 9, 25, 7, 0) });
    expect(result).toEqual({ scheduled: 28, permission: true });
    const first = api.scheduled.get('word-2026-10-25')!;
    expect(first.title).toBe('Mot du jour · le mot0');
    expect(first.body).toBe('word 0 — Exemple 0.');
    expect(api.scheduled.get('sentence-2026-10-25')?.body).toBe('Phrase 0.');
  });

  it('is idempotent and keeps the same items when re-run (e.g. after a reboot)', async () => {
    const deps = await setup();
    const api = new FakeNotifications();
    const args = { ...deps, settings: DEFAULT_NOTIFICATION_SETTINGS, today: '2026-10-25', learner: { openUnitIds: ['u01'], level: 'A2' as const }, now: new Date(2026, 9, 25, 7, 0) };
    await syncNotifications(api, args);
    const before = [...api.scheduled.values()].map((n) => `${n.id}:${n.body}`);
    await syncNotifications(api, args);
    expect([...api.scheduled.values()].map((n) => `${n.id}:${n.body}`)).toEqual(before);
  });

  it('rolls forward day by day without repeating words or sentences', async () => {
    const deps = await setup();
    const api = new FakeNotifications();
    const bodies = new Set<string>();
    for (let d = 25; d <= 31; d += 1) {
      await syncNotifications(api, { ...deps, settings: DEFAULT_NOTIFICATION_SETTINGS, today: `2026-10-${d}`, learner: { openUnitIds: ['u01'], level: 'A2' }, now: new Date(2026, 9, d, 7, 0) });
      const today = api.scheduled.get(`sentence-2026-10-${d}`)!;
      bodies.add(today.body);
    }
    expect(bodies.size).toBe(7);
    const items = await deps.progress.dailyItems();
    expect(new Set([...items.values()].map((i) => i.wordId)).size).toBe(items.size);
  });

  it('schedules nothing without permission or with both toggles off', async () => {
    const deps = await setup();
    const denied = new FakeNotifications(false);
    expect((await syncNotifications(denied, { ...deps, settings: DEFAULT_NOTIFICATION_SETTINGS, today: '2026-10-25', learner: { openUnitIds: [], level: 'A2' }, now: new Date(2026, 9, 25) })).scheduled).toBe(0);
    const off = { word: { ...DEFAULT_NOTIFICATION_SETTINGS.word, enabled: false }, sentence: { ...DEFAULT_NOTIFICATION_SETTINGS.sentence, enabled: false } };
    const api = new FakeNotifications();
    await api.schedule({ id: 'stale', kind: 'word', day: 'x', fireAt: new Date(), title: '', body: '', url: '' });
    expect((await syncNotifications(api, { ...deps, settings: off, today: '2026-10-25', learner: { openUnitIds: [], level: 'A2' }, now: new Date(2026, 9, 25) })).scheduled).toBe(0);
    expect(api.scheduled.size).toBe(0);
  });

  it('reschedules at the new local time after a settings or time-zone change', async () => {
    const deps = await setup();
    const api = new FakeNotifications();
    const settings = { ...DEFAULT_NOTIFICATION_SETTINGS, word: { enabled: true, time: { hour: 6, minute: 45 } } };
    await syncNotifications(api, { ...deps, settings, today: '2026-10-25', learner: { openUnitIds: ['u01'], level: 'A2' }, now: new Date(2026, 9, 25, 5, 0) });
    const words = [...api.scheduled.values()].filter((n) => n.kind === 'word');
    expect(words.every((n) => n.fireAt.getHours() === 6 && n.fireAt.getMinutes() === 45)).toBe(true);
  });

  it('moves future daily sentences to the new level when the learner moves up, keeping today', async () => {
    const deps = await setup();
    const api = new FakeNotifications();
    const base = { ...deps, settings: DEFAULT_NOTIFICATION_SETTINGS, today: '2026-10-25', now: new Date(2026, 9, 25, 7, 0) };
    await syncNotifications(api, { ...base, learner: { openUnitIds: ['u01'], level: 'A2' } });
    const before = await deps.progress.dailyItems();
    expect([...before.values()].every((r) => Number(r.sentenceId.slice(1)) <= 30)).toBe(true);

    await syncNotifications(api, { ...base, learner: { openUnitIds: ['u01'], level: 'A2+' } });
    const after = await deps.progress.dailyItems();
    expect(after.get('2026-10-25')).toEqual(before.get('2026-10-25'));
    const future = [...after.values()].filter((r) => r.day > '2026-10-25');
    expect(future).toHaveLength(13);
    expect(future.every((r) => Number(r.sentenceId.slice(1)) > 30)).toBe(true);
    expect(api.scheduled.get('sentence-2026-10-26')?.body).toBe(`Phrase ${Number(after.get('2026-10-26')!.sentenceId.slice(1)) - 1}.`);
  });

  it('leaves daily items alone when the level has not changed', async () => {
    const deps = await setup();
    const api = new FakeNotifications();
    const args = { ...deps, settings: DEFAULT_NOTIFICATION_SETTINGS, today: '2026-10-25', learner: { openUnitIds: ['u01'], level: 'A2' as const }, now: new Date(2026, 9, 25, 7, 0) };
    await syncNotifications(api, args);
    const before = await deps.progress.dailyItems();
    await syncNotifications(api, args);
    expect(await deps.progress.dailyItems()).toEqual(before);
  });

  it('reminds after missed days, counted from the last study day', async () => {
    const deps = await setup();
    const api = new FakeNotifications();
    const off = { word: { ...DEFAULT_NOTIFICATION_SETTINGS.word, enabled: false }, sentence: { ...DEFAULT_NOTIFICATION_SETTINGS.sentence, enabled: false } };
    await deps.progress.addStudy('2026-10-23', { seconds: 300 });
    const reminder = { ...deps.reminder, toggle: DEFAULT_REMINDER, examDate: '2026-11-20' };
    await syncNotifications(api, { ...deps, reminder, settings: off, today: '2026-10-25', learner: { openUnitIds: [], level: 'A2' }, now: new Date(2026, 9, 25, 9, 0) });
    const days = [...api.scheduled.values()].map((n) => n.day);
    // Last studied the 23rd: 1 missed day on the 25th, then 2, 4, 7, 12, 19, 26.
    expect(days).toEqual(['2026-10-25', '2026-10-26', '2026-10-28', '2026-10-31', '2026-11-05', '2026-11-12', '2026-11-19']);
    expect(api.scheduled.get('reminder-2026-10-25')?.body).toContain('26 days to your TCF');

    // Studying today moves the anchor: no reminder until a day is missed again.
    await deps.progress.addStudy('2026-10-25', { seconds: 300 });
    await syncNotifications(api, { ...deps, reminder, settings: off, today: '2026-10-25', learner: { openUnitIds: [], level: 'A2' }, now: new Date(2026, 9, 25, 9, 0) });
    expect([...api.scheduled.values()][0]?.day).toBe('2026-10-27');
  });

  it('uses the install day before any study, and nothing when reminders are off', async () => {
    const deps = await setup();
    const api = new FakeNotifications();
    const reminder = { ...deps.reminder, toggle: DEFAULT_REMINDER, installDay: '2026-10-24' };
    await syncNotifications(api, { ...deps, reminder, settings: DEFAULT_NOTIFICATION_SETTINGS, today: '2026-10-25', learner: { openUnitIds: ['u01'], level: 'A2' }, now: new Date(2026, 9, 25, 7, 0) });
    expect(api.scheduled.has('reminder-2026-10-26')).toBe(true);
    expect(api.scheduled.has('reminder-2026-10-25')).toBe(false);
    await syncNotifications(api, { ...deps, settings: DEFAULT_NOTIFICATION_SETTINGS, today: '2026-10-25', learner: { openUnitIds: ['u01'], level: 'A2' }, now: new Date(2026, 9, 25, 7, 0) });
    expect([...api.scheduled.keys()].some((k) => k.startsWith('reminder'))).toBe(false);
  });

  it('adds a backup notification on the due day only when the learner turned it on', async () => {
    const deps = await setup();
    const api = new FakeNotifications();
    const base = { ...deps, settings: DEFAULT_NOTIFICATION_SETTINGS, today: '2026-10-25', learner: { openUnitIds: ['u01'], level: 'A2' as const }, now: new Date(2026, 9, 25, 7, 0) };
    await syncNotifications(api, { ...base, backup: { settings: { intervalDays: 14, notify: false }, lastBackupDay: '2026-10-20' } });
    expect([...api.scheduled.keys()].some((k) => k.startsWith('backup'))).toBe(false);
    await syncNotifications(api, { ...base, backup: { settings: { intervalDays: 14, notify: true }, lastBackupDay: '2026-10-20' } });
    expect(api.scheduled.get('backup-2026-11-03')).toMatchObject({ kind: 'backup', url: '/settings' });
  });
});

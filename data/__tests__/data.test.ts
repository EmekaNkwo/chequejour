/**
 * @jest-environment node
 */
import type { ContentBundle } from '../../domain/content-types';
import { newCard, reviewCard } from '../../domain/srs';
import { exportProgress, importProgress, parseBackup, resetProgress } from '../backup';
import { ContentRepository } from '../content-repo';
import { seedContentIfNeeded } from '../content-seed';
import { migrate, SCHEMA_VERSION } from '../migrations';
import { ProgressRepository } from '../progress-repo';
import { DEFAULT_SETTINGS, loadSettings, saveSetting } from '../settings-repo';
import { createNodeDb } from '../../test-utils/node-db';

const bundle: ContentBundle = {
  version: 1,
  builtAt: 'now',
  units: [
    {
      id: 'u01', order: 1, level: 'A2', theme: 'Daily life', titleFr: 'La vie quotidienne', description: 'd',
      vocab: [
        { id: 'u01-w001', fr: 'réveil', en: 'alarm clock', pos: 'noun', gender: 'm', plural: 'réveils', level: 'A2', core: true, example: { fr: 'Mon réveil sonne.', en: 'My alarm rings.' } },
        { id: 'u01-w002', fr: 'se lever', en: 'to get up', pos: 'verb', level: 'A2', core: false, example: { fr: 'Je me lève tôt.', en: 'I get up early.' } },
      ],
      grammar: [{ id: 'u01-g01', title: 'Le présent', level: 'A2', grammarTag: 'present', explanation: ['x'], examples: [], commonMistakes: [] }],
      exercises: [{ id: 'u01-ex01', type: 'mcq', level: 'A2', skill: 'structures', grammarTag: 'present', explanation: 'e', prompt: 'p', options: ['a', 'b'], answer: 0 }],
      checkpoint: [],
      listening: [{ id: 'u01-li01', title: 'Au café', level: 'A2', kind: 'dialogue', context: 'c', lines: [{ speaker: 'A', fr: 'Bonjour' }], translation: 't', questions: [] }],
      reading: [], writing: [], speaking: [],
    },
    {
      id: 'u02', order: 2, level: 'A2', theme: 'Family', titleFr: 'La famille', description: 'd',
      vocab: [{ id: 'u02-w001', fr: 'sœur', en: 'sister', pos: 'noun', gender: 'f', level: 'A2', core: true, example: { fr: 'Ma sœur est là.', en: 'My sister is here.' } }],
      grammar: [], exercises: [], checkpoint: [], listening: [], reading: [], writing: [], speaking: [],
    },
  ],
  sentences: [
    { id: 's002', fr: 'B', en: 'B', grammarNote: 'n', grammarTag: 'present', level: 'A2' },
    { id: 's001', fr: 'A', en: 'A', grammarNote: 'n', grammarTag: 'present', level: 'A2' },
  ],
  placement: { version: 1, questions: [] },
  mockTests: [],
};

async function setup() {
  const db = createNodeDb();
  await migrate(db);
  await seedContentIfNeeded(db, bundle);
  return { db, content: new ContentRepository(db), progress: new ProgressRepository(db) };
}

describe('migrations and seeding', () => {
  it('migrates to the latest schema and is idempotent', async () => {
    const db = createNodeDb();
    await migrate(db);
    await migrate(db);
    expect((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []))?.user_version).toBe(SCHEMA_VERSION);
  });
  it('seeds content once per version and reseeds on a newer bundle', async () => {
    const { db } = await setup();
    expect(await seedContentIfNeeded(db, bundle)).toBe(false);
    expect(await seedContentIfNeeded(db, { ...bundle, version: 2 })).toBe(true);
  });
  it('keeps progress when content is reseeded', async () => {
    const { db, progress } = await setup();
    await progress.addCards([newCard('u01-w001', 'word', 0)], 0);
    await seedContentIfNeeded(db, { ...bundle, version: 3 });
    expect(await progress.card('u01-w001')).not.toBeNull();
  });
});

describe('content repository', () => {
  it('reads units and assembles a full unit', async () => {
    const { content } = await setup();
    expect((await content.units()).map((u) => u.id)).toEqual(['u01', 'u02']);
    const unit = await content.unit('u01');
    expect(unit?.vocab).toHaveLength(2);
    expect(unit?.exercises[0].id).toBe('u01-ex01');
    expect(await content.unit('nope')).toBeNull();
  });
  it('orders word and sentence ids', async () => {
    const { content } = await setup();
    expect(await content.wordIds()).toEqual(['u01-w001', 'u01-w002', 'u02-w001']);
    expect(await content.wordIds(['u02'])).toEqual(['u02-w001']);
  });
  it('lists a headword taught in two units only once for daily rotation', async () => {
    const db = createNodeDb();
    await migrate(db);
    const dup = { ...bundle.units[0].vocab[0], id: 'u02-w002' };
    await seedContentIfNeeded(db, { ...bundle, units: [bundle.units[0], { ...bundle.units[1], vocab: [...bundle.units[1].vocab, dup] }] });
    const content = new ContentRepository(db);
    expect(await content.wordIds()).toHaveLength(4);
    expect(await content.wordIds(undefined, { uniqueHeadwords: true })).toEqual(['u01-w001', 'u01-w002', 'u02-w001']);
    expect(await content.wordIds(['u02'], { uniqueHeadwords: true })).toEqual(['u02-w001']);
    expect(await content.sentenceIds()).toEqual(['s001', 's002']);
  });
  it('fetches items by kind, lists skill items and searches words', async () => {
    const { content } = await setup();
    expect((await content.item('word', 'u02-w001'))?.fr).toBe('sœur');
    expect(await content.item('word', 'missing')).toBeNull();
    expect((await content.skillItems())[0]).toMatchObject({ id: 'u01-li01', kind: 'listening', unitOrder: 1 });
    expect((await content.search('alarm')).map((v) => v.id)).toEqual(['u01-w001']);
    expect(await content.search('id')).toEqual([]);
    expect(await content.search('%')).toEqual([]);
    expect((await content.search('lève')).map((v) => v.id)).toEqual(['u01-w002']);
    expect(await content.levelOf('u01-ex01')).toBe('A2');
    expect(await content.countKind('word')).toBe(3);
  });
});

describe('progress repository', () => {
  it('stores cards and reviews', async () => {
    const { progress } = await setup();
    expect(await progress.addCards([newCard('a', 'word', 0), newCard('a', 'word', 0)], 0)).toBe(1);
    const card = (await progress.card('a'))!;
    const next = reviewCard(card, 'good', 1000);
    await progress.saveReview(next, 'good', 1000);
    expect((await progress.card('a'))?.reps).toBe(1);
    expect(await progress.dueCards(0)).toHaveLength(0);
    expect(await progress.dueCards(next.due)).toHaveLength(1);
  });
  it('records mistakes, brings repeats back and resolves after retries', async () => {
    const { progress } = await setup();
    const m = { itemId: 'u01-ex01', skill: 'structures' as const, grammarTag: 'present' as const, prompt: 'p', userAnswer: 'x', correctAnswer: 'y', explanation: 'e', at: 0 };
    await progress.recordMistake(m);
    await progress.recordMistake({ ...m, userAnswer: 'z' });
    const [saved] = await progress.mistakes();
    expect(saved).toMatchObject({ userAnswer: 'z', timesWrong: 2, resolved: false });
    expect(await progress.dueMistakes(0)).toHaveLength(0);
    expect(await progress.dueMistakes(86_400_000)).toHaveLength(1);
    await progress.retryMistake('u01-ex01', true, 0);
    await progress.retryMistake('u01-ex01', true, 0);
    expect(await progress.mistakes()).toHaveLength(0);
    expect(await progress.mistakes(true)).toHaveLength(1);
  });
  it('tracks segments, checkpoints and best scores', async () => {
    const { progress } = await setup();
    await progress.completeSegment('u01:words:1', 'u01', 1);
    expect(await progress.completedSegments()).toEqual(new Set(['u01:words:1']));
    await progress.saveCheckpoint('u01', 0.9, true, 1);
    await progress.saveCheckpoint('u01', 0.4, false, 2);
    expect((await progress.unitProgress()).get('u01')?.checkpointScore).toBe(0.9);
  });
  it('accumulates study time and derives active days', async () => {
    const { progress } = await setup();
    await progress.addStudy('2026-10-25', { seconds: 30 });
    await progress.addStudy('2026-10-25', { seconds: 40, reviews: 2 });
    await progress.addStudy('2026-10-24', { seconds: 20 });
    expect(await progress.studyDays('2026-10-24', '2026-10-25')).toEqual([
      { day: '2026-10-24', seconds: 20, reviews: 0, exercises: 0 },
      { day: '2026-10-25', seconds: 70, reviews: 2, exercises: 0 },
    ]);
    expect(await progress.activeDays()).toEqual(new Set(['2026-10-25']));
  });
  it('persists daily items without overwriting', async () => {
    const { progress } = await setup();
    await progress.saveDailyItems([{ day: '2026-10-25', wordId: 'a', sentenceId: 's1' }]);
    await progress.saveDailyItems([{ day: '2026-10-25', wordId: 'b', sentenceId: 's2' }]);
    await progress.markDailyOpened('2026-10-25', 'word');
    expect((await progress.dailyItems()).get('2026-10-25')).toEqual({ day: '2026-10-25', wordId: 'a', sentenceId: 's1', wordOpened: true, sentenceOpened: false });
  });
  it('tracks skill items, drafts, recordings and mock results', async () => {
    const { progress } = await setup();
    await progress.setPlayedFraction('u01-li01', 'listening', 'u01', 0.5);
    await progress.setPlayedFraction('u01-li01', 'listening', 'u01', 0.2);
    await progress.completeSkillItem('u01-li01', 'listening', 'u01', 0.67, 5);
    await progress.setSaved('u01-li01', 'listening', 'u01', true);
    expect((await progress.skillProgress()).get('u01-li01')).toMatchObject({ playedFraction: 0.5, score: 0.67, saved: true, lastDoneAt: 5 });
    await progress.saveDraft('w1', 'Bonjour', [true, false], 1);
    expect(await progress.draft('w1')).toEqual({ text: 'Bonjour', checklist: [true, false] });
    await progress.addRecording('sp1', 'file:///a.m4a', 3000, 1);
    const [rec] = await progress.recordings('sp1');
    await progress.deleteRecording(rec.id);
    expect(await progress.recordings()).toHaveLength(0);
    await progress.saveMockResult('mk1', { listening: 0.5 }, 0.5, 1);
    expect((await progress.mockResults())[0].sectionScores).toEqual({ listening: 0.5 });
  });
  it('records attempts and filters placement from the level window', async () => {
    const { progress } = await setup();
    const base = { itemId: 'x', unitId: null, skill: 'structures' as const, grammarTag: 'present' as const, level: 'B1' as const };
    await progress.recordAttempt({ ...base, correct: true, context: 'lesson', at: 10 });
    await progress.recordAttempt({ ...base, correct: false, context: 'placement', at: 20 });
    expect(await progress.recentAttempts(10)).toEqual([{ correct: true, level: 'B1' }]);
    expect(await progress.attemptsBetween(0, 15)).toHaveLength(1);
  });
});

describe('settings', () => {
  it('returns defaults and persists validated values', async () => {
    const { db } = await setup();
    expect(await loadSettings(db)).toEqual(DEFAULT_SETTINGS);
    await saveSetting(db, 'dailyGoal', 20);
    await saveSetting(db, 'notifications', { word: { enabled: false, time: { hour: 7, minute: 15 } }, sentence: DEFAULT_SETTINGS.notifications.sentence });
    const s = await loadSettings(db);
    expect(s.dailyGoal).toBe(20);
    expect(s.notifications.word).toEqual({ enabled: false, time: { hour: 7, minute: 15 } });
  });
  it('falls back to defaults on corrupt values and rejects invalid writes', async () => {
    const { db } = await setup();
    await db.runAsync("INSERT INTO settings (key, value) VALUES ('dailyGoal', '{bad')", []);
    await db.runAsync("INSERT INTO settings (key, value) VALUES ('theme', '\"neon\"')", []);
    const s = await loadSettings(db);
    expect([s.dailyGoal, s.theme]).toEqual([15, 'system']);
    await expect(saveSetting(db, 'dailyGoal', 12 as never)).rejects.toThrow();
  });
  it('persists the playback speed and only accepts listed speeds', async () => {
    const { db } = await setup();
    await saveSetting(db, 'playbackRate', 1.25);
    expect((await loadSettings(db)).playbackRate).toBe(1.25);
    await expect(saveSetting(db, 'playbackRate', 3 as never)).rejects.toThrow();
  });
  it('carries over the old slow audio setting as a slower speed', async () => {
    const { db } = await setup();
    await db.runAsync("INSERT INTO settings (key, value) VALUES ('audioSpeed', '\"slow\"')", []);
    expect((await loadSettings(db)).playbackRate).toBe(0.75);
  });
});

describe('backup', () => {
  it('round-trips progress through export and import', async () => {
    const { db, progress } = await setup();
    await progress.addCards([newCard('u01-w001', 'word', 0)], 0);
    await progress.addStudy('2026-10-25', { seconds: 120 });
    await saveSetting(db, 'dailyGoal', 10);
    const json = JSON.stringify(await exportProgress(db, new Date(0)));
    await resetProgress(db);
    expect(await progress.allCards()).toHaveLength(0);
    expect(await importProgress(db, json)).toEqual({ ok: true, rows: 3 });
    expect(await progress.card('u01-w001')).not.toBeNull();
    expect((await loadSettings(db)).dailyGoal).toBe(10);
  });
  it('rejects invalid, foreign and newer backups without touching data', async () => {
    const { db, progress } = await setup();
    await progress.addCards([newCard('keep', 'word', 0)], 0);
    expect(parseBackup('nope').ok).toBe(false);
    expect((await importProgress(db, JSON.stringify({ app: 'other' }))).ok).toBe(false);
    const newer = { ...(await exportProgress(db, new Date(0))), schemaVersion: 999 };
    expect((await importProgress(db, JSON.stringify(newer))).ok).toBe(false);
    expect(await progress.card('keep')).not.toBeNull();
  });
  it('ignores unknown columns', async () => {
    const { db, progress } = await setup();
    const backup = await exportProgress(db, new Date(0));
    backup.tables.study_days.push({ day: '2026-01-01', seconds: 60, reviews: 0, exercises: 0, evil_col: 'x' });
    expect((await importProgress(db, JSON.stringify(backup))).ok).toBe(true);
    expect(await progress.activeDays()).toEqual(new Set(['2026-01-01']));
  });
});

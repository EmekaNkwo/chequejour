/**
 * @jest-environment node
 */
import { addDays, fromDayKey } from '../../domain/dates';
import { newCard } from '../../domain/srs';
import { realBundle, setupRealContent } from '../../test-utils/real-content';
import { dailyContent, ensureDailyItems, openDailyItem } from '../daily/daily-service';
import { learnerFor } from '../daily/daily-learner';
import { dayParam, loadDaily, previousDays } from '../daily/load-daily';
import { loadHome } from '../home/home-data';
import { loadPath } from '../path/path-service';
import { lastSevenDays, levelOverview, skillBreakdown, streak, thisWeek } from '../progress/stats-service';

const TODAY = '2026-10-26'; // a Monday
const DAY_START = fromDayKey(TODAY).getTime();
const NOW = DAY_START + 10 * 3_600_000;

async function setup(settings = {}) {
  const app = await setupRealContent(settings);
  return { ...app, today: TODAY };
}

describe('stats service', () => {
  it('summarises the level for a new learner', async () => {
    const { content, progress } = await setup();
    const path = await loadPath(content, progress, null, new Set());
    const overview = await levelOverview(progress, path, null, 0);
    expect(overview).toMatchObject({ mockUnlocked: false, completedUnits: 0, totalUnits: realBundle.units.length, mastered: 0 });
    expect(overview.estimate.value).toBeGreaterThanOrEqual(0);
  });

  it('unlocks the mock once every A2 unit is completed', async () => {
    const { content, progress } = await setup();
    // The A1 units are optional for this: only A2 and A2+ count.
    for (const u of realBundle.units.filter((x) => x.level === 'A2' || x.level === 'A2+')) await progress.saveCheckpoint(u.id, 1, true, 1);
    const path = await loadPath(content, progress, null, new Set());
    const overview = await levelOverview(progress, path, 'A2', 5);
    expect(overview.completedUnits).toBe(10);
    expect(overview.mockUnlocked).toBe(true);
    expect(overview.mastered).toBe(5);
  });

  it('lists the last seven days with rounded minutes and reviews', async () => {
    const { progress } = await setup();
    await progress.addStudy(TODAY, { seconds: 90, reviews: 2 });
    await progress.addStudy(addDays(TODAY, -6), { seconds: 600 });
    await progress.addStudy(addDays(TODAY, -7), { seconds: 600 });
    const days = await lastSevenDays(progress, TODAY);
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ day: addDays(TODAY, -6), minutes: 10, reviews: 0 });
    expect(days[6]).toEqual({ day: TODAY, minutes: 2, reviews: 2 });
    expect(days[3]).toEqual({ day: addDays(TODAY, -3), minutes: 0, reviews: 0 });
  });

  it('computes the streak from active days', async () => {
    const { progress } = await setup();
    await progress.addStudy(addDays(TODAY, -1), { reviews: 1 });
    await progress.addStudy(TODAY, { exercises: 1 });
    expect(await streak(progress, TODAY)).toMatchObject({ current: 2, activeToday: true });
  });

  it('summarises the current Monday-to-Sunday week only', async () => {
    const { progress } = await setup();
    const base = { itemId: 'x', unitId: null, skill: 'structures' as const, grammarTag: 'present' as const, level: 'A2' as const, context: 'lesson' as const };
    await progress.recordAttempt({ ...base, correct: true, at: NOW });
    await progress.recordAttempt({ ...base, correct: false, at: NOW + 3_600_000 });
    await progress.recordAttempt({ ...base, correct: false, at: DAY_START - 1 });
    await progress.addCards([newCard('u01-w001', 'word', NOW)], NOW);
    await progress.addStudy(TODAY, { seconds: 300, reviews: 3 });
    const week = await thisWeek(progress, addDays(TODAY, 3));
    expect(week).toMatchObject({ from: TODAY, to: addDays(TODAY, 6), accuracy: 0.5, wordsLearned: 1, reviews: 3, minutes: 5, daysStudied: 1 });
  });

  it('breaks progress down by skill', async () => {
    const { content, progress } = await setup();
    const listening = (await content.skillItems()).filter((i) => i.kind === 'listening');
    await progress.completeSkillItem(listening[0].id, 'listening', listening[0].unitId, 1, NOW);
    const firstSegment = `${realBundle.units[0].id}:words:1`;
    await progress.completeSegment(firstSegment, 'u01', NOW);
    await progress.recordAttempt({ itemId: 'q', unitId: null, skill: 'listening', grammarTag: null, level: 'A2', correct: true, context: 'lesson', at: NOW });
    const path = await loadPath(content, progress, null, new Set());
    const stats = await skillBreakdown(content, progress, path);
    const of = (skill: string) => stats.find((s) => s.skill === skill)!;
    expect(of('listening')).toEqual({ skill: 'listening', attempts: 1, accuracy: 1, completion: 1 / listening.length });
    expect(of('reading')).toMatchObject({ attempts: 0, accuracy: null, completion: 0 });
    const segmentsTotal = path.units.reduce((n, u) => n + u.segmentsTotal, 0);
    expect(of('structures').completion).toBeCloseTo(1 / segmentsTotal);
  });

  it('reports zero completion when there is nothing to complete', async () => {
    const { content, progress } = await setup();
    const empty = { units: [], completedSegments: new Set<string>() } as unknown as Parameters<typeof skillBreakdown>[2];
    const noItems = { skillItems: async () => [] } as unknown as typeof content;
    const stats = await skillBreakdown(noItems, progress, empty);
    expect(stats.every((s) => s.completion === 0)).toBe(true);
  });
});

describe('daily items', () => {
  it('validates the day route param', () => {
    expect(dayParam('2026-10-20', TODAY)).toBe('2026-10-20');
    expect(dayParam(['2026-10-21', 'x'], TODAY)).toBe('2026-10-21');
    expect(dayParam('2026-10-27', TODAY)).toBe(TODAY);
    expect(dayParam('yesterday', TODAY)).toBe(TODAY);
    expect(dayParam(undefined, TODAY)).toBe(TODAY);
  });

  it('assigns items on demand when opened before the app did so', async () => {
    const app = await setup();
    expect(await dailyContent(app.content, app.progress, TODAY)).toBeNull();
    const daily = await loadDaily(app, TODAY);
    expect(daily?.day).toBe(TODAY);
    expect(daily?.word?.id).toMatch(/^u01-w/);
    expect(daily?.sentence?.id).toMatch(/^s/);
    expect(daily).toMatchObject({ wordOpened: false, sentenceOpened: false });
    // Already assigned: the same items come back.
    expect(await loadDaily(app, TODAY)).toEqual(daily);
  });

  it('opening an item marks it seen and adds it to reviews', async () => {
    const app = await setup();
    const daily = (await loadDaily(app, TODAY))!;
    await openDailyItem(app.progress, TODAY, 'word', daily.word!.id, NOW);
    expect((await dailyContent(app.content, app.progress, TODAY))?.wordOpened).toBe(true);
    expect((await app.progress.card(daily.word!.id))?.itemKind).toBe('word');
  });

  it('lists earlier days with items, most recent first', async () => {
    const app = await setup();
    await app.progress.saveDailyItems(
      [1, 2, 3].map((n) => ({ day: addDays(TODAY, -n), wordId: 'u01-w001', sentenceId: 's001' })),
    );
    await ensureDailyItems(app.content, app.progress, TODAY, { openUnitIds: ['u01'], level: 'A2' });
    expect(await previousDays(app, TODAY)).toEqual([addDays(TODAY, -1), addDays(TODAY, -2), addDays(TODAY, -3)]);
    expect(await previousDays(app, TODAY, 1)).toEqual([addDays(TODAY, -1)]);
  });

  it('gives an A1 learner A1 words and sentences of the day', async () => {
    const app = await setup();
    const learner = await learnerFor(app.content, app.progress, 'A1');
    expect(learner.level).toBe('A1');
    const days = await ensureDailyItems(app.content, app.progress, TODAY, learner);
    const levels = await app.content.itemLevels();
    expect(days.length).toBeGreaterThan(0);
    for (const d of days.slice(0, 14)) {
      expect(levels.get(d.wordId)).toBe('A1');
      expect(levels.get(d.sentenceId)).toBe('A1');
    }
  });

  it('moves today and the coming days to the new level when the learner’s level changes', async () => {
    const app = await setup();
    const levels = await app.content.itemLevels();
    await ensureDailyItems(app.content, app.progress, TODAY, { openUnitIds: [], level: 'B1' });
    const before = await app.progress.dailyItems();
    expect(levels.get(before.get(TODAY)!.wordId)).toBe('B1');
    await openDailyItem(app.progress, TODAY, 'word', before.get(TODAY)!.wordId, NOW);
    const after = await ensureDailyItems(app.content, app.progress, TODAY, { openUnitIds: [], level: 'A1' });
    const byDay = new Map(after.map((a) => [a.day, a]));
    expect(levels.get(byDay.get(TODAY)!.wordId)).toBe('A1');
    expect(levels.get(byDay.get(TODAY)!.sentenceId)).toBe('A1');
    // Today switches even though the learner had opened it.
    expect((await dailyContent(app.content, app.progress, TODAY))?.wordOpened).toBe(false);
    for (const d of after) {
      expect(levels.get(d.wordId)).toBe('A1');
      expect(levels.get(d.sentenceId)).toBe('A1');
    }
  });

  it('keeps every level’s daily items at that level for months', async () => {
    const app = await setup();
    const levels = await app.content.itemLevels();
    for (const level of ['A1', 'A1+', 'A2', 'A2+', 'B1'] as const) {
      await app.progress.deleteDailyItems([...(await app.progress.dailyItems()).keys()]);
      for (let week = 0; week < 20; week += 1) {
        const days = await ensureDailyItems(app.content, app.progress, addDays(TODAY, week * 7), { openUnitIds: [], level });
        for (const d of days) {
          expect([level, levels.get(d.wordId), levels.get(d.sentenceId)]).toEqual([level, level, level]);
        }
      }
    }
  });

  it('assigns nothing when the content has no words', async () => {
    const app = await setup();
    const empty = { ...app.content, wordIds: async () => [], sentenceIds: async () => [], itemLevels: async () => new Map() } as unknown as typeof app.content;
    expect(await ensureDailyItems(empty, app.progress, TODAY, { openUnitIds: [], level: 'A2' })).toEqual([]);
    expect((await app.progress.dailyItems()).size).toBe(0);
  });
});

describe('loadHome', () => {
  it('gathers everything the home screen shows', async () => {
    const app = await setup();
    const home = await loadHome(app);
    expect(home.path.current?.id).toBe('u01');
    expect(home.plan.day).toBe(TODAY);
    expect(home.daily?.day).toBe(TODAY);
    expect(home.unseenDaily).toBe(true);
    expect(home.activity).toHaveLength(7);
    expect(home.level.totalUnits).toBe(realBundle.units.length);
    expect(home.streak.current).toBe(0);
    expect(home.examDays).toBeNull();
    expect(home.weakest).toBeNull();
  });

  it('counts down to the exam and clears the unseen badge once both items are opened', async () => {
    const app = await setup({ examDate: addDays(TODAY, 30) });
    const first = await loadHome(app);
    await app.progress.markDailyOpened(TODAY, 'word');
    await app.progress.markDailyOpened(TODAY, 'sentence');
    const home = await loadHome(app);
    expect(first.examDays).toBe(30);
    expect(home.unseenDaily).toBe(false);
  });
});

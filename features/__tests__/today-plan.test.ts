/**
 * @jest-environment node
 */
import { fromDayKey } from '../../domain/dates';
import type { SessionStep } from '../../domain/session';
import { unitSegments } from '../../domain/unit-path';
import { realBundle, setupRealContent } from '../../test-utils/real-content';
import { practiceRunId, saveMockRun } from '../mock/mock-service';
import { loadPath } from '../path/path-service';
import { learnWords } from '../session/session-service';
import { resetTodayPlan, todayPlan } from '../session/today-plan';

const TODAY = '2026-10-26';
const DAY_START = fromDayKey(TODAY).getTime();
const NOW = DAY_START + 10 * 3_600_000;
const u01 = realBundle.units[0];
const writingTask = realBundle.mockTests[0].writing[0];

async function setup() {
  const app = await setupRealContent();
  const path = await loadPath(app.content, app.progress, null, new Set());
  return { ...app, path };
}

describe('todayPlan', () => {
  it('plans the day once and stores it so later calls keep the same steps', async () => {
    const { content, progress, path } = await setup();
    const plan = await todayPlan(content, progress, path, 15, TODAY, NOW);
    expect(plan.day).toBe(TODAY);
    expect(plan.steps.map((s) => s.step.kind)).toEqual(['lesson', 'skill']);
    expect(plan.steps.every((s) => !s.done)).toBe(true);
    expect(plan.completion).toBe(0);
    expect(plan.summary).toMatch(/^1 lesson · 1 /);
    expect(plan.remaining).toBe(plan.summary);
    expect(JSON.parse((await progress.meta(`session:${TODAY}`))!)).toEqual(plan.steps.map((s) => s.step));

    // New due reviews don't reshape a plan already made for today.
    await learnWords(progress, ['u01-w001'], 0);
    expect((await todayPlan(content, progress, path, 15, TODAY, NOW)).steps).toHaveLength(2);
  });

  it('replans after a reset', async () => {
    const { content, progress, path } = await setup();
    await todayPlan(content, progress, path, 15, TODAY, NOW);
    await learnWords(progress, ['u01-w001'], 0);
    await resetTodayPlan(progress, TODAY);
    expect(await progress.meta(`session:${TODAY}`)).toBe('');
    const plan = await todayPlan(content, progress, path, 15, TODAY, NOW);
    expect(plan.steps[0].step).toEqual({ kind: 'review', itemIds: ['u01-w001'] });
  });

  it.each(['{not json', JSON.stringify([{ kind: 'mystery' }])])('rebuilds a stored plan that cannot be read (%s)', async (stored) => {
    const { content, progress, path } = await setup();
    await progress.setMeta(`session:${TODAY}`, stored);
    const plan = await todayPlan(content, progress, path, 15, TODAY, NOW);
    expect(plan.steps.map((s) => s.step.kind)).toEqual(['lesson', 'skill']);
  });

  it('counts an empty day as complete', async () => {
    const { content, progress, path } = await setup();
    await progress.setMeta(`session:${TODAY}`, '[]');
    const plan = await todayPlan(content, progress, path, 15, TODAY, NOW);
    expect(plan).toMatchObject({ steps: [], completion: 1, summary: 'All done for today', remaining: 'All done for today' });
  });

  it('ticks each kind of step off as the learner does it', async () => {
    const { content, progress } = await setup();
    await learnWords(progress, ['u01-w001', 'u01-w002'], 0);
    await progress.recordMistake({ itemId: 'u01-ex01', skill: 'structures', grammarTag: null, prompt: 'p', userAnswer: 'x', correctAnswer: 'y', explanation: 'e', at: 0 });
    const [m] = await progress.dueMistakes(NOW);
    const segment = unitSegments(u01)[0];
    const steps: SessionStep[] = [
      { kind: 'review', itemIds: ['u01-w001', 'u01-w002'] },
      { kind: 'mistakes', mistakeIds: [m.id] },
      { kind: 'lesson', segment },
      { kind: 'skill', task: { skill: 'listening', itemId: 'u01-li01', title: 'Listen' } },
      { kind: 'exam', practice: { skill: 'reading', itemId: practiceRunId('reading'), title: 'Reading set' } },
      { kind: 'exam', practice: { skill: 'writing', itemId: writingTask.id, title: 'Timed writing' } },
    ];
    await progress.setMeta(`session:${TODAY}`, JSON.stringify(steps));
    const load = async () => todayPlan(content, progress, await loadPath(content, progress, null, new Set()), 15, TODAY, NOW);

    const before = await load();
    expect(before.steps.map((s) => s.done)).toEqual([false, false, false, false, false, false]);
    expect(before.summary).toBe('2 reviews · 1 mistake · 1 lesson · 1 listening · 1 exam practice · 1 exam practice');

    // Skill work done yesterday doesn't count for today.
    await progress.completeSkillItem('u01-li01', 'listening', 'u01', 1, DAY_START - 1);
    await saveMockRun(progress, practiceRunId('reading'), { reading: 0.5 }, DAY_START - 1);
    expect((await load()).completion).toBe(0);

    await progress.retryMistake('u01-ex01', true, NOW);
    await progress.completeSegment(segment.id, 'u01', NOW);
    await progress.completeSkillItem('u01-li01', 'listening', 'u01', 1, NOW);
    await saveMockRun(progress, practiceRunId('reading'), { reading: 0.8 }, NOW);
    await progress.completeSkillItem(writingTask.id, 'writing', null, 0.6, NOW);
    const after = await load();
    expect(after.steps.map((s) => s.done)).toEqual([false, true, true, true, true, true]);
    expect(after.completion).toBeCloseTo(5 / 6);
    expect(after.remaining).toBe('2 reviews');

    const card = (await progress.card('u01-w001'))!;
    await progress.saveReview({ ...card, due: NOW * 2 }, 'good', NOW);
    const second = (await progress.card('u01-w002'))!;
    await progress.saveReview({ ...second, due: NOW * 2 }, 'good', NOW);
    expect((await load()).completion).toBe(1);
  });

  it('counts reviews as done once nothing from the step is still due', async () => {
    const { content, progress, path } = await setup();
    await progress.setMeta(`session:${TODAY}`, JSON.stringify([{ kind: 'review', itemIds: ['gone-1', 'gone-2'] }]));
    expect((await todayPlan(content, progress, path, 15, TODAY, NOW)).steps[0].done).toBe(true);
  });
});

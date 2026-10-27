/**
 * @jest-environment node
 */
import bundleJson from '../../content/build/content.json';
import type { ContentRepository } from '../../data/content-repo';
import { migrate } from '../../data/migrations';
import { ProgressRepository } from '../../data/progress-repo';
import type { ContentBundle } from '../../domain/content-types';
import { TCF_CANADA } from '../../domain/tcf/exam-format';
import { isEstimate } from '../../domain/tcf/nclc';
import { createNodeDb } from '../../test-utils/node-db';
import { isPracticeRun, mockHistory, practiceDoneSince, practiceMinutes, practiceRunId, practiceSet, runTotal, saveMockRun } from '../mock/mock-service';
import { loadExamContext, loadNclcOverview } from '../tcf/nclc-service';

const bundle = bundleJson as unknown as ContentBundle;
const DAY = 86_400_000;

async function setup() {
  const db = createNodeDb();
  await migrate(db);
  return new ProgressRepository(db);
}

const content = { levelOf: async () => 'B1' } as unknown as ContentRepository;

describe('mock content', () => {
  it('ships at least two complete TCF Canada mocks', () => {
    expect(bundle.mockTests.length).toBeGreaterThanOrEqual(2);
    for (const m of bundle.mockTests) {
      expect(m.listening.flatMap((i) => i.questions)).toHaveLength(TCF_CANADA.listening.questions);
      expect(m.reading.flatMap((i) => i.questions)).toHaveLength(TCF_CANADA.reading.questions);
      expect(m.writing.map((t) => t.taskType)).toEqual(['message', 'description', 'opinion']);
      expect(m.speaking.map((t) => t.taskType)).toEqual(['entretien', 'interaction', 'opinion']);
    }
  });
});

describe('mock service', () => {
  it('keeps practice runs out of the mock history, newest first', async () => {
    const progress = await setup();
    await saveMockRun(progress, 'mk1', { listening: 0.5, reading: 0.7 }, 1);
    await saveMockRun(progress, practiceRunId('reading'), { reading: 0.9 }, 2);
    await saveMockRun(progress, 'mk2', { writing: 0.6 }, 3);
    const history = await mockHistory(progress);
    expect(history.map((h) => h.mockId)).toEqual(['mk2', 'mk1']);
    expect(history[1].scores).toEqual({ listening: 0.5, reading: 0.7 });
    expect(isPracticeRun(practiceRunId('listening'))).toBe(true);
    expect(await practiceDoneSince(progress, 'reading', 2)).toBe(true);
    expect(await practiceDoneSince(progress, 'reading', 3)).toBe(false);
    expect(runTotal({ listening: 0.5, reading: 0.7 })).toBeCloseTo(0.6);
  });

  it('builds practice sets of whole items, about ten questions, rotating', () => {
    const first = practiceSet(bundle.mockTests, 'reading', 0);
    const second = practiceSet(bundle.mockTests, 'reading', 1);
    const count = (items: typeof first) => items.reduce((n, i) => n + i.questions.length, 0);
    expect(count(first)).toBeGreaterThanOrEqual(10);
    expect(count(first)).toBeLessThan(14);
    expect(second[0].id).not.toBe(first[0].id);
    expect(practiceSet([], 'listening', 0)).toEqual([]);
    expect(practiceMinutes('listening', 10)).toBe(Math.ceil((10 * 35) / 39));
  });
});

describe('NCLC service', () => {
  it('estimates from a recent mock and finds the weakest skill', async () => {
    const progress = await setup();
    const now = 100 * DAY;
    await saveMockRun(progress, 'mk1', { listening: 0.8, reading: 0.5, writing: 0.7, speaking: 0.65 }, now - DAY);
    const overview = await loadNclcOverview(content, progress, 7, now);
    expect(overview.weakest).toBe('reading');
    const listening = overview.skills.find((s) => s.skill === 'listening');
    expect(listening && isEstimate(listening) ? listening.nclc : null).toBe(7);
  });

  it('ignores mock and placement answers as practice evidence', async () => {
    const progress = await setup();
    for (let i = 0; i < 30; i++) {
      await progress.recordAttempt({ itemId: `q${i}`, unitId: null, skill: 'listening', grammarTag: null, level: 'B1', correct: true, context: i % 2 ? 'mock' : 'placement', at: i });
    }
    const overview = await loadNclcOverview(content, progress, 7, 100);
    expect(isEstimate(overview.skills[0])).toBe(false);
  });

  it('only needs the weakest skill when an exam date is set', async () => {
    const progress = await setup();
    await saveMockRun(progress, 'mk1', { listening: 0.3, reading: 0.9 }, 0);
    expect(await loadExamContext(content, progress, { examDate: null, targetNclc: 7 }, DAY)).toEqual({ examDate: null, weakest: null });
    expect(await loadExamContext(content, progress, { examDate: '2026-12-01', targetNclc: 7 }, DAY)).toEqual({ examDate: '2026-12-01', weakest: 'listening' });
  });
});

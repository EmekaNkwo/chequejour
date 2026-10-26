/**
 * @jest-environment node
 */
import type { ContentRepository } from '../../data/content-repo';
import type { Mistake } from '../../data/progress-repo';
import { dayNumber, fromDayKey } from '../../domain/dates';
import { MASTERY_STABILITY_DAYS, newCard, type SrsCard } from '../../domain/srs';
import { unitSegments } from '../../domain/unit-path';
import { realBundle, setupRealContent } from '../../test-utils/real-content';
import { practiceRunId, PRACTICE_QUESTIONS } from '../mock/mock-service';
import { dailyLearner, loadPath, openUnitIds, type PathState } from '../path/path-service';
import { examPracticeFor, gradeReview, learnWords, masteredIds, mistakeExercise, structuresUnitId, todaySession } from '../session/session-service';

const TODAY = '2026-10-26';
const NOW = fromDayKey(TODAY).getTime() + 10 * 3_600_000;
const u01 = realBundle.units[0];

const mastered = (itemId: string): SrsCard => ({ ...newCard(itemId, 'word', 0), state: 'review', stability: MASTERY_STABILITY_DAYS + 1, due: NOW * 10 });

const mistake = (itemId: string): Mistake =>
  ({ id: 1, itemId, skill: 'listening', grammarTag: null, prompt: 'p', userAnswer: 'x', correctAnswer: 'y', explanation: 'e' }) as unknown as Mistake;

describe('loadPath', () => {
  it('starts a new learner at unit 1 with the first segment next', async () => {
    const { content, progress } = await setupRealContent();
    const path = await loadPath(content, progress, null, new Set());
    expect(path.placementStart).toBe(1);
    expect(path.units).toHaveLength(realBundle.units.length);
    expect(path.current?.id).toBe('u01');
    expect(path.units[0].status).toBe('available');
    expect(path.units[1].status).toBe('locked');
    const segments = unitSegments(u01);
    expect(path.nextSegment).toEqual(segments[0]);
    expect(path.units[0]).toMatchObject({ segmentsDone: 0, segmentsTotal: segments.length, coreWords: u01.vocab.filter((v) => v.core).length, masteredWords: 0, checkpointScore: null });
  });

  it('counts completed segments, mastered core words and checkpoint scores', async () => {
    const { content, progress } = await setupRealContent();
    const firstSegment = unitSegments(u01)[0];
    await progress.completeSegment(firstSegment.id, 'u01', 1);
    await progress.saveCheckpoint('u01', 0.9, true, 2);
    const coreWord = u01.vocab.find((v) => v.core)!;
    const path = await loadPath(content, progress, null, new Set([coreWord.id]));
    expect(path.units[0]).toMatchObject({ status: 'completed', segmentsDone: 1, masteredWords: 1, checkpointScore: 0.9 });
    expect(path.units[1].status).toBe('available');
    expect(path.current?.id).toBe('u02');
    expect(path.completedSegments.has(firstSegment.id)).toBe(true);
  });

  it('starts an A2+ placement at unit 6 and keeps earlier units open', async () => {
    const { content, progress } = await setupRealContent();
    const path = await loadPath(content, progress, 'A2+', new Set());
    expect(path.placementStart).toBe(6);
    expect(path.current?.id).toBe('u06');
    expect(openUnitIds(path)).toEqual(['u01', 'u02', 'u03', 'u04', 'u05', 'u06']);
    expect(dailyLearner(path)).toEqual({ openUnitIds: openUnitIds(path), level: 'A2+' });
  });
});

describe('dailyLearner', () => {
  it('falls back to the last unit level, then A2, when there is no current unit', () => {
    const units = [{ id: 'u01', status: 'completed', level: 'A2' }, { id: 'u02', status: 'locked', level: 'B1' }];
    expect(dailyLearner({ units, current: null } as unknown as PathState)).toEqual({ openUnitIds: ['u01'], level: 'B1' });
    expect(dailyLearner({ units: [], current: null } as unknown as PathState)).toEqual({ openUnitIds: [], level: 'A2' });
  });
});

describe('session service', () => {
  it('reads the unit out of a structures task id', () => {
    expect(structuresUnitId('structures:u03')).toBe('u03');
    expect(structuresUnitId('u03-li01')).toBeNull();
  });

  it('builds today from due reviews, the next lesson and a skill task', async () => {
    const { content, progress } = await setupRealContent();
    await learnWords(progress, ['u01-w001', 'u01-w002'], NOW - 86_400_000);
    const path = await loadPath(content, progress, null, new Set());
    const steps = await todaySession(content, progress, path, 15, TODAY, NOW);
    expect(steps[0]).toEqual({ kind: 'review', itemIds: expect.arrayContaining(['u01-w001', 'u01-w002']) });
    expect(steps[1]).toEqual({ kind: 'lesson', segment: path.nextSegment });
    expect(steps[2].kind).toBe('skill');
    expect(steps.some((s) => s.kind === 'exam')).toBe(false);
  });

  it('adds mock-style practice in the final stretch before the exam', async () => {
    const { content, progress } = await setupRealContent();
    const path = await loadPath(content, progress, null, new Set());
    const steps = await todaySession(content, progress, path, 10, TODAY, NOW, { examDate: '2026-11-02', weakest: 'reading' });
    expect(steps[steps.length - 1]).toEqual({ kind: 'exam', practice: { skill: 'reading', itemId: practiceRunId('reading'), title: `Mock-style reading · about ${PRACTICE_QUESTIONS} questions` } });
  });

  it('picks timed writing and speaking tasks from the mocks, rotating by day', async () => {
    const { content } = await setupRealContent();
    const writing = realBundle.mockTests.flatMap((m) => m.writing);
    const day = dayNumber(TODAY);
    const practice = await examPracticeFor(content, 'writing', day);
    const expected = writing[day % writing.length];
    expect(practice).toEqual({ skill: 'writing', itemId: expected.id, title: `Timed writing · ${expected.title}` });
    const speaking = realBundle.mockTests.flatMap((m) => m.speaking);
    expect((await examPracticeFor(content, 'speaking', -1))?.itemId).toBe(speaking[speaking.length - 1].id);
  });

  it('has no exam practice for writing when no mocks are installed', async () => {
    const empty = { listKind: async () => [] } as unknown as ContentRepository;
    expect(await examPracticeFor(empty, 'speaking', 3)).toBeNull();
  });

  it('grades a review, logs it and counts it in study time', async () => {
    const { progress } = await setupRealContent();
    await learnWords(progress, ['u01-w001'], 0);
    const card = (await progress.card('u01-w001'))!;
    const next = await gradeReview(progress, card, 'good', NOW);
    expect(next.reps).toBe(1);
    expect((await progress.card('u01-w001'))?.reps).toBe(1);
    expect(await progress.reviewsSince(NOW)).toBe(1);
    expect((await progress.studyDays(TODAY, TODAY))[0]).toMatchObject({ reviews: 1 });
  });

  it('learns each word once and reports which cards are mastered', async () => {
    const { progress } = await setupRealContent();
    expect(await learnWords(progress, ['u01-w001', 'u01-w001', 'u01-w002'], 0)).toBe(2);
    expect(await learnWords(progress, ['u01-w001'], 0)).toBe(0);
    await progress.addCards([mastered('u01-w003')], 0);
    expect(await masteredIds(progress)).toEqual(new Set(['u01-w003']));
  });
});

describe('mistakeExercise', () => {
  it('returns stored exercises and checkpoint questions as they are', async () => {
    const { content } = await setupRealContent();
    expect((await mistakeExercise(content, mistake(u01.exercises[0].id)))?.id).toBe(u01.exercises[0].id);
    expect((await mistakeExercise(content, mistake(u01.checkpoint[0].id)))?.id).toBe(u01.checkpoint[0].id);
  });

  it('turns a listening question into a multiple-choice exercise without the text', async () => {
    const { content } = await setupRealContent();
    const item = u01.listening[0];
    const q = item.questions[0];
    const ex = await mistakeExercise(content, mistake(q.id));
    expect(ex).toEqual({
      id: q.id,
      type: 'mcq',
      level: item.level,
      skill: 'listening',
      grammarTag: 'vocabulary',
      prompt: `Listening · ${item.title}: ${q.question}`,
      promptFr: undefined,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
    });
  });

  it('shows the reading text with a reading question', async () => {
    const { content } = await setupRealContent();
    const item = u01.reading[0];
    const ex = await mistakeExercise(content, mistake(item.questions[0].id));
    expect(ex).toMatchObject({ skill: 'reading', promptFr: item.text, prompt: `Reading · ${item.title}: ${item.questions[0].question}` });
  });

  it('returns null for ids it cannot rebuild', async () => {
    const { content } = await setupRealContent();
    expect(await mistakeExercise(content, mistake('nothing-here'))).toBeNull();
    expect(await mistakeExercise(content, mistake('u99-li01-q1'))).toBeNull();
    expect(await mistakeExercise(content, mistake(`${u01.listening[0].id}-q99`))).toBeNull();
  });
});

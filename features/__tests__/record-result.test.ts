/**
 * @jest-environment node
 */
import { migrate } from '../../data/migrations';
import { ProgressRepository } from '../../data/progress-repo';
import type { Exercise, McqExercise } from '../../domain/content-types';
import { createNodeDb } from '../../test-utils/node-db';
import { recordExerciseResult } from '../exercises/record-result';

const exercise: McqExercise = {
  id: 'u01-ex01',
  type: 'mcq',
  level: 'A2',
  skill: 'structures',
  grammarTag: 'present',
  explanation: 'Because.',
  prompt: 'Pick one',
  options: ['a', 'b'],
  answer: 0,
};

const NOW = Date.UTC(2026, 9, 25, 9);

async function setup() {
  const db = createNodeDb();
  await migrate(db);
  return { db, progress: new ProgressRepository(db) };
}

const base = { level: 'A2', skill: 'structures', grammarTag: 'passe-compose', explanation: 'e' } as const;
const NEW_TYPES: Exercise[] = [
  { ...base, id: 'u02-ex50', type: 'dictation', text: 'Je suis allé au marché.', translation: 'I went to the market.' },
  { ...base, id: 'u02-ex51', type: 'conjugation', verb: 'aller', tense: 'passé composé', person: 'je', answers: ['suis allé'] },
  { ...base, id: 'u02-ex52', type: 'translate', direction: 'en-fr', source: 'I went', answers: ['Je suis allé'] },
  { ...base, id: 'u02-ex53', type: 'match', prompt: 'Match', pairs: [{ left: 'aller', right: 'to go' }, { left: 'venir', right: 'to come' }, { left: 'voir', right: 'to see' }] },
];

describe('recordExerciseResult', () => {
  it('records a wrong drill answer on an exercise that is not yet in the notebook', async () => {
    const { progress } = await setup();
    await recordExerciseResult(progress, { exercise, result: 'wrong', userAnswer: 'b', context: 'mistakes', unitId: null, now: NOW });
    expect(await progress.mistakes()).toHaveLength(1);
    await recordExerciseResult(progress, { exercise, result: 'wrong', userAnswer: 'b', context: 'mistakes', unitId: null, now: NOW });
    expect((await progress.mistakes())[0].timesWrong).toBe(2);
  });

  it.each(NEW_TYPES.map((e) => [e.type, e] as const))('puts a wrong %s answer in the notebook, due for spaced review', async (_type, ex) => {
    const { progress } = await setup();
    await recordExerciseResult(progress, { exercise: ex, result: 'wrong', userAnswer: 'x', context: 'lesson', unitId: 'u02', now: NOW });
    const [m] = await progress.mistakes();
    expect(m).toMatchObject({ itemId: ex.id, grammarTag: 'passe-compose', userAnswer: 'x' });
    expect(m.correctAnswer.length).toBeGreaterThan(0);
    expect(await progress.dueMistakes(NOW)).toHaveLength(0);
    expect(await progress.dueMistakes(NOW + 2 * 86_400_000)).toHaveLength(1);
  });

  it('saves a wrong lesson answer to the mistakes notebook', async () => {
    const { progress } = await setup();
    await recordExerciseResult(progress, { exercise, result: 'wrong', userAnswer: 'b', context: 'lesson', unitId: 'u01', now: NOW });
    const mistakes = await progress.mistakes();
    expect(mistakes).toHaveLength(1);
    expect(mistakes[0]).toMatchObject({ itemId: 'u01-ex01', userAnswer: 'b', correctAnswer: 'a', timesWrong: 1 });
  });

  it.each(['daily', 'mock'] as const)('does not save mistakes for %s questions, which the review cannot rebuild', async (context) => {
    const { progress } = await setup();
    await recordExerciseResult(progress, { exercise, result: 'wrong', userAnswer: 'b', context, unitId: null, now: NOW });
    expect(await progress.mistakes()).toHaveLength(0);
    expect(await progress.allAttempts()).toHaveLength(1);
  });

  it('counts a wrong retry in the mistakes review once', async () => {
    const { progress } = await setup();
    await recordExerciseResult(progress, { exercise, result: 'wrong', userAnswer: 'b', context: 'lesson', unitId: 'u01', now: NOW });
    await recordExerciseResult(progress, { exercise, result: 'wrong', userAnswer: 'b', context: 'mistakes', unitId: 'u01', now: NOW + 1000 });
    const [m] = await progress.mistakes();
    expect(m.timesWrong).toBe(2);
    expect(m.correctStreak).toBe(0);
  });

  it('clears a mistake after enough correct retries', async () => {
    const { progress } = await setup();
    await recordExerciseResult(progress, { exercise, result: 'wrong', userAnswer: 'b', context: 'lesson', unitId: 'u01', now: NOW });
    for (let i = 1; i <= 3; i += 1) {
      await recordExerciseResult(progress, { exercise, result: 'correct', userAnswer: 'a', context: 'mistakes', unitId: 'u01', now: NOW + i * 86_400_000 * 7 });
    }
    expect(await progress.mistakes()).toHaveLength(0);
  });

  it('resolveMistake removes a mistake from the due list', async () => {
    const { progress } = await setup();
    await recordExerciseResult(progress, { exercise, result: 'wrong', userAnswer: 'b', context: 'lesson', unitId: 'u01', now: NOW });
    const [m] = await progress.mistakes();
    await progress.resolveMistake(m.id);
    expect(await progress.dueMistakes(NOW + 30 * 86_400_000)).toHaveLength(0);
  });
});

/**
 * @jest-environment node
 */
import { setupRealContent } from '../../test-utils/real-content';
import { recordExerciseResult } from '../exercises/record-result';
import { buildDrill, weakestMistakePoint } from '../mistakes/drill-service';

describe('drill service', () => {
  it('finds the weakest point and drills its mistakes first, topped up with related exercises', async () => {
    const { content, progress } = await setupRealContent();
    const exercises = await content.listKind('exercise');
    const imparfait = exercises.filter((e) => e.grammarTag === 'imparfait').slice(0, 2);
    const present = exercises.find((e) => e.grammarTag === 'present')!;
    for (const exercise of [...imparfait, present]) {
      await recordExerciseResult(progress, { exercise, result: 'wrong', userAnswer: 'x', context: 'lesson', unitId: null, now: 1 });
    }
    expect((await weakestMistakePoint(progress))?.tag).toBe('imparfait');

    const drill = await buildDrill(content, progress, 'imparfait', 'day');
    expect(drill).toHaveLength(8);
    expect(drill.slice(0, 2).map((e) => e.id).sort()).toEqual(imparfait.map((e) => e.id).sort());
    expect(drill.every((e) => e.grammarTag === 'imparfait')).toBe(true);
  });

  it('includes checkpoint mistakes, which are not regular exercises', async () => {
    const { content, progress } = await setupRealContent();
    const unit = await content.unit('u03');
    const cp = unit!.checkpoint.find((e) => e.grammarTag === 'imparfait')!;
    await recordExerciseResult(progress, { exercise: cp, result: 'wrong', userAnswer: 'x', context: 'checkpoint', unitId: 'u03', now: 1 });
    const drill = await buildDrill(content, progress, 'imparfait', 'day');
    expect(drill[0].id).toBe(cp.id);
  });

  it('returns null when there are no grammar mistakes', async () => {
    const { progress } = await setupRealContent();
    expect(await weakestMistakePoint(progress)).toBeNull();
  });
});

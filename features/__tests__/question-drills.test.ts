/**
 * @jest-environment node
 */
import { realBundle, setupRealContent } from '../../test-utils/real-content';
import { recordExerciseResult } from '../exercises/record-result';
import { buildDrill } from '../mistakes/drill-service';
import { mistakeExercise } from '../session/session-service';

describe('question drills', () => {
  it('ships drills for every question form, all tagged "questions"', () => {
    const drills = realBundle.questionDrills ?? [];
    expect(drills.length).toBeGreaterThanOrEqual(30);
    expect(drills.every((d) => d.grammarTag === 'questions')).toBe(true);
    const sources = drills.flatMap((d) => (d.type === 'translate' ? [d.source] : []));
    for (const form of ['est-ce que', 'inversion']) expect(sources.some((s) => s.includes(form))).toBe(true);
    const answers = drills.flatMap((d) => (d.type === 'translate' ? d.answers : []));
    for (const word of ['Où', 'Quand', 'Combien', 'Pourquoi', 'Quel']) expect(answers.some((a) => a.startsWith(word))).toBe(true);
  });

  it('are seeded as exercises outside any unit, so mistakes and drills can rebuild them', async () => {
    const { content, progress } = await setupRealContent();
    const drill = await content.item('exercise', 'qd-t01');
    expect(drill).toMatchObject({ type: 'translate', grammarTag: 'questions' });
    await recordExerciseResult(progress, { exercise: drill!, result: 'wrong', userAnswer: 'Où vous habitez ?', context: 'practice', unitId: null, now: 1 });
    const [mistake] = await progress.mistakes();
    expect((await mistakeExercise(content, mistake))?.id).toBe('qd-t01');
    const session = await buildDrill(content, progress, 'questions', 'seed');
    expect(session[0].id).toBe('qd-t01');
    expect(session).toHaveLength(8);
  });
});

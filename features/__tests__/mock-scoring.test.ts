import type { MockTestSection } from '../../domain/content-types';
import { mockTotals, scoreSection, sectionQuestions } from '../skills/mock-scoring';
import { countWords, formatClock, unitIdOf } from '../skills/skill-items';

const question = (id: string, answer = 0) => ({ id, question: `Q ${id}`, options: ['a', 'b', 'c'], answer, explanation: `why ${id}` });

const reading: MockTestSection = {
  skill: 'reading',
  title: 'Reading',
  minutes: 10,
  reading: [{ id: 'mk-re01', title: 'T', level: 'B1', kind: 'notice', text: 'x', translation: 'y', questions: [question('mk-re01-q1'), question('mk-re01-q2', 2)] }],
};

const structures: MockTestSection = {
  skill: 'structures',
  title: 'Structures',
  minutes: 5,
  questions: [{ id: 'mk-st01', type: 'mcq', level: 'B1', skill: 'structures', grammarTag: 'subjonctif', prompt: 'Choose', promptFr: 'Il faut que tu ___.', options: ['viens', 'viennes'], answer: 1, explanation: 'subjonctif' }],
};

describe('mock scoring', () => {
  it('lists comprehension and structures questions in order', () => {
    expect(sectionQuestions(reading).map((q) => q.id)).toEqual(['mk-re01-q1', 'mk-re01-q2']);
    expect(sectionQuestions(structures)[0]).toMatchObject({ id: 'mk-st01', question: 'Choose Il faut que tu ___.', answer: 1 });
  });

  it('counts unanswered questions as wrong and lists them for review', () => {
    const result = scoreSection(reading, [{ questionId: 'mk-re01-q1', picked: 0, correct: true }]);
    expect(result).toMatchObject({ correct: 1, total: 2 });
    expect(result.review).toEqual([{ questionId: 'mk-re01-q2', question: 'Q mk-re01-q2', userAnswer: null, correctAnswer: 'c', explanation: 'why mk-re01-q2' }]);
  });

  it('shows the wrong option the learner picked', () => {
    const result = scoreSection(structures, [{ questionId: 'mk-st01', picked: 0, correct: false }]);
    expect(result.review[0]).toMatchObject({ userAnswer: 'viens', correctAnswer: 'viennes' });
  });

  it('totals across all questions, not as an average of sections', () => {
    const totals = mockTotals([
      scoreSection(reading, [
        { questionId: 'mk-re01-q1', picked: 0, correct: true },
        { questionId: 'mk-re01-q2', picked: 2, correct: true },
      ]),
      scoreSection(structures, []),
    ]);
    expect(totals.sectionScores).toEqual({ reading: 1, structures: 0 });
    expect(totals.total).toBeCloseTo(2 / 3);
  });

  it('scores an empty run as zero', () => {
    expect(mockTotals([]).total).toBe(0);
  });
});

describe('skill item helpers', () => {
  it('finds the unit of an item id, and none for mock items', () => {
    expect(unitIdOf('u03-li01')).toBe('u03');
    expect(unitIdOf('mk1-li01')).toBeNull();
  });

  it('counts words with elisions as single words', () => {
    expect(countWords("  Je vais à l'école   demain ")).toBe(5);
    expect(countWords('')).toBe(0);
  });

  it('formats a countdown clock', () => {
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(0.2)).toBe('0:01');
    expect(formatClock(-3)).toBe('0:00');
  });
});

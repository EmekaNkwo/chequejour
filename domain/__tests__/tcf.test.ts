import type { MockQuestion, MockTest, SpeakingTask, WritingTask } from '../content-types';
import { skillForDay } from '../session';
import { TCF_CANADA, testMinutes, writingTaskFormat } from '../tcf/exam-format';
import { countdownLabel, daysToExam, examPhase, examPracticeSkill, sessionSkill, skillWeights, weightedRotation } from '../tcf/exam-plan';
import { mockFormatProblems } from '../tcf/mock-format-checks';
import { checklistScore, scoreComprehension, scoreTasks, tcfScores } from '../tcf/mock-scoring';
import { cefrForNclc, estimateSkill, gapToTarget, isEstimate, nclcForScore, nclcOverview, practiceScore, type SkillEvidence } from '../tcf/nclc';
import { countWords, handInWarning, wordRangeStatus } from '../writing/word-count';

const q = (id: string, band: MockQuestion['band'], answer = 0): MockQuestion => ({ id, band, question: id, options: ['a', 'b', 'c', 'd'], answer, explanation: '' });
const NOW = Date.UTC(2026, 9, 26);
const DAY = 86_400_000;

describe('TCF Canada format', () => {
  it('has the four tests with their official counts and timings', () => {
    expect(TCF_CANADA.listening).toMatchObject({ questions: 39, minutes: 35, replay: false });
    expect(TCF_CANADA.reading).toMatchObject({ questions: 39, minutes: 60 });
    expect(testMinutes('writing')).toBe(60);
    expect(testMinutes('speaking')).toBe(12);
    expect(writingTaskFormat('opinion')).toMatchObject({ task: 3, minWords: 120, maxWords: 180 });
  });
});

describe('mock scoring', () => {
  it('gives harder questions more points', () => {
    const questions = [q('a', 'A1'), q('b', 'B2')];
    expect(scoreComprehension(questions, [{ questionId: 'a', picked: 0 }]).score).toBeCloseTo(1 / 5);
    expect(scoreComprehension(questions, [{ questionId: 'b', picked: 0 }]).score).toBeCloseTo(4 / 5);
  });

  it('counts unanswered and wrong answers as zero', () => {
    const result = scoreComprehension([q('a', 'A2'), q('b', 'A2')], [{ questionId: 'a', picked: 2 }, { questionId: 'b', picked: null }]);
    expect(result).toEqual({ correct: 0, total: 2, score: 0 });
  });

  it('weighs writing and speaking task 3 most and treats skipped tasks as zero', () => {
    expect(scoreTasks([1, 1, 1])).toBe(1);
    expect(scoreTasks([1, null, null])).toBeCloseTo(1 / 6);
    expect(checklistScore([true, false, true, true])).toBe(0.75);
  });

  it('drops the old structures section from stored results', () => {
    expect(tcfScores({ listening: 0.5, structures: 0.9, reading: 1.2 })).toEqual({ listening: 0.5, reading: 1 });
  });
});

describe('NCLC estimate', () => {
  const evidence = (over: Partial<SkillEvidence>): SkillEvidence => ({ skill: 'listening', mocks: [], practice: [], ...over });

  it('maps skill scores to NCLC and CEFR', () => {
    expect(nclcForScore(0.1)).toBe(3);
    expect(nclcForScore(0.3)).toBe(4);
    expect(nclcForScore(0.5)).toBe(5);
    expect(nclcForScore(0.72)).toBe(6);
    expect(nclcForScore(0.8)).toBe(7);
    expect(nclcForScore(0.95)).toBe(8);
    expect([cefrForNclc(4), cefrForNclc(5), cefrForNclc(7)]).toEqual(['A2', 'A2+', 'B1']);
  });

  it('puts flawless practice at each level at the matching NCLC, topping out at 6', () => {
    const at = (level: 'A2' | 'A2+' | 'B1') => nclcForScore(practiceScore(Array.from({ length: 30 }, () => ({ score: 1, level }))));
    expect([at('A2'), at('A2+'), at('B1')]).toEqual([4, 5, 6]);
  });

  it('needs a mock or enough practice', () => {
    expect(isEstimate(estimateSkill(evidence({ practice: [{ score: 1, level: 'B1' }] }), NOW))).toBe(false);
    expect(estimateSkill(evidence({ mocks: [{ score: 0.8, takenAt: NOW - DAY }] }), NOW)).toMatchObject({ nclc: 7, source: 'mock' });
  });

  it('blends a recent mock with practice and ignores stale mocks', () => {
    const practice = Array.from({ length: 20 }, () => ({ score: 1, level: 'B1' as const }));
    const blended = estimateSkill(evidence({ mocks: [{ score: 0.9, takenAt: NOW - DAY }], practice }), NOW);
    expect(blended).toMatchObject({ source: 'mock+practice' });
    expect(isEstimate(blended) && blended.score).toBeCloseTo(0.7 * 0.9 + 0.3 * 0.72);
    const stale = estimateSkill(evidence({ mocks: [{ score: 0.9, takenAt: NOW - 120 * DAY }], practice }), NOW);
    expect(stale).toMatchObject({ source: 'practice', nclc: 6 });
  });

  it('marks writing and speaking as self-assessed', () => {
    const r = estimateSkill({ skill: 'writing', mocks: [{ score: 0.5, takenAt: NOW }], practice: [] }, NOW);
    expect(r).toMatchObject({ selfAssessed: true });
  });

  it('finds the weakest skill and the gap to the target', () => {
    const overview = nclcOverview(
      [
        { skill: 'listening', mocks: [{ score: 0.8, takenAt: NOW }], practice: [] },
        { skill: 'reading', mocks: [{ score: 0.5, takenAt: NOW }], practice: [] },
        { skill: 'writing', mocks: [{ score: 0.65, takenAt: NOW }], practice: [] },
      ],
      7,
      NOW,
    );
    expect(overview.weakest).toBe('reading');
    // With one skill estimated there is nothing to compare it with.
    expect(nclcOverview([{ skill: 'writing', mocks: [{ score: 0.1, takenAt: NOW }], practice: [] }], 7, NOW).weakest).toBeNull();
    expect(overview.skills.map((s) => s.skill)).toEqual(['listening', 'reading', 'writing', 'speaking']);
    expect(isEstimate(overview.skills[3])).toBe(false);
    const reading = overview.skills[1];
    expect(isEstimate(reading) && gapToTarget(reading, 7)).toBe(2);
    const listening = overview.skills[0];
    expect(isEstimate(listening) && gapToTarget(listening, 7)).toBe(0);
  });
});

describe('exam countdown and session weighting', () => {
  it('counts days and phases', () => {
    expect(daysToExam('2026-12-28', '2026-10-26')).toBe(63);
    expect(daysToExam(null, '2026-10-26')).toBeNull();
    expect([examPhase(null), examPhase(100), examPhase(60), examPhase(14), examPhase(0), examPhase(-1)]).toEqual(['none', 'far', 'focus', 'final', 'final', 'past']);
    expect(countdownLabel(63)).toBe('63 days to your TCF');
    expect(countdownLabel(1)).toBe('Your TCF is tomorrow');
    expect(countdownLabel(null)).toBeNull();
  });

  it('keeps the usual rotation without an exam date', () => {
    for (let d = 0; d < 10; d += 1) expect(sessionSkill(d, 'none', null)).toBe(skillForDay(d));
  });

  it('gives the weakest skill more days as the exam gets closer', () => {
    const count = (phase: 'far' | 'focus' | 'final') => {
      const cycle = weightedRotation(skillWeights(phase, 'reading'));
      return { reading: cycle.filter((s) => s === 'reading').length, structures: cycle.filter((s) => s === 'structures').length, length: cycle.length };
    };
    expect(count('far')).toEqual({ reading: 1, structures: 1, length: 5 });
    expect(count('focus')).toEqual({ reading: 2, structures: 1, length: 6 });
    expect(count('final')).toEqual({ reading: 3, structures: 0, length: 6 });
  });

  it('spreads repeats instead of stacking them', () => {
    const cycle = weightedRotation(skillWeights('final', 'reading'));
    const twice = cycle.some((s, i) => s === 'reading' && cycle[(i + 1) % cycle.length] === 'reading');
    expect(twice).toBe(false);
  });

  it('adds mock-style practice only in the last two weeks', () => {
    expect(examPracticeSkill('focus', 'reading', 3)).toBeNull();
    expect(examPracticeSkill('final', 'reading', 3)).toBe('reading');
    expect(examPracticeSkill('final', null, 1)).toBe('reading');
  });
});

describe('word count', () => {
  it('counts like the TCF and ignores lone punctuation', () => {
    expect(countWords("Aujourd'hui, c'est la fête : venez !")).toBe(5);
    expect(countWords('   ')).toBe(0);
    expect([wordRangeStatus(0, 60, 120), wordRangeStatus(59, 60, 120), wordRangeStatus(60, 60, 120), wordRangeStatus(121, 60, 120)]).toEqual(['empty', 'under', 'within', 'over']);
  });

  it('warns before handing in empty, short or long tasks', () => {
    const words = (n: number) => Array.from({ length: n }, () => 'mot').join(' ');
    const ranges = [
      { minWords: 60, maxWords: 120 },
      { minWords: 120, maxWords: 150 },
      { minWords: 120, maxWords: 180 },
    ];
    expect(handInWarning([words(70), words(130), words(150)], ranges)).toBeNull();
    expect(handInWarning([words(77), words(20), ''], ranges)).toBe('Task 2 is short (20 of 120–150 words). Task 3 is empty.');
    expect(handInWarning([words(130), words(130), words(150)], ranges)).toBe('Task 1 is long (130 of 60–120 words).');
    expect(handInWarning([''], [ranges[0]])).toBe('Your text is empty.');
  });
});

describe('mock format checks', () => {
  const words = (n: number) => Array.from({ length: n }, () => 'mot').join(' ');
  const writing = (taskType: WritingTask['taskType'], min: number, max: number, extra: Partial<WritingTask> = {}): WritingTask => ({
    id: taskType, title: '', level: 'B1', taskType, instructions: '', promptFr: '', minWords: min, maxWords: max, modelAnswer: words(min + 5), checklist: [], ...extra,
  });
  const speaking = (taskType: SpeakingTask['taskType'], prepSeconds: number, speakSeconds: number): SpeakingTask => ({
    id: taskType, title: '', level: 'B1', taskType, instructions: '', promptFr: '', prepSeconds, speakSeconds, modelAnswer: '', tips: [],
  });
  const item = (id: string, questions: MockQuestion[]) => ({ id, title: '', level: 'A2' as const, kind: 'message' as const, text: '', translation: '', questions });
  const valid: MockTest = {
    id: 'mk9',
    title: '',
    listening: [{ id: 'l', title: '', level: 'A2', kind: 'message', context: '', lines: [], translation: '', questions: Array.from({ length: 39 }, (_, i) => q(`l${i}`, i < 20 ? 'A2' : 'B1')) }],
    reading: [item('r', Array.from({ length: 39 }, (_, i) => q(`r${i}`, 'B1')))],
    writing: [writing('message', 60, 120), writing('description', 120, 150), writing('opinion', 120, 180, { documents: [{ title: 'a', text: 'a' }, { title: 'b', text: 'b' }] })],
    speaking: [speaking('entretien', 0, 120), speaking('interaction', 120, 210), speaking('opinion', 0, 270)],
  };

  it('accepts a mock in the TCF Canada format', () => {
    expect(mockFormatProblems(valid)).toEqual([]);
  });

  it('reports wrong counts, falling difficulty, word ranges and missing documents', () => {
    const broken: MockTest = {
      ...valid,
      reading: [item('r', [q('r1', 'B1'), q('r2', 'A2')])],
      writing: [valid.writing[0], { ...valid.writing[1], modelAnswer: words(10) }, writing('opinion', 120, 180)],
      speaking: [valid.speaking[0], speaking('interaction', 60, 210), valid.speaking[2]],
    };
    const problems = mockFormatProblems(broken);
    expect(problems).toEqual(
      expect.arrayContaining([
        'reading has 2 questions, the format needs 39',
        'reading question 2 is easier than the one before (difficulty must rise)',
        'writing task 2 model answer has 10 words, outside 120–150',
        'writing task 3 needs two documents',
        'speaking task 2 must be 120s preparation + 210s speaking',
      ]),
    );
  });
});

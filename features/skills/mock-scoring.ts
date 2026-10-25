/**
 * Scoring for TCF-style mock tests. Unanswered questions (time ran out) count as
 * wrong. Scores are practice estimates only, never official TCF results.
 */
import type { MockTest, MockTestSection } from '../../domain/content-types';

export interface MockQuestionRef {
  id: string;
  question: string;
  options: readonly string[];
  answer: number;
  explanation: string;
}

export interface MockAnswer {
  questionId: string;
  picked: number;
  correct: boolean;
}

export interface MockReviewItem {
  questionId: string;
  question: string;
  userAnswer: string | null;
  correctAnswer: string;
  explanation: string;
}

export interface MockSectionResult {
  skill: MockTestSection['skill'];
  title: string;
  correct: number;
  total: number;
  review: MockReviewItem[];
}

/** Every question in a section, in the order the learner meets them. */
export function sectionQuestions(section: MockTestSection): MockQuestionRef[] {
  const comprehension = [...(section.listening ?? []), ...(section.reading ?? [])].flatMap((item) => item.questions);
  const structures = (section.questions ?? []).map((q) => ({
    id: q.id,
    question: q.promptFr ? `${q.prompt} ${q.promptFr}` : q.prompt,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
  }));
  return [...comprehension, ...structures];
}

export function scoreSection(section: MockTestSection, answers: readonly MockAnswer[]): MockSectionResult {
  const byId = new Map(answers.map((a) => [a.questionId, a]));
  const questions = sectionQuestions(section);
  const review = questions
    .filter((q) => !byId.get(q.id)?.correct)
    .map((q) => {
      const given = byId.get(q.id);
      return {
        questionId: q.id,
        question: q.question,
        userAnswer: given ? (q.options[given.picked] ?? null) : null,
        correctAnswer: q.options[q.answer] ?? '',
        explanation: q.explanation,
      };
    });
  return {
    skill: section.skill,
    title: section.title,
    correct: questions.filter((q) => byId.get(q.id)?.correct).length,
    total: questions.length,
    review,
  };
}

export interface MockTotals {
  /** 0–1 per section skill. */
  sectionScores: Record<string, number>;
  /** 0–1 across all questions. */
  total: number;
}

export function mockTotals(results: readonly MockSectionResult[]): MockTotals {
  const sectionScores = Object.fromEntries(results.map((r) => [r.skill, r.total > 0 ? r.correct / r.total : 0]));
  const correct = results.reduce((n, r) => n + r.correct, 0);
  const total = results.reduce((n, r) => n + r.total, 0);
  return { sectionScores, total: total > 0 ? correct / total : 0 };
}

export function totalMinutes(mock: MockTest): number {
  return mock.sections.reduce((n, s) => n + s.minutes, 0);
}

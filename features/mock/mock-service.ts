/**
 * Mock test runs: saving results, the history of past runs, and the question sets
 * used for the final-stretch exam practice. Practice runs are stored with a
 * "practice:" id so they never count as a full mock.
 */
import type { ContentRepository } from '../../data/content-repo';
import type { ProgressRepository } from '../../data/progress-repo';
import type { MockListeningItem, MockReadingItem, MockTest } from '../../domain/content-types';
import { TCF_CANADA, type TcfSkill } from '../../domain/tcf/exam-format';
import { tcfScores, type MockRunRecord, type MockSkillScores } from '../../domain/tcf/mock-scoring';

export const PRACTICE_PREFIX = 'practice:';
/** Questions in one final-stretch practice set. */
export const PRACTICE_QUESTIONS = 10;

export function practiceRunId(skill: TcfSkill): string {
  return `${PRACTICE_PREFIX}${skill}`;
}

export function isPracticeRun(mockId: string): boolean {
  return mockId.startsWith(PRACTICE_PREFIX);
}

/** Average of the tests taken in this run. */
export function runTotal(scores: MockSkillScores): number {
  const values = Object.values(scores).filter((v): v is number => typeof v === 'number');
  return values.length > 0 ? values.reduce((n, v) => n + v, 0) / values.length : 0;
}

export async function saveMockRun(progress: ProgressRepository, mockId: string, scores: MockSkillScores, now: number): Promise<void> {
  await progress.saveMockResult(mockId, scores as Record<string, number>, runTotal(scores), now);
}

/** Full and single-test mock runs, newest first. */
export async function mockHistory(progress: ProgressRepository): Promise<MockRunRecord[]> {
  const rows = await progress.mockResults();
  return rows
    .filter((r) => !isPracticeRun(r.mockId))
    .map((r) => ({ mockId: r.mockId, scores: tcfScores(r.sectionScores), takenAt: r.takenAt }))
    .filter((r) => Object.keys(r.scores).length > 0)
    .sort((a, b) => b.takenAt - a.takenAt);
}

export async function practiceDoneSince(progress: ProgressRepository, skill: TcfSkill, since: number): Promise<boolean> {
  const rows = await progress.mockResults();
  return rows.some((r) => r.mockId === practiceRunId(skill) && r.takenAt >= since);
}

type ComprehensionItem = MockListeningItem | MockReadingItem;

/**
 * A short mock-style set: whole items (a text with its questions) from the mock
 * tests, about PRACTICE_QUESTIONS questions, taking a different slice each time.
 */
export function practiceSet(mocks: readonly MockTest[], skill: 'listening' | 'reading', round: number): ComprehensionItem[] {
  const items = mocks.flatMap((m): ComprehensionItem[] => (skill === 'listening' ? m.listening : m.reading));
  if (items.length === 0) return [];
  const chunks: ComprehensionItem[][] = [];
  let current: ComprehensionItem[] = [];
  let count = 0;
  for (const item of items) {
    current = [...current, item];
    count += item.questions.length;
    if (count >= PRACTICE_QUESTIONS) {
      chunks.push(current);
      current = [];
      count = 0;
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks[((round % chunks.length) + chunks.length) % chunks.length];
}

/** Time for a practice set, at the real test's pace per question. */
export function practiceMinutes(skill: 'listening' | 'reading', questions: number): number {
  const f = TCF_CANADA[skill];
  return Math.max(1, Math.ceil((questions * f.minutes) / f.questions));
}

export async function loadMocks(content: ContentRepository): Promise<MockTest[]> {
  return content.listKind('mock');
}

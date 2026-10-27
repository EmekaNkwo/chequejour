/**
 * Gathers the evidence for the per-skill NCLC practice estimate from stored progress.
 */
import type { ContentRepository } from '../../data/content-repo';
import type { ProgressRepository } from '../../data/progress-repo';
import { TCF_SKILLS, type TcfSkill } from '../../domain/tcf/exam-format';
import { nclcOverview, RECENT_PRACTICE, type Nclc, type NclcOverview, type PracticeItem, type SkillEvidence } from '../../domain/tcf/nclc';
import { mockHistory } from '../mock/mock-service';

async function practiceFor(content: ContentRepository, progress: ProgressRepository, skill: TcfSkill): Promise<PracticeItem[]> {
  if (skill === 'listening' || skill === 'reading') {
    const attempts = await progress.recentSkillAttempts(skill, RECENT_PRACTICE);
    return attempts.map((a) => ({ score: a.correct ? 1 : 0, level: a.level }));
  }
  const scored = await progress.scoredSkillItems(skill, RECENT_PRACTICE);
  const withLevels = await Promise.all(scored.map(async (s) => ({ score: s.score, level: await content.levelOf(s.itemId) })));
  return withLevels.flatMap((s) => (s.level ? [{ score: s.score, level: s.level }] : []));
}

export async function skillEvidence(content: ContentRepository, progress: ProgressRepository): Promise<SkillEvidence[]> {
  const history = await mockHistory(progress);
  return Promise.all(
    TCF_SKILLS.map(async (skill) => ({
      skill,
      mocks: history.flatMap((r) => (r.scores[skill] !== undefined ? [{ score: r.scores[skill] as number, takenAt: r.takenAt }] : [])),
      practice: await practiceFor(content, progress, skill),
    })),
  );
}

export async function loadNclcOverview(content: ContentRepository, progress: ProgressRepository, target: Nclc, now: number): Promise<NclcOverview> {
  return nclcOverview(await skillEvidence(content, progress), target, now);
}

/** What the session builder needs to weight practice towards the exam. */
export async function loadExamContext(
  content: ContentRepository,
  progress: ProgressRepository,
  settings: { examDate: string | null; targetNclc: Nclc },
  now: number,
): Promise<{ examDate: string | null; weakest: TcfSkill | null }> {
  if (!settings.examDate) return { examDate: null, weakest: null };
  const overview = await loadNclcOverview(content, progress, settings.targetNclc, now);
  return { examDate: settings.examDate, weakest: overview.weakest };
}

/**
 * Numbers for the Home and Progress screens.
 */
import type { ContentRepository } from '../../data/content-repo';
import type { ProgressRepository } from '../../data/progress-repo';
import { SKILLS, type Level, type Skill } from '../../domain/content-types';
import { addDays, atTime, fromDayKey, lastNDays, startOfWeek, type DayKey } from '../../domain/dates';
import { estimateLevel, mockTestUnlocked, RECENT_ATTEMPTS, type LevelEstimate } from '../../domain/level';
import { computeStreak, type StreakInfo } from '../../domain/streak';
import { skillStats, weeklySummary, type SkillStat, type WeeklySummary } from '../../domain/weekly';
import type { PathState } from '../path/path-service';

export interface LevelOverview {
  estimate: LevelEstimate;
  mockUnlocked: boolean;
  completedUnits: number;
  totalUnits: number;
  mastered: number;
}

export async function levelOverview(progress: ProgressRepository, path: PathState, placement: Level | null, mastered: number): Promise<LevelOverview> {
  const recent = await progress.recentAttempts(RECENT_ATTEMPTS);
  const completedUnits = path.units.filter((u) => u.status === 'completed').length;
  const estimate = estimateLevel({ completedUnits, totalUnits: path.units.length, masteredCards: mastered, recentAttempts: recent, placement });
  // A1 units are optional for learners placed higher, so they don't hold the mock tests back.
  const a2Units = path.units.filter((u) => u.level === 'A2' || u.level === 'A2+');
  const allA2Done = a2Units.length > 0 && a2Units.every((u) => u.status === 'completed');
  return { estimate, mockUnlocked: mockTestUnlocked(estimate.value, allA2Done), completedUnits, totalUnits: path.units.length, mastered };
}

export interface ActivityDay {
  day: DayKey;
  minutes: number;
  reviews: number;
}

export async function lastSevenDays(progress: ProgressRepository, today: DayKey): Promise<ActivityDay[]> {
  const days = lastNDays(today, 7);
  const rows = new Map((await progress.studyDays(days[0], today)).map((r) => [r.day, r]));
  return days.map((day) => ({ day, minutes: Math.round((rows.get(day)?.seconds ?? 0) / 60), reviews: rows.get(day)?.reviews ?? 0 }));
}

export async function streak(progress: ProgressRepository, today: DayKey): Promise<StreakInfo> {
  return computeStreak(await progress.activeDays(), today);
}

export async function thisWeek(progress: ProgressRepository, today: DayKey): Promise<WeeklySummary & { from: DayKey; to: DayKey }> {
  const from = startOfWeek(today);
  const to = addDays(from, 6);
  const start = fromDayKey(from).getTime();
  const end = atTime(addDays(to, 1), { hour: 0, minute: 0 }).getTime();
  const [attempts, days, learned] = await Promise.all([
    progress.attemptsBetween(start, end),
    progress.studyDays(from, to),
    progress.cardsCreatedBetween(start, end),
  ]);
  return { ...weeklySummary(attempts, days, learned), from, to };
}

export async function skillBreakdown(content: ContentRepository, progress: ProgressRepository, path: PathState): Promise<SkillStat[]> {
  const [attempts, items, done] = await Promise.all([progress.allAttempts(), content.skillItems(), progress.skillProgress()]);
  const completion = Object.fromEntries(SKILLS.map((s) => [s, 0])) as Record<Skill, number>;
  for (const skill of ['listening', 'reading', 'writing', 'speaking'] as const) {
    const of = items.filter((i) => i.kind === skill);
    completion[skill] = of.length > 0 ? of.filter((i) => done.get(i.id)?.lastDoneAt).length / of.length : 0;
  }
  const segmentsTotal = path.units.reduce((n, u) => n + u.segmentsTotal, 0);
  completion.structures = segmentsTotal > 0 ? path.completedSegments.size / segmentsTotal : 0;
  return skillStats(attempts, completion);
}

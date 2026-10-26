import type { AppServices } from '../app/AppContext';
import { dailyContent, ensureDailyItems, type DailyContent } from '../daily/daily-service';
import { dailyLearner, loadPath, type PathState } from '../path/path-service';
import { lastSevenDays, levelOverview, streak, type ActivityDay, type LevelOverview } from '../progress/stats-service';
import { masteredIds } from '../session/session-service';
import { loadExamContext } from '../tcf/nclc-service';
import { todayPlan, type TodayPlan } from '../session/today-plan';
import type { StreakInfo } from '../../domain/streak';
import type { TcfSkill } from '../../domain/tcf/exam-format';
import { daysToExam } from '../../domain/tcf/exam-plan';

export interface HomeData {
  path: PathState;
  plan: TodayPlan;
  daily: DailyContent | null;
  activity: ActivityDay[];
  level: LevelOverview;
  streak: StreakInfo;
  unseenDaily: boolean;
  /** Days to the learner's TCF, null without a date. */
  examDays: number | null;
  weakest: TcfSkill | null;
}

export async function loadHome(app: Pick<AppServices, 'content' | 'progress' | 'settings' | 'today'>): Promise<HomeData> {
  const { content, progress, settings, today } = app;
  const mastered = await masteredIds(progress);
  const path = await loadPath(content, progress, settings.placementLevel, mastered);
  await ensureDailyItems(content, progress, today, dailyLearner(path));
  const now = Date.now();
  const exam = await loadExamContext(content, progress, settings, now);
  const [plan, daily, activity, level, streakInfo] = await Promise.all([
    todayPlan(content, progress, path, settings.dailyGoal, today, now, exam),
    dailyContent(content, progress, today),
    lastSevenDays(progress, today),
    levelOverview(progress, path, settings.placementLevel, mastered.size),
    streak(progress, today),
  ]);
  return {
    path,
    plan,
    daily,
    activity,
    level,
    streak: streakInfo,
    unseenDaily: !!daily && (!daily.wordOpened || !daily.sentenceOpened),
    examDays: daysToExam(exam.examDate, today),
    weakest: exam.weakest,
  };
}

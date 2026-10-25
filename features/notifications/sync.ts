/**
 * Keeps scheduled local notifications in line with settings and daily items.
 * The sync is idempotent (cancel everything, schedule the plan), so it is safe to run
 * on every launch, on returning to the foreground and after any settings change.
 */
import type { ContentRepository } from '../../data/content-repo';
import type { ProgressRepository } from '../../data/progress-repo';
import { headword } from '../../domain/audio-keys';
import type { DayKey } from '../../domain/dates';
import { planNotifications, type NotificationSettings, type NotificationTexts, type PlannedNotification } from '../../domain/notification-plan';
import { ensureDailyItems, type DailyLearner } from '../daily/daily-service';

export interface NotificationsApi {
  /** False when the user hasn't granted notification permission. */
  canNotify(): Promise<boolean>;
  cancelAll(): Promise<void>;
  schedule(notification: PlannedNotification): Promise<void>;
}

const truncate = (s: string, max: number): string => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export async function notificationTexts(content: ContentRepository, ids: { words: string[]; sentences: string[] }): Promise<NotificationTexts> {
  const [words, sentences] = await Promise.all([content.items('word', ids.words), content.items('sentence', ids.sentences)]);
  const wordById = new Map(words.map((w) => [w.id, w]));
  const sentenceById = new Map(sentences.map((s) => [s.id, s]));
  return {
    word: (id) => {
      const w = wordById.get(id);
      return w ? { title: `Mot du jour · ${headword(w)}`, body: truncate(`${w.en} — ${w.example.fr}`, 160) } : null;
    },
    sentence: (id) => {
      const s = sentenceById.get(id);
      return s ? { title: 'Phrase du jour', body: truncate(s.fr, 160) } : null;
    },
  };
}

export interface SyncResult {
  scheduled: number;
  permission: boolean;
}

export async function syncNotifications(
  api: NotificationsApi,
  deps: { content: ContentRepository; progress: ProgressRepository; settings: NotificationSettings; today: DayKey; learner: DailyLearner; now: Date },
): Promise<SyncResult> {
  await api.cancelAll();
  const permission = await api.canNotify();
  if (!permission || (!deps.settings.word.enabled && !deps.settings.sentence.enabled)) {
    return { scheduled: 0, permission };
  }
  const assignments = await ensureDailyItems(deps.content, deps.progress, deps.today, deps.learner, { refreshFuture: true });
  const texts = await notificationTexts(deps.content, {
    words: assignments.map((a) => a.wordId),
    sentences: assignments.map((a) => a.sentenceId),
  });
  const plan = planNotifications(deps.settings, assignments, texts, deps.now);
  for (const n of plan) await api.schedule(n);
  return { scheduled: plan.length, permission };
}

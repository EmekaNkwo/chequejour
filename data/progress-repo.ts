/**
 * Learner progress: SRS cards, answers, mistakes, path progress, study time and
 * daily items. All writes are small and local.
 */
import type { GrammarTag, Level, Skill } from '../domain/content-types';
import type { DailyAssignment } from '../domain/daily-items';
import type { DayKey } from '../domain/dates';
import type { CardState, ReviewGrade, SrsCard } from '../domain/srs';
import { rescheduleMistake, type AttemptRecord } from '../domain/weekly';
import type { SqlDb } from './sql';

interface CardRow {
  item_id: string;
  item_kind: SrsCard['itemKind'];
  due: number;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: CardState;
  last_review: number | null;
}

const toCard = (r: CardRow): SrsCard => ({
  itemId: r.item_id,
  itemKind: r.item_kind,
  due: r.due,
  stability: r.stability,
  difficulty: r.difficulty,
  scheduledDays: r.scheduled_days,
  learningSteps: r.learning_steps,
  reps: r.reps,
  lapses: r.lapses,
  state: r.state,
  lastReview: r.last_review,
});

export interface AttemptInput {
  itemId: string;
  unitId: string | null;
  skill: Skill;
  grammarTag: GrammarTag | null;
  level: Level;
  correct: boolean;
  context: 'lesson' | 'checkpoint' | 'review' | 'mistakes' | 'placement' | 'mock' | 'practice' | 'daily';
  at: number;
}

export interface MistakeInput {
  itemId: string;
  skill: Skill;
  grammarTag: GrammarTag | null;
  prompt: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  at: number;
}

export interface Mistake {
  id: number;
  itemId: string;
  skill: Skill;
  grammarTag: GrammarTag | null;
  prompt: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  createdAt: number;
  nextReviewAt: number;
  correctStreak: number;
  timesWrong: number;
  resolved: boolean;
}

interface MistakeRow {
  id: number;
  item_id: string;
  skill: Skill;
  grammar_tag: GrammarTag | null;
  prompt: string;
  user_answer: string;
  correct_answer: string;
  explanation: string;
  created_at: number;
  next_review_at: number;
  correct_streak: number;
  times_wrong: number;
  resolved: number;
}

const toMistake = (r: MistakeRow): Mistake => ({
  id: r.id,
  itemId: r.item_id,
  skill: r.skill,
  grammarTag: r.grammar_tag,
  prompt: r.prompt,
  userAnswer: r.user_answer,
  correctAnswer: r.correct_answer,
  explanation: r.explanation,
  createdAt: r.created_at,
  nextReviewAt: r.next_review_at,
  correctStreak: r.correct_streak,
  timesWrong: r.times_wrong,
  resolved: r.resolved === 1,
});

export interface DailyItemRow extends DailyAssignment {
  wordOpened: boolean;
  sentenceOpened: boolean;
}

export interface SkillProgress {
  itemId: string;
  skill: Skill;
  unitId: string | null;
  score: number | null;
  playedFraction: number;
  saved: boolean;
  lastDoneAt: number | null;
}

export interface Recording {
  id: number;
  taskId: string;
  uri: string;
  durationMs: number;
  createdAt: number;
}

const DAY_MS = 86_400_000;

export class ProgressRepository {
  constructor(private readonly db: SqlDb) {}

  // ── SRS cards ────────────────────────────────────────────────────────────

  async card(itemId: string): Promise<SrsCard | null> {
    const row = await this.db.getFirstAsync<CardRow>('SELECT * FROM srs_cards WHERE item_id = ?', [itemId]);
    return row ? toCard(row) : null;
  }

  async allCards(): Promise<SrsCard[]> {
    return (await this.db.getAllAsync<CardRow>('SELECT * FROM srs_cards', [])).map(toCard);
  }

  async dueCards(now: number, limit = 200): Promise<SrsCard[]> {
    const rows = await this.db.getAllAsync<CardRow>('SELECT * FROM srs_cards WHERE due <= ? ORDER BY due LIMIT ?', [now, limit]);
    return rows.map(toCard);
  }

  /** Adds cards for items not yet in the queue. Returns how many were added. */
  async addCards(cards: readonly SrsCard[], now: number): Promise<number> {
    let added = 0;
    for (const c of cards) {
      const result = await this.db.runAsync(
        `INSERT OR IGNORE INTO srs_cards
         (item_id, item_kind, due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, state, last_review, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.itemId, c.itemKind, c.due, c.stability, c.difficulty, c.scheduledDays, c.learningSteps, c.reps, c.lapses, c.state, c.lastReview, now],
      );
      added += result.changes;
    }
    return added;
  }

  async saveReview(card: SrsCard, grade: ReviewGrade, now: number): Promise<void> {
    await this.db.runAsync(
      `UPDATE srs_cards SET due = ?, stability = ?, difficulty = ?, scheduled_days = ?, learning_steps = ?,
       reps = ?, lapses = ?, state = ?, last_review = ? WHERE item_id = ?`,
      [card.due, card.stability, card.difficulty, card.scheduledDays, card.learningSteps, card.reps, card.lapses, card.state, card.lastReview, card.itemId],
    );
    await this.db.runAsync('INSERT INTO review_log (item_id, grade, reviewed_at) VALUES (?, ?, ?)', [card.itemId, grade, now]);
  }

  async reviewsSince(since: number): Promise<number> {
    const row = await this.db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM review_log WHERE reviewed_at >= ?', [since]);
    return row?.n ?? 0;
  }

  async cardsCreatedBetween(from: number, to: number): Promise<number> {
    const row = await this.db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM srs_cards WHERE item_kind = 'word' AND created_at >= ? AND created_at < ?",
      [from, to],
    );
    return row?.n ?? 0;
  }

  // ── Attempts ─────────────────────────────────────────────────────────────

  async recordAttempt(a: AttemptInput): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO attempts (item_id, unit_id, skill, grammar_tag, level, correct, context, answered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [a.itemId, a.unitId, a.skill, a.grammarTag, a.level, a.correct ? 1 : 0, a.context, a.at],
    );
  }

  async attemptsBetween(from: number, to: number): Promise<AttemptRecord[]> {
    const rows = await this.db.getAllAsync<{ skill: Skill; grammar_tag: GrammarTag | null; correct: number; answered_at: number }>(
      'SELECT skill, grammar_tag, correct, answered_at FROM attempts WHERE answered_at >= ? AND answered_at < ?',
      [from, to],
    );
    return rows.map((r) => ({ skill: r.skill, grammarTag: r.grammar_tag, correct: r.correct === 1, answeredAt: r.answered_at }));
  }

  async allAttempts(): Promise<AttemptRecord[]> {
    return this.attemptsBetween(0, Number.MAX_SAFE_INTEGER);
  }

  /** Practice answers in one skill, newest first; mock answers are left out (the mock score covers them). */
  async recentSkillAttempts(skill: Skill, limit: number): Promise<{ correct: boolean; level: Level }[]> {
    const rows = await this.db.getAllAsync<{ correct: number; level: Level }>(
      "SELECT correct, level FROM attempts WHERE skill = ? AND context NOT IN ('mock', 'placement') ORDER BY answered_at DESC LIMIT ?",
      [skill, limit],
    );
    return rows.map((r) => ({ correct: r.correct === 1, level: r.level }));
  }

  /** Self-assessed writing or speaking tasks, newest first. */
  async scoredSkillItems(skill: Skill, limit: number): Promise<{ itemId: string; score: number; doneAt: number }[]> {
    const rows = await this.db.getAllAsync<{ item_id: string; score: number; last_done_at: number }>(
      'SELECT item_id, score, last_done_at FROM skill_progress WHERE skill = ? AND score IS NOT NULL AND last_done_at IS NOT NULL ORDER BY last_done_at DESC LIMIT ?',
      [skill, limit],
    );
    return rows.map((r) => ({ itemId: r.item_id, score: r.score, doneAt: r.last_done_at }));
  }

  async recentAttempts(limit: number): Promise<{ correct: boolean; level: Level }[]> {
    const rows = await this.db.getAllAsync<{ correct: number; level: Level }>(
      "SELECT correct, level FROM attempts WHERE context != 'placement' ORDER BY answered_at DESC LIMIT ?",
      [limit],
    );
    return rows.map((r) => ({ correct: r.correct === 1, level: r.level }));
  }

  // ── Mistakes ─────────────────────────────────────────────────────────────

  /** Saves a mistake, or brings an existing one back into the queue. */
  async recordMistake(m: MistakeInput): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO mistakes (item_id, skill, grammar_tag, prompt, user_answer, correct_answer, explanation, created_at, next_review_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(item_id) DO UPDATE SET user_answer = excluded.user_answer, next_review_at = excluded.next_review_at,
         correct_streak = 0, resolved = 0, times_wrong = times_wrong + 1`,
      [m.itemId, m.skill, m.grammarTag, m.prompt, m.userAnswer, m.correctAnswer, m.explanation, m.at, m.at + DAY_MS],
    );
  }

  async mistakes(includeResolved = false): Promise<Mistake[]> {
    const rows = await this.db.getAllAsync<MistakeRow>(
      `SELECT * FROM mistakes ${includeResolved ? '' : 'WHERE resolved = 0'} ORDER BY created_at DESC`,
      [],
    );
    return rows.map(toMistake);
  }

  async dueMistakes(now: number): Promise<Mistake[]> {
    const rows = await this.db.getAllAsync<MistakeRow>(
      'SELECT * FROM mistakes WHERE resolved = 0 AND next_review_at <= ? ORDER BY next_review_at',
      [now],
    );
    return rows.map(toMistake);
  }

  async mistakesByIds(ids: readonly number[]): Promise<Mistake[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.getAllAsync<MistakeRow>(
      `SELECT * FROM mistakes WHERE id IN (${ids.map(() => '?').join(',')})`,
      [...ids],
    );
    return rows.map(toMistake);
  }

  async retryMistake(itemId: string, correct: boolean, now: number): Promise<void> {
    const row = await this.db.getFirstAsync<{ correct_streak: number }>('SELECT correct_streak FROM mistakes WHERE item_id = ?', [itemId]);
    if (!row) return;
    const next = rescheduleMistake({ correctStreak: row.correct_streak }, correct, now);
    await this.db.runAsync(
      `UPDATE mistakes SET correct_streak = ?, next_review_at = ?, resolved = ?,
       times_wrong = times_wrong + ? WHERE item_id = ?`,
      [next.correctStreak, next.nextReviewAt, next.resolved ? 1 : 0, correct ? 0 : 1, itemId],
    );
  }

  /** Clears a mistake without a retry, e.g. when its exercise no longer exists. */
  async resolveMistake(id: number): Promise<void> {
    await this.db.runAsync('UPDATE mistakes SET resolved = 1 WHERE id = ?', [id]);
  }

  async deleteMistake(id: number): Promise<void> {
    await this.db.runAsync('DELETE FROM mistakes WHERE id = ?', [id]);
  }

  // ── Path progress ────────────────────────────────────────────────────────

  async completedSegments(): Promise<Set<string>> {
    const rows = await this.db.getAllAsync<{ segment_id: string }>('SELECT segment_id FROM segment_progress', []);
    return new Set(rows.map((r) => r.segment_id));
  }

  async completeSegment(segmentId: string, unitId: string, now: number): Promise<void> {
    await this.db.runAsync('INSERT OR IGNORE INTO segment_progress (segment_id, unit_id, completed_at) VALUES (?, ?, ?)', [segmentId, unitId, now]);
  }

  async unitProgress(): Promise<Map<string, { unitId: string; checkpointScore: number | null }>> {
    const rows = await this.db.getAllAsync<{ unit_id: string; best_score: number | null }>('SELECT unit_id, best_score FROM unit_progress', []);
    return new Map(rows.map((r) => [r.unit_id, { unitId: r.unit_id, checkpointScore: r.best_score }]));
  }

  async saveCheckpoint(unitId: string, score: number, passed: boolean, now: number): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO unit_progress (unit_id, checkpoint_score, best_score, completed_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(unit_id) DO UPDATE SET checkpoint_score = excluded.checkpoint_score,
         best_score = MAX(COALESCE(best_score, 0), excluded.checkpoint_score),
         completed_at = COALESCE(completed_at, excluded.completed_at)`,
      [unitId, score, score, passed ? now : null],
    );
  }

  // ── Skill items (listening, reading, writing, speaking) ──────────────────

  async skillProgress(): Promise<Map<string, SkillProgress>> {
    const rows = await this.db.getAllAsync<{
      item_id: string;
      skill: Skill;
      unit_id: string | null;
      score: number | null;
      played_fraction: number;
      saved: number;
      last_done_at: number | null;
    }>('SELECT * FROM skill_progress', []);
    return new Map(
      rows.map((r) => [
        r.item_id,
        {
          itemId: r.item_id,
          skill: r.skill,
          unitId: r.unit_id,
          score: r.score,
          playedFraction: r.played_fraction,
          saved: r.saved === 1,
          lastDoneAt: r.last_done_at,
        },
      ]),
    );
  }

  async completeSkillItem(itemId: string, skill: Skill, unitId: string | null, score: number | null, now: number): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO skill_progress (item_id, skill, unit_id, score, last_done_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(item_id) DO UPDATE SET score = COALESCE(excluded.score, score), last_done_at = excluded.last_done_at`,
      [itemId, skill, unitId, score, now],
    );
  }

  async setPlayedFraction(itemId: string, skill: Skill, unitId: string | null, fraction: number): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO skill_progress (item_id, skill, unit_id, played_fraction) VALUES (?, ?, ?, ?)
       ON CONFLICT(item_id) DO UPDATE SET played_fraction = MAX(played_fraction, excluded.played_fraction)`,
      [itemId, skill, unitId, Math.min(1, Math.max(0, fraction))],
    );
  }

  async setSaved(itemId: string, skill: Skill, unitId: string | null, saved: boolean): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO skill_progress (item_id, skill, unit_id, saved) VALUES (?, ?, ?, ?)
       ON CONFLICT(item_id) DO UPDATE SET saved = excluded.saved`,
      [itemId, skill, unitId, saved ? 1 : 0],
    );
  }

  // ── Study time ───────────────────────────────────────────────────────────

  async addStudy(day: DayKey, delta: { seconds?: number; reviews?: number; exercises?: number }): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO study_days (day, seconds, reviews, exercises) VALUES (?, ?, ?, ?)
       ON CONFLICT(day) DO UPDATE SET seconds = seconds + excluded.seconds,
         reviews = reviews + excluded.reviews, exercises = exercises + excluded.exercises`,
      [day, Math.round(delta.seconds ?? 0), delta.reviews ?? 0, delta.exercises ?? 0],
    );
  }

  async studyDays(from: DayKey, to: DayKey): Promise<{ day: DayKey; seconds: number; reviews: number; exercises: number }[]> {
    return this.db.getAllAsync('SELECT day, seconds, reviews, exercises FROM study_days WHERE day >= ? AND day <= ? ORDER BY day', [from, to]);
  }

  /** Days with real study activity, used for the streak. */
  async activeDays(): Promise<Set<DayKey>> {
    const rows = await this.db.getAllAsync<{ day: DayKey }>(
      'SELECT day FROM study_days WHERE seconds >= 60 OR reviews > 0 OR exercises > 0',
      [],
    );
    return new Set(rows.map((r) => r.day));
  }

  // ── Daily items ──────────────────────────────────────────────────────────

  async dailyItems(): Promise<Map<DayKey, DailyItemRow>> {
    const rows = await this.db.getAllAsync<{ day: DayKey; word_id: string; sentence_id: string; word_opened: number; sentence_opened: number }>(
      'SELECT * FROM daily_items',
      [],
    );
    return new Map(
      rows.map((r) => [
        r.day,
        { day: r.day, wordId: r.word_id, sentenceId: r.sentence_id, wordOpened: r.word_opened === 1, sentenceOpened: r.sentence_opened === 1 },
      ]),
    );
  }

  async saveDailyItems(items: readonly DailyAssignment[]): Promise<void> {
    for (const a of items) {
      await this.db.runAsync('INSERT OR IGNORE INTO daily_items (day, word_id, sentence_id) VALUES (?, ?, ?)', [a.day, a.wordId, a.sentenceId]);
    }
  }

  async deleteDailyItems(days: readonly DayKey[]): Promise<void> {
    for (const day of days) {
      await this.db.runAsync('DELETE FROM daily_items WHERE day = ?', [day]);
    }
  }

  async markDailyOpened(day: DayKey, kind: 'word' | 'sentence'): Promise<void> {
    const column = kind === 'word' ? 'word_opened' : 'sentence_opened';
    await this.db.runAsync(`UPDATE daily_items SET ${column} = 1 WHERE day = ?`, [day]);
  }

  // ── Small key/value state (not part of backups) ──────────────────────────

  async meta(key: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]);
    return row?.value ?? null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    await this.db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [key, value]);
  }

  // ── Speaking recordings and writing drafts ───────────────────────────────

  async recordings(taskId?: string): Promise<Recording[]> {
    const rows = await this.db.getAllAsync<{ id: number; task_id: string; uri: string; duration_ms: number; created_at: number }>(
      taskId ? 'SELECT * FROM recordings WHERE task_id = ? ORDER BY created_at DESC' : 'SELECT * FROM recordings ORDER BY created_at DESC',
      taskId ? [taskId] : [],
    );
    return rows.map((r) => ({ id: r.id, taskId: r.task_id, uri: r.uri, durationMs: r.duration_ms, createdAt: r.created_at }));
  }

  async addRecording(taskId: string, uri: string, durationMs: number, now: number): Promise<void> {
    await this.db.runAsync('INSERT INTO recordings (task_id, uri, duration_ms, created_at) VALUES (?, ?, ?, ?)', [taskId, uri, durationMs, now]);
  }

  async deleteRecording(id: number): Promise<void> {
    await this.db.runAsync('DELETE FROM recordings WHERE id = ?', [id]);
  }

  async draft(taskId: string): Promise<{ text: string; checklist: boolean[] } | null> {
    const row = await this.db.getFirstAsync<{ text: string; checklist: string }>('SELECT text, checklist FROM writing_drafts WHERE task_id = ?', [taskId]);
    if (!row) return null;
    try {
      const checklist: unknown = JSON.parse(row.checklist);
      return { text: row.text, checklist: Array.isArray(checklist) ? checklist.map(Boolean) : [] };
    } catch {
      return { text: row.text, checklist: [] };
    }
  }

  async saveDraft(taskId: string, text: string, checklist: readonly boolean[], now: number): Promise<void> {
    await this.db.runAsync('INSERT OR REPLACE INTO writing_drafts (task_id, text, checklist, updated_at) VALUES (?, ?, ?, ?)', [
      taskId,
      text,
      JSON.stringify(checklist),
      now,
    ]);
  }

  // ── Mock tests ───────────────────────────────────────────────────────────

  async saveMockResult(mockId: string, sectionScores: Record<string, number>, total: number, now: number): Promise<void> {
    await this.db.runAsync('INSERT INTO mock_results (mock_id, section_scores, total, taken_at) VALUES (?, ?, ?, ?)', [
      mockId,
      JSON.stringify(sectionScores),
      total,
      now,
    ]);
  }

  async mockResults(): Promise<{ mockId: string; sectionScores: Record<string, number>; total: number; takenAt: number }[]> {
    const rows = await this.db.getAllAsync<{ mock_id: string; section_scores: string; total: number; taken_at: number }>(
      'SELECT * FROM mock_results ORDER BY taken_at DESC',
      [],
    );
    return rows.map((r) => ({ mockId: r.mock_id, sectionScores: JSON.parse(r.section_scores) as Record<string, number>, total: r.total, takenAt: r.taken_at }));
  }
}

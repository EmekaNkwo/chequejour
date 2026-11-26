/**
 * Conjugation trainer cards: one row per verb + tense + person the learner has typed,
 * with its review schedule and how often it was answered right.
 */
import type { ConjRecord } from '../domain/conjugation-trainer';
import type { CardState } from '../domain/srs';
import type { SqlDb } from './sql';

interface ConjRow {
  item_id: string;
  due: number;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: CardState;
  last_review: number | null;
  attempts: number;
  correct: number;
}

const toRecord = (r: ConjRow): ConjRecord => ({
  key: r.item_id,
  card: {
    itemId: r.item_id,
    itemKind: 'conjugation',
    due: r.due,
    stability: r.stability,
    difficulty: r.difficulty,
    scheduledDays: r.scheduled_days,
    learningSteps: r.learning_steps,
    reps: r.reps,
    lapses: r.lapses,
    state: r.state,
    lastReview: r.last_review,
  },
  attempts: r.attempts,
  correct: r.correct,
});

export class ConjugationRepository {
  constructor(private readonly db: SqlDb) {}

  async all(): Promise<ConjRecord[]> {
    return (await this.db.getAllAsync<ConjRow>('SELECT * FROM conj_cards ORDER BY item_id', [])).map(toRecord);
  }

  async get(key: string): Promise<ConjRecord | null> {
    const row = await this.db.getFirstAsync<ConjRow>('SELECT * FROM conj_cards WHERE item_id = ?', [key]);
    return row ? toRecord(row) : null;
  }

  /** Inserts or replaces the record; `created_at` keeps the first answer's time. */
  async save(r: ConjRecord, now: number): Promise<void> {
    const c = r.card;
    await this.db.runAsync(
      `INSERT INTO conj_cards (item_id, due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, state, last_review, attempts, correct, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(item_id) DO UPDATE SET due = excluded.due, stability = excluded.stability, difficulty = excluded.difficulty,
         scheduled_days = excluded.scheduled_days, learning_steps = excluded.learning_steps, reps = excluded.reps, lapses = excluded.lapses,
         state = excluded.state, last_review = excluded.last_review, attempts = excluded.attempts, correct = excluded.correct`,
      [r.key, c.due, c.stability, c.difficulty, c.scheduledDays, c.learningSteps, c.reps, c.lapses, c.state, c.lastReview, r.attempts, r.correct, now],
    );
  }
}

/**
 * Versioned schema migrations, applied in order and tracked with PRAGMA user_version.
 * Never edit a released migration: append a new one.
 */
import type { SqlDb } from './sql';

export const MIGRATIONS: readonly string[] = [
  // 1 — initial schema
  `
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS content_units (
    id TEXT PRIMARY KEY NOT NULL,
    ord INTEGER NOT NULL,
    level TEXT NOT NULL,
    theme TEXT NOT NULL,
    title_fr TEXT NOT NULL,
    description TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS content_items (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,
    unit_id TEXT,
    ord INTEGER NOT NULL,
    level TEXT,
    skill TEXT,
    grammar_tag TEXT,
    title TEXT,
    json TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_items_kind_unit ON content_items (kind, unit_id, ord);

  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS srs_cards (
    item_id TEXT PRIMARY KEY NOT NULL,
    item_kind TEXT NOT NULL,
    due INTEGER NOT NULL,
    stability REAL NOT NULL,
    difficulty REAL NOT NULL,
    scheduled_days INTEGER NOT NULL,
    learning_steps INTEGER NOT NULL,
    reps INTEGER NOT NULL,
    lapses INTEGER NOT NULL,
    state TEXT NOT NULL,
    last_review INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_cards_due ON srs_cards (due);

  CREATE TABLE IF NOT EXISTS review_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,
    grade TEXT NOT NULL,
    reviewed_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,
    unit_id TEXT,
    skill TEXT NOT NULL,
    grammar_tag TEXT,
    level TEXT NOT NULL,
    correct INTEGER NOT NULL,
    context TEXT NOT NULL,
    answered_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_attempts_time ON attempts (answered_at);

  CREATE TABLE IF NOT EXISTS mistakes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL UNIQUE,
    skill TEXT NOT NULL,
    grammar_tag TEXT,
    prompt TEXT NOT NULL,
    user_answer TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    explanation TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    next_review_at INTEGER NOT NULL,
    correct_streak INTEGER NOT NULL DEFAULT 0,
    times_wrong INTEGER NOT NULL DEFAULT 1,
    resolved INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS segment_progress (
    segment_id TEXT PRIMARY KEY NOT NULL,
    unit_id TEXT NOT NULL,
    completed_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS unit_progress (
    unit_id TEXT PRIMARY KEY NOT NULL,
    checkpoint_score REAL,
    best_score REAL,
    completed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS skill_progress (
    item_id TEXT PRIMARY KEY NOT NULL,
    skill TEXT NOT NULL,
    unit_id TEXT,
    score REAL,
    played_fraction REAL NOT NULL DEFAULT 0,
    saved INTEGER NOT NULL DEFAULT 0,
    last_done_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS study_days (
    day TEXT PRIMARY KEY NOT NULL,
    seconds INTEGER NOT NULL DEFAULT 0,
    reviews INTEGER NOT NULL DEFAULT 0,
    exercises INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS daily_items (
    day TEXT PRIMARY KEY NOT NULL,
    word_id TEXT NOT NULL,
    sentence_id TEXT NOT NULL,
    word_opened INTEGER NOT NULL DEFAULT 0,
    sentence_opened INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS recordings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    uri TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS writing_drafts (
    task_id TEXT PRIMARY KEY NOT NULL,
    text TEXT NOT NULL,
    checklist TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mock_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mock_id TEXT NOT NULL,
    section_scores TEXT NOT NULL,
    total REAL NOT NULL,
    taken_at INTEGER NOT NULL
  );
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export async function migrate(db: SqlDb): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const current = row?.user_version ?? 0;
  for (let version = current; version < MIGRATIONS.length; version += 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

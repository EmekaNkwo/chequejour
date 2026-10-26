/**
 * Progress backup: every progress table serialized to one JSON document. Import
 * validates the file before replacing anything, and runs in a single transaction so
 * a bad file can't leave progress half-restored. Speaking recordings are audio files
 * and are not included.
 */
import { z } from 'zod';
import { SCHEMA_VERSION } from './migrations';
import type { SqlDb, SqlParam } from './sql';

/** Kept from the app's first name so every backup ever made still restores. */
export const BACKUP_APP_ID = 'chequejour';

/** Progress tables in restore order. Content tables are rebuilt from the bundle instead. */
export const PROGRESS_TABLES = [
  'settings',
  'srs_cards',
  'review_log',
  'attempts',
  'mistakes',
  'segment_progress',
  'unit_progress',
  'skill_progress',
  'study_days',
  'daily_items',
  'writing_drafts',
  'mock_results',
  'writing_submissions',
] as const;

/** Tables added after the first release: older backups don't have them, so they restore empty. */
const ADDED_LATER: ReadonlySet<string> = new Set(['writing_submissions']);

type ProgressTable = (typeof PROGRESS_TABLES)[number];

const cell = z.union([z.string(), z.number(), z.null()]);
const row = z.record(z.string().regex(/^[a-z_]+$/), cell);

const backupSchema = z.object({
  app: z.literal(BACKUP_APP_ID),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string(),
  tables: z.object(
    Object.fromEntries(PROGRESS_TABLES.map((t) => [t, ADDED_LATER.has(t) ? z.array(row).default([]) : z.array(row)])) as Record<ProgressTable, z.ZodDefault<z.ZodArray<typeof row>>>,
  ),
});

/** Today's stored session plan was built from the old progress, so it is rebuilt. */
const CLEAR_SESSION_PLANS = "DELETE FROM meta WHERE key LIKE 'session:%'";

export type Backup = z.infer<typeof backupSchema>;

export async function exportProgress(db: SqlDb, now: Date): Promise<Backup> {
  const entries = await Promise.all(
    PROGRESS_TABLES.map(async (t) => [t, await db.getAllAsync<Record<string, SqlParam>>(`SELECT * FROM ${t}`, [])] as const),
  );
  return {
    app: BACKUP_APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    tables: Object.fromEntries(entries) as Backup['tables'],
  };
}

export type ImportResult = { ok: true; rows: number } | { ok: false; error: string };

export function parseBackup(json: string): { ok: true; backup: Backup } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'This file is not a valid backup (it is not JSON).' };
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'This file is not a Chaque Jour backup, or it is damaged.' };
  if (parsed.data.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: 'This backup was made by a newer version of the app. Update the app first.' };
  }
  return { ok: true, backup: parsed.data };
}

async function tableColumns(db: SqlDb, table: ProgressTable): Promise<Set<string>> {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`, []);
  return new Set(cols.map((c) => c.name));
}

export async function importProgress(db: SqlDb, json: string): Promise<ImportResult> {
  const parsed = parseBackup(json);
  if (!parsed.ok) return parsed;
  let rows = 0;
  try {
    await db.withTransactionAsync(async () => {
      for (const table of PROGRESS_TABLES) {
        await db.execAsync(`DELETE FROM ${table}`);
        const allowed = await tableColumns(db, table);
        for (const r of parsed.backup.tables[table]) {
          // Only known columns are written, so a crafted file can't inject SQL through keys.
          const cols = Object.keys(r).filter((c) => allowed.has(c));
          if (cols.length === 0) continue;
          await db.runAsync(
            `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
            cols.map((c) => r[c] ?? null),
          );
          rows += 1;
        }
      }
      await db.execAsync(CLEAR_SESSION_PLANS);
    });
  } catch (error: unknown) {
    return { ok: false, error: `The backup could not be restored: ${error instanceof Error ? error.message : 'unknown error'}` };
  }
  return { ok: true, rows };
}

/** Clears all progress and settings; content stays. */
export async function resetProgress(db: SqlDb): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const table of [...PROGRESS_TABLES, 'recordings']) {
      await db.execAsync(`DELETE FROM ${table}`);
    }
    await db.execAsync(CLEAR_SESSION_PLANS);
  });
}

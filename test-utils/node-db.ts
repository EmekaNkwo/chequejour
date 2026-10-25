import Database from 'better-sqlite3';
import type { SqlDb, SqlParam } from '../data/sql';

/** expo-sqlite-compatible adapter over better-sqlite3 for Node tests. */
export function createNodeDb(): SqlDb & { close: () => void } {
  const db = new Database(':memory:');
  return {
    async execAsync(source) {
      db.exec(source);
    },
    async runAsync(source, params: SqlParam[]) {
      const r = db.prepare(source).run(...params);
      return { changes: r.changes, lastInsertRowId: Number(r.lastInsertRowid) };
    },
    async getFirstAsync<T>(source: string, params: SqlParam[]) {
      const stmt = db.prepare(source);
      return ((stmt.reader ? stmt.get(...params) : (stmt.run(...params), undefined)) ?? null) as T | null;
    },
    async getAllAsync<T>(source: string, params: SqlParam[]) {
      return db.prepare(source).all(...params) as T[];
    },
    async withTransactionAsync(task) {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close: () => db.close(),
  };
}

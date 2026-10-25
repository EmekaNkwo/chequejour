/**
 * The subset of expo-sqlite's SQLiteDatabase the data layer uses. Keeping to this
 * interface lets the repositories run against better-sqlite3 in Node tests.
 */
export type SqlParam = string | number | null;

export interface SqlRunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface SqlDb {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SqlParam[]): Promise<SqlRunResult>;
  getFirstAsync<T>(source: string, params: SqlParam[]): Promise<T | null>;
  getAllAsync<T>(source: string, params: SqlParam[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

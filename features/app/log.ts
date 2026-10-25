/**
 * Local-only error logging. Nothing is sent anywhere: errors go to the developer
 * console in debug builds and are kept in a small in-memory ring for the
 * About screen.
 */
const MAX_ENTRIES = 50;
const entries: { at: number; where: string; message: string }[] = [];

export function logError(where: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  entries.unshift({ at: Date.now(), where, message });
  entries.length = Math.min(entries.length, MAX_ENTRIES);
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn(`[${where}]`, error);
  }
}

export function recentErrors(): readonly { at: number; where: string; message: string }[] {
  return entries;
}

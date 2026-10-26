/**
 * Speaking-practice recordings are kept in the app's own document directory and are
 * never uploaded or shared. Deleting a recording removes both the file and its row.
 */
import { Directory, File, Paths } from 'expo-file-system';
import type { ProgressRepository } from '../../data/progress-repo';
import { logError } from '../app/log';

const RECORDINGS_DIR = 'recordings';

function recordingsDirectory(): Directory {
  const dir = new Directory(Paths.document, RECORDINGS_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Moves a finished recording out of the cache into permanent storage and saves it. */
export async function saveRecording(progress: ProgressRepository, taskId: string, tempUri: string, durationMs: number, now: number): Promise<string> {
  const source = new File(tempUri);
  const extension = tempUri.includes('.') ? tempUri.slice(tempUri.lastIndexOf('.')) : '.m4a';
  const target = new File(recordingsDirectory(), `${taskId}-${now}${extension}`);
  await source.move(target);
  // Only the file name is stored: the app container path can change after an update or restore.
  await progress.addRecording(taskId, target.name, durationMs, now);
  return target.name;
}

/** Resolves a stored recording (a file name, or an absolute URI from older rows) to a file URI. */
export function recordingUri(stored: string): string {
  return stored.includes('/') ? stored : new File(recordingsDirectory(), stored).uri;
}

/** Removes every recording file; used when progress is reset. */
export function deleteAllRecordingFiles(): void {
  const dir = new Directory(Paths.document, RECORDINGS_DIR);
  if (dir.exists) dir.delete();
}

export async function deleteRecording(progress: ProgressRepository, id: number, stored: string): Promise<void> {
  try {
    const file = new File(recordingUri(stored));
    if (file.exists) file.delete();
  } catch (error: unknown) {
    // The row is removed anyway so a missing file can't leave a broken entry behind.
    logError('delete recording file', error);
  }
  await progress.deleteRecording(id);
}

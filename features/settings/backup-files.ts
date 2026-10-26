/**
 * Moves progress backups in and out of the app as JSON files: saved into a folder the
 * learner picks, or handed to the system share sheet, and read back with the document
 * picker. Nothing is uploaded anywhere by the app itself.
 */
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { exportProgress, importProgress, type ImportResult } from '../../data/backup';
import type { SqlDb } from '../../data/sql';
import { toDayKey } from '../../domain/dates';

export type ExportResult = { ok: true; uri: string; shared: boolean } | { ok: false; error: string };
export type SaveResult = { ok: true; uri: string } | { ok: false; error: string };

const backupName = (now: Date): string => `chaque-jour-backup-${toDayKey(now)}.json`;

function isPickerCancel(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'ERR_PICKER_CANCELLED';
}

/**
 * Writes the backup into a folder the learner picks (Android's folder picker). Unlike
 * the share sheet, a successful write proves the backup exists. Null when cancelled.
 */
export async function saveToFolder(db: SqlDb, now: Date): Promise<SaveResult | null> {
  let folder: Directory;
  try {
    folder = await Directory.pickDirectoryAsync();
  } catch (e: unknown) {
    if (isPickerCancel(e)) return null;
    throw e;
  }
  const backup = await exportProgress(db, now);
  const file = folder.createFile(backupName(now), 'application/json');
  await file.write(JSON.stringify(backup));
  return { ok: true, uri: file.uri };
}

/**
 * Hands the backup to the share sheet. Android doesn't report whether a target was
 * picked, so `shared: true` only means the sheet opened; the caller asks the learner.
 */
export async function exportToFile(db: SqlDb, now: Date): Promise<ExportResult> {
  const backup = await exportProgress(db, now);
  const file = new File(Paths.cache, backupName(now));
  if (file.exists) file.delete();
  file.create();
  await file.write(JSON.stringify(backup));
  if (!(await Sharing.isAvailableAsync())) {
    return { ok: true, uri: file.uri, shared: false };
  }
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your Chaque Jour backup', UTI: 'public.json' });
  return { ok: true, uri: file.uri, shared: true };
}

/** Returns null when the learner cancels the picker. */
export async function importFromFile(db: SqlDb): Promise<ImportResult | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if (!asset) return null;
  const text = await new File(asset.uri).text();
  return importProgress(db, text);
}

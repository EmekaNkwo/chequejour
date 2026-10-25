/**
 * Moves progress backups in and out of the app as JSON files, using the system
 * share sheet and document picker. Nothing is uploaded anywhere by the app itself.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { exportProgress, importProgress, type ImportResult } from '../../data/backup';
import type { SqlDb } from '../../data/sql';
import { toDayKey } from '../../domain/dates';

export type ExportResult = { ok: true; uri: string; shared: boolean } | { ok: false; error: string };

export async function exportToFile(db: SqlDb, now: Date): Promise<ExportResult> {
  const backup = await exportProgress(db, now);
  const file = new File(Paths.cache, `chequejour-backup-${toDayKey(now)}.json`);
  if (file.exists) file.delete();
  file.create();
  await file.write(JSON.stringify(backup));
  if (!(await Sharing.isAvailableAsync())) {
    return { ok: true, uri: file.uri, shared: false };
  }
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your Chèque du jour backup', UTI: 'public.json' });
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

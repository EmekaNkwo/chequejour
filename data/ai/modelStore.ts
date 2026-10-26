/**
 * Where AI pack files live on the phone and what is installed. The record sits next to
 * the models (not in the database), so it never goes into progress backups and is
 * removed together with the models.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { z } from 'zod';
import type { Manifest, ModelEntry } from '../../domain/ai/manifest';

const DIR_NAME = 'ai-pack';
const RECORD_NAME = 'install.json';

export interface InstalledModel {
  id: string;
  sha256: string;
}

/** A paused download that can be resumed after the app restarts. */
export interface PendingDownload {
  modelId: string;
  state: { url: string; fileUri: string; isDirectory: boolean; headers?: Record<string, string>; resumeData?: string };
}

export interface InstallRecord {
  installed: readonly InstalledModel[];
  pending: PendingDownload | null;
}

export const EMPTY_RECORD: InstallRecord = { installed: [], pending: null };

const recordSchema = z.object({
  installed: z.array(z.object({ id: z.string(), sha256: z.string() })),
  pending: z
    .object({
      modelId: z.string(),
      state: z.object({ url: z.string(), fileUri: z.string(), isDirectory: z.boolean(), headers: z.record(z.string(), z.string()).optional(), resumeData: z.string().optional() }),
    })
    .nullable(),
});

export function packDir(): Directory {
  return new Directory(Paths.document, DIR_NAME);
}

export function modelFile(model: ModelEntry): File {
  return new File(packDir(), model.file);
}

/** Downloads land here and are only renamed to the model file once their checksum matches. */
export function partFile(model: ModelEntry): File {
  return new File(packDir(), `${model.file}.part`);
}

export function ensurePackDir(): void {
  const dir = packDir();
  if (!dir.exists) dir.create();
}

export async function readRecord(): Promise<InstallRecord> {
  const file = new File(packDir(), RECORD_NAME);
  if (!file.exists) return EMPTY_RECORD;
  try {
    const parsed = recordSchema.safeParse(JSON.parse(await file.text()));
    return parsed.success ? parsed.data : EMPTY_RECORD;
  } catch {
    return EMPTY_RECORD;
  }
}

export async function writeRecord(record: InstallRecord): Promise<void> {
  ensurePackDir();
  const file = new File(packDir(), RECORD_NAME);
  if (!file.exists) file.create();
  await file.write(JSON.stringify(record));
}

/**
 * Models that are really usable: recorded as installed with the checksum the manifest
 * expects now (an updated manifest makes an old file count as missing), and still on disk.
 */
export function usableModelIds(manifest: Manifest, record: InstallRecord): string[] {
  return record.installed
    .filter((r) => {
      const model = manifest.models.find((m) => m.id === r.id);
      return model !== undefined && model.sha256 === r.sha256 && modelFile(model).exists;
    })
    .map((r) => r.id);
}

export function withInstalled(record: InstallRecord, model: ModelEntry): InstallRecord {
  return { pending: null, installed: [...record.installed.filter((r) => r.id !== model.id), { id: model.id, sha256: model.sha256 }] };
}

/** Removes every model file, partial download and the record. */
export function deletePack(): void {
  const dir = packDir();
  if (dir.exists) dir.delete();
}

/**
 * The AI pack download: the only network access in the app, and only when the learner
 * starts it. Each model is fetched from the fixed manifest URL into a partial file,
 * checked against its SHA-256, and only then renamed into place. A paused download is
 * recorded so it can resume after the app restarts.
 */
import { DownloadTask, File } from 'expo-file-system';
import type { ModelEntry } from '../../domain/ai/manifest';
import { ensurePackDir, modelFile, partFile, readRecord, withInstalled, writeRecord, type PendingDownload } from '../../data/ai/modelStore';
import { logError } from '../../features/app/log';

export type DownloadResult =
  | { status: 'installed' }
  | { status: 'paused' }
  | { status: 'cancelled' }
  | { status: 'checksum-failed' }
  | { status: 'failed'; message: string; resumable: boolean };

export interface DownloadHandle {
  done: Promise<DownloadResult>;
  pause: () => void;
  cancel: () => void;
}

export interface DownloadOptions {
  /** Share of the file downloaded, 0–1. */
  onProgress?: (fraction: number) => void;
  /** Continues a download paused earlier (from the install record). */
  resumeFrom?: PendingDownload['state'];
}

function removeIfThere(file: File): void {
  if (file.exists) file.delete();
}

async function install(model: ModelEntry, downloaded: File): Promise<DownloadResult> {
  const sha = await downloaded.digest('SHA-256');
  if (sha !== model.sha256) {
    removeIfThere(downloaded);
    return { status: 'checksum-failed' };
  }
  const target = modelFile(model);
  removeIfThere(target);
  await downloaded.move(target);
  await writeRecord(withInstalled(await readRecord(), model));
  return { status: 'installed' };
}

export function startDownload(model: ModelEntry, options: DownloadOptions = {}): DownloadHandle {
  ensurePackDir();
  const part = partFile(model);
  const onProgress = ({ bytesWritten, totalBytes }: { bytesWritten: number; totalBytes: number }) => {
    const total = totalBytes > 0 ? totalBytes : model.bytes;
    options.onProgress?.(Math.min(1, bytesWritten / total));
  };
  const task = options.resumeFrom ? DownloadTask.fromSavable(options.resumeFrom, { onProgress }) : File.createDownloadTask(model.url, part, { onProgress });
  let stop: 'pause' | 'cancel' | null = null;
  let pausing: Promise<void> = Promise.resolve();

  const run = async (): Promise<DownloadResult> => {
    try {
      const file = await (options.resumeFrom ? task.resumeAsync() : task.downloadAsync());
      await pausing;
      if (stop === 'pause') {
        await writeRecord({ ...(await readRecord()), pending: { modelId: model.id, state: task.savable() } });
        return { status: 'paused' };
      }
      if (stop === 'cancel' || !file) {
        removeIfThere(part);
        await writeRecord({ ...(await readRecord()), pending: null });
        return { status: 'cancelled' };
      }
      return await install(model, file);
    } catch (e: unknown) {
      logError('AI pack download', e);
      // A dropped connection keeps what arrived, so the learner can resume.
      const resumable = part.exists;
      await writeRecord({ ...(await readRecord()), pending: resumable ? { modelId: model.id, state: task.savable() } : null });
      return { status: 'failed', message: e instanceof Error ? e.message : 'The download failed.', resumable };
    }
  };

  return {
    done: run(),
    pause: () => {
      stop = 'pause';
      pausing = task.pauseAsync();
    },
    cancel: () => {
      stop = 'cancel';
      task.cancel();
    },
  };
}

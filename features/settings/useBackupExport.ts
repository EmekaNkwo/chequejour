import { useState } from 'react';
import { useToast } from '../../components/ui/Toast';
import { toDayKey } from '../../domain/dates';
import { useApp } from '../app/AppContext';
import { logError } from '../app/log';
import { exportToFile, saveToFolder } from './backup-files';

const FAILED = { tone: 'error', title: 'Backup not created', message: "The backup couldn't be created." } as const;

/**
 * Backs up progress and, only once the backup is known to exist, records today as the
 * last backup day. Saving to a folder proves itself; after the share sheet the learner
 * is asked, because Android doesn't say whether the file went anywhere.
 */
export interface BackupExport {
  /** True while either kind of backup is running. */
  exporting: boolean;
  /** Which kind is running, so only its button shows a spinner. */
  running: 'folder' | 'share' | null;
  exportNow: () => Promise<void>;
  shareNow: () => Promise<void>;
}

export function useBackupExport(): BackupExport {
  const { db, updateSetting } = useApp();
  const toast = useToast();
  const [running, setRunning] = useState<'folder' | 'share' | null>(null);

  const run = async (kind: 'folder' | 'share', backUp: (now: Date) => Promise<boolean>) => {
    setRunning(kind);
    try {
      const now = new Date();
      if (await backUp(now)) await updateSetting('lastBackupDay', toDayKey(now));
    } catch (e: unknown) {
      logError(`${kind} backup`, e);
      toast.show(FAILED);
    } finally {
      setRunning(null);
    }
  };

  const exportNow = () =>
    run('folder', async (now) => {
      const result = await saveToFolder(db, now);
      if (!result) return false;
      if (!result.ok) {
        toast.show({ ...FAILED, message: result.error });
        return false;
      }
      toast.show({ tone: 'success', title: 'Backup saved', message: 'The backup file is in the folder you chose.' });
      return true;
    });

  const shareNow = () =>
    run('share', async (now) => {
      const result = await exportToFile(db, now);
      if (!result.ok) {
        toast.show({ ...FAILED, message: result.error });
        return false;
      }
      if (!result.shared) {
        toast.show({ tone: 'success', title: 'Backup saved', message: result.uri });
        return true;
      }
      return toast.confirm({
        title: 'Did you save the backup?',
        message: "Android doesn't tell the app whether the file was saved or sent, so it only counts as a backup if you say so.",
        confirmLabel: 'Yes, it’s saved',
        cancelLabel: 'No',
      });
    });

  return { exporting: running !== null, running, exportNow, shareNow };
}

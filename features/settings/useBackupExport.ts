import { useState } from 'react';
import { useToast } from '../../components/ui/Toast';
import { toDayKey } from '../../domain/dates';
import { useApp } from '../app/AppContext';
import { logError } from '../app/log';
import { exportToFile } from './backup-files';

/** Exports a backup file and, on success, records today as the last backup day. */
export function useBackupExport(): { exporting: boolean; exportNow: () => Promise<void> } {
  const { db, updateSetting } = useApp();
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const exportNow = async () => {
    setExporting(true);
    try {
      const now = new Date();
      const result = await exportToFile(db, now);
      if (!result.ok) {
        toast.show({ tone: 'error', title: 'Backup not created', message: result.error });
        return;
      }
      await updateSetting('lastBackupDay', toDayKey(now));
      if (!result.shared) toast.show({ tone: 'success', title: 'Backup saved', message: result.uri });
    } catch (e: unknown) {
      logError('export progress', e);
      toast.show({ tone: 'error', title: 'Backup not created', message: "The backup couldn't be created." });
    } finally {
      setExporting(false);
    }
  };
  return { exporting, exportNow };
}

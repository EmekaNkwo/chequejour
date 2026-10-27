/**
 * App-wide services: repositories, settings, today's date and a data version that
 * screens watch to reload after anything changes.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { ContentRepository } from '../../data/content-repo';
import { ProgressRepository } from '../../data/progress-repo';
import { loadSettings, saveSetting, type Settings } from '../../data/settings-repo';
import type { SqlDb } from '../../data/sql';
import { toDayKey, type DayKey } from '../../domain/dates';
import { resetTodayPlan } from '../session/today-plan';
import { logError } from './log';

export interface AppServices {
  db: SqlDb;
  content: ContentRepository;
  progress: ProgressRepository;
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  reloadSettings: () => Promise<void>;
  /** Changes whenever progress changes; include it in data-loading dependencies. */
  dataVersion: number;
  invalidate: () => void;
  today: DayKey;
}

const AppContext = createContext<AppServices | null>(null);

interface AppProviderProps {
  db: SqlDb;
  initialSettings: Settings;
  children: ReactNode;
}

export function AppProvider({ db, initialSettings, children }: AppProviderProps) {
  const content = useMemo(() => new ContentRepository(db), [db]);
  const progress = useMemo(() => new ProgressRepository(db), [db]);
  const [settings, setSettings] = useState(initialSettings);
  const [dataVersion, setDataVersion] = useState(0);
  const [today, setToday] = useState(() => toDayKey(new Date()));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(toDayKey(new Date()));
    });
    return () => sub.remove();
  }, []);

  const invalidate = useCallback(() => setDataVersion((v) => v + 1), []);

  const updateSetting = useCallback(
    async <K extends keyof Settings>(key: K, value: Settings[K]) => {
      await saveSetting(db, key, value);
      // Today's plan was built for the old date; build it again with the new weighting.
      if (key === 'examDate') await resetTodayPlan(progress, today);
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [db, progress, today],
  );

  const reloadSettings = useCallback(async () => {
    try {
      setSettings(await loadSettings(db));
      setDataVersion((v) => v + 1);
    } catch (error: unknown) {
      logError('reloadSettings', error);
    }
  }, [db]);

  const value = useMemo<AppServices>(
    () => ({ db, content, progress, settings, updateSetting, reloadSettings, dataVersion, invalidate, today }),
    [db, content, progress, settings, updateSetting, reloadSettings, dataVersion, invalidate, today],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppServices {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

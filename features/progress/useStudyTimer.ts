import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { toDayKey } from '../../domain/dates';
import { useApp } from '../app/AppContext';
import { logError } from '../app/log';

const FLUSH_EVERY_MS = 30_000;
/** Ignore gaps longer than this (phone left on the table). */
const MAX_CHUNK_MS = 120_000;

/** Counts time spent on a study screen while the app is in the foreground. */
export function useStudyTimer(): void {
  const { progress, invalidate } = useApp();
  const since = useRef<number | null>(Date.now());

  useEffect(() => {
    const flush = () => {
      if (since.current === null) return;
      const now = Date.now();
      const ms = Math.min(now - since.current, MAX_CHUNK_MS);
      since.current = now;
      if (ms >= 1000) {
        progress.addStudy(toDayKey(new Date(now)), { seconds: ms / 1000 }).catch((e: unknown) => logError('study timer', e));
      }
    };
    const interval = setInterval(flush, FLUSH_EVERY_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        since.current = Date.now();
      } else {
        flush();
        since.current = null;
      }
    });
    return () => {
      flush();
      clearInterval(interval);
      sub.remove();
      invalidate();
    };
  }, [progress, invalidate]);
}

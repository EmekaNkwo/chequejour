/**
 * App settings stored as JSON values in the `settings` table, validated on read so a
 * corrupt or old value falls back to the default instead of crashing the app.
 */
import { z } from 'zod';
import { LEVELS, type Level } from '../domain/content-types';
import { DEFAULT_NOTIFICATION_SETTINGS, type NotificationSettings, type NotificationToggle } from '../domain/notification-plan';
import { DEFAULT_REMINDER } from '../domain/reminder-plan';
import { DEFAULT_RATE, legacyRate, PLAYBACK_RATES, type PlaybackRate } from '../domain/playback';
import type { DailyGoal } from '../domain/session';
import { DEFAULT_TARGET_NCLC, NCLC_TARGETS, type Nclc } from '../domain/tcf/nclc';
import type { SqlDb } from './sql';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  notifications: NotificationSettings;
  /** "Come back" reminder after missed days (stored apart so old settings still parse). */
  reminder: NotificationToggle;
  dailyGoal: DailyGoal;
  playbackRate: PlaybackRate;
  autoPlay: boolean;
  theme: ThemePreference;
  onboarded: boolean;
  placementLevel: Level | null;
  installDay: string | null;
  /** The learner's TCF Canada date, if they entered one (YYYY-MM-DD). */
  examDate: string | null;
  /** NCLC level the learner is aiming for in every skill. */
  targetNclc: Nclc;
}

export const DEFAULT_SETTINGS: Settings = {
  notifications: DEFAULT_NOTIFICATION_SETTINGS,
  reminder: DEFAULT_REMINDER,
  dailyGoal: 15,
  playbackRate: DEFAULT_RATE,
  autoPlay: true,
  theme: 'system',
  onboarded: false,
  placementLevel: null,
  installDay: null,
  examDate: null,
  targetNclc: DEFAULT_TARGET_NCLC,
};

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.object({ hour: z.number().int().min(0).max(23), minute: z.number().int().min(0).max(59) });
const toggle = z.object({ enabled: z.boolean(), time });

export const settingsSchemas: { [K in keyof Settings]: z.ZodType<Settings[K]> } = {
  notifications: z.object({ word: toggle, sentence: toggle }),
  reminder: toggle,
  dailyGoal: z.union([z.literal(10), z.literal(15), z.literal(20)]),
  playbackRate: z.union(PLAYBACK_RATES.map((r) => z.literal(r)) as [z.ZodLiteral<PlaybackRate>, z.ZodLiteral<PlaybackRate>, ...z.ZodLiteral<PlaybackRate>[]]),
  autoPlay: z.boolean(),
  theme: z.enum(['system', 'light', 'dark']),
  onboarded: z.boolean(),
  placementLevel: z.enum(LEVELS as [Level, ...Level[]]).nullable(),
  installDay: dayKey.nullable(),
  examDate: dayKey.nullable(),
  targetNclc: z.union(NCLC_TARGETS.map((n) => z.literal(n)) as [z.ZodLiteral<Nclc>, z.ZodLiteral<Nclc>, ...z.ZodLiteral<Nclc>[]]),
};

export async function loadSettings(db: SqlDb): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings', []);
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  const entries = (Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]).map((key) => {
    const raw = stored.get(key);
    if (raw === undefined) return [key, key === 'playbackRate' ? (legacyPlaybackRate(stored) ?? DEFAULT_SETTINGS[key]) : DEFAULT_SETTINGS[key]];
    try {
      const parsed = settingsSchemas[key].safeParse(JSON.parse(raw));
      return [key, parsed.success ? parsed.data : DEFAULT_SETTINGS[key]];
    } catch {
      return [key, DEFAULT_SETTINGS[key]];
    }
  });
  return Object.fromEntries(entries) as Settings;
}

/** Before speed control, the app stored 'normal' or 'slow' under `audioSpeed`. */
function legacyPlaybackRate(stored: Map<string, string>): PlaybackRate | null {
  const raw = stored.get('audioSpeed');
  if (raw === undefined) return null;
  try {
    return legacyRate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveSetting<K extends keyof Settings>(db: SqlDb, key: K, value: Settings[K]): Promise<void> {
  const valid = settingsSchemas[key].parse(value);
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, JSON.stringify(valid)]);
}

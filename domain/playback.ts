/**
 * Audio playback speeds. One speed applies to every clip and to the text-to-speech
 * fallback, and is remembered in settings.
 */

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];
export const DEFAULT_RATE: PlaybackRate = 1;

export function isPlaybackRate(value: unknown): value is PlaybackRate {
  return typeof value === 'number' && (PLAYBACK_RATES as readonly number[]).includes(value);
}

export function formatRate(rate: PlaybackRate): string {
  return `${rate}×`;
}

/** Settings before speed control stored 'normal' or 'slow'. */
export function legacyRate(value: unknown): PlaybackRate | null {
  if (value === 'slow') return 0.75;
  if (value === 'normal') return 1;
  return null;
}

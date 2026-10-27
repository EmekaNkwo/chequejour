/**
 * Which AI models a phone gets, from its total memory: a language model needs about
 * 6 GB, and the larger one 8 GB. Phones report less than their advertised memory: a
 * "6 GB" phone (6×10⁹ bytes) shows about 5.5 GiB once the system keeps its share, so
 * the thresholds sit well below the round numbers.
 */
import { modelById, type Manifest, type ModelEntry } from './manifest';

export const MB = 1024 ** 2;
export const GB = 1024 ** 3;
export type Tier = 'high' | 'mid' | 'low';

const HIGH_MIN_BYTES = 6.8 * GB;
const MID_MIN_BYTES = 5 * GB;
/** Free space to keep beyond the models themselves. */
export const STORAGE_HEADROOM_BYTES = 500 * MB;

export function tierFor(totalMemoryBytes: number | null): Tier {
  if (totalMemoryBytes === null) return 'low';
  if (totalMemoryBytes >= HIGH_MIN_BYTES) return 'high';
  if (totalMemoryBytes >= MID_MIN_BYTES) return 'mid';
  return 'low';
}

export interface PackPlan {
  tier: Tier;
  llm: ModelEntry | null;
  models: readonly ModelEntry[];
}

export function planPack(manifest: Manifest, totalMemoryBytes: number | null): PackPlan {
  const tier = tierFor(totalMemoryBytes);
  const llm = tier === 'low' ? null : modelById(manifest, manifest.llm[tier]);
  return { tier, llm, models: llm ? [llm] : [] };
}

export interface StorageCheck {
  ok: boolean;
  /** Bytes the missing models need, headroom included. */
  neededBytes: number;
}

export function storageCheck(models: readonly ModelEntry[], installedIds: readonly string[], freeBytes: number): StorageCheck {
  const missing = models.filter((m) => !installedIds.includes(m.id)).reduce((n, m) => n + m.bytes, 0);
  const neededBytes = missing + STORAGE_HEADROOM_BYTES;
  return { ok: freeBytes >= neededBytes, neededBytes };
}

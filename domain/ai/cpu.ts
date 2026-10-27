/**
 * How many threads the language model should use. On big.LITTLE phones, adding the small
 * cores slows generation down: each step waits for the slowest thread. Measured on a
 * Helio G99 (2 big + 6 small cores): 2 threads wrote 8.0–8.4 tokens a second, 4 threads 5.8.
 */

/** What the runtime used before this was measured; used when the phone doesn't say. */
export const DEFAULT_THREADS = 4;
const MIN_THREADS = 2;
const MAX_THREADS = 8;
/** A core counts as fast when it has at least this share of the fastest core's capacity. */
const FAST_SHARE = 0.5;

/** `capacities` are the kernel's per-core cpu_capacity values (1024 = the fastest core). */
export function fastCoreCount(capacities: readonly number[]): number {
  const known = capacities.filter((c) => Number.isFinite(c) && c > 0);
  if (known.length === 0) return DEFAULT_THREADS;
  const fastest = Math.max(...known);
  const fast = known.filter((c) => c >= fastest * FAST_SHARE).length;
  return Math.min(MAX_THREADS, Math.max(MIN_THREADS, fast));
}

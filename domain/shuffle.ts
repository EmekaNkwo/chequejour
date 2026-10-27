/**
 * Deterministic shuffling, so an exercise shows the same order every time it renders.
 */

/** Small fast PRNG (mulberry32). */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const rand = random(hashSeed(seed));
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Shuffles indices and makes sure the result differs from the original order. */
export function shuffledOrder(length: number, seed: string): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  if (length < 2) return indices;
  const shuffled = seededShuffle(indices, seed);
  if (shuffled.every((v, i) => v === i)) return [...shuffled.slice(1), shuffled[0]];
  return shuffled;
}

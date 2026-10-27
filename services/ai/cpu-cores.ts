/** Reads Android's per-core cpu_capacity so the language model runs on the fast cores only. */
import { File } from 'expo-file-system';
import { fastCoreCount } from '../../domain/ai/cpu';

const MAX_CORES = 16;
let cached: Promise<number> | null = null;

function readCapacities(): number[] {
  const capacities: number[] = [];
  for (let core = 0; core < MAX_CORES; core += 1) {
    try {
      const file = new File(`file:///sys/devices/system/cpu/cpu${core}/cpu_capacity`);
      if (!file.exists) break;
      // A few bytes: read synchronously. The async read sometimes lost its native handle in release builds.
      capacities.push(Number.parseInt(file.textSync(), 10));
    } catch {
      // Not readable on this phone (or not Android): the default thread count is used.
      break;
    }
  }
  return capacities;
}

/** Threads for the language model on this phone; read once. */
export function llmThreads(): Promise<number> {
  cached ??= Promise.resolve().then(() => fastCoreCount(readCapacities()));
  return cached;
}

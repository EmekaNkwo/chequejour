/** Checks before the AI pack download starts, and how sizes are shown. */
import type { StorageCheck } from './tiers';

export type NetworkKind = 'wifi' | 'cellular' | 'other' | 'none';

export type DownloadBlock = { reason: 'offline' } | { reason: 'mobile-data' } | { reason: 'storage'; neededBytes: number; freeBytes: number };

export function downloadBlock({
  network,
  allowMobileData,
  storage,
  freeBytes,
}: {
  network: NetworkKind;
  allowMobileData: boolean;
  storage: StorageCheck;
  freeBytes: number;
}): DownloadBlock | null {
  if (network === 'none') return { reason: 'offline' };
  if (network !== 'wifi' && !allowMobileData) return { reason: 'mobile-data' };
  if (!storage.ok) return { reason: 'storage', neededBytes: storage.neededBytes, freeBytes };
  return null;
}

/** Decimal units, as Android's storage settings show them. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  return `${Math.round(bytes / 1e6)} MB`;
}

export function blockMessage(block: DownloadBlock): string {
  switch (block.reason) {
    case 'offline':
      return 'Connect to the internet to download the AI pack. After that it works offline.';
    case 'mobile-data':
      return 'Connect to Wi-Fi, or allow mobile data for this download below.';
    case 'storage':
      return `The AI pack needs ${formatBytes(block.neededBytes)} free (including room to spare); this phone has ${formatBytes(block.freeBytes)}.`;
  }
}

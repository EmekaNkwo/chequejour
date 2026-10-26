/**
 * The AI pack's install state for the whole app: what this phone gets, what is
 * installed, and the download in progress. It lives outside any screen so a download
 * keeps going when the learner leaves the AI pack screen.
 */
import * as Device from 'expo-device';
import { Paths } from 'expo-file-system';
import * as Network from 'expo-network';
import manifestJson from '../../content/ai/manifest.json';
import { deletePack, partFile, readRecord, usableModelIds, writeRecord } from '../../data/ai/modelStore';
import { downloadBlock, type DownloadBlock, type NetworkKind } from '../../domain/ai/download-check';
import { parseManifest, type Manifest } from '../../domain/ai/manifest';
import { planPack, storageCheck, type PackPlan } from '../../domain/ai/tiers';
import { startDownload, type DownloadHandle, type DownloadResult } from '../../services/ai/downloader';
import { logError } from '../app/log';

export interface AiPackState {
  plan: PackPlan;
  totalMemory: number | null;
  installedIds: readonly string[];
  /** Model whose paused or interrupted download can resume. */
  pendingId: string | null;
  /** Download under way: which model, and how far along (0–1). */
  active: { modelId: string; fraction: number } | null;
}

/** What one press of Download (or Resume) ended with, for the screen to report. */
export type DownloadOutcome =
  | { kind: 'installed' }
  | { kind: 'blocked'; block: DownloadBlock }
  | { kind: 'paused' }
  | { kind: 'cancelled' }
  | { kind: 'checksum-failed'; modelName: string }
  | { kind: 'failed'; modelName: string };

type Listener = (state: AiPackState) => void;

export const manifest: Manifest = parseManifest(manifestJson);

let state: AiPackState = { plan: planPack(manifest, Device.totalMemory), totalMemory: Device.totalMemory, installedIds: [], pendingId: null, active: null };
let handle: DownloadHandle | null = null;
const listeners = new Set<Listener>();

function emit(next: Partial<AiPackState>): void {
  state = { ...state, ...next };
  listeners.forEach((l) => l(state));
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function getState(): AiPackState {
  return state;
}

/** True when every model the phone's plan needs is installed. */
export function isInstalled(s: AiPackState = state): boolean {
  return s.plan.models.every((m) => s.installedIds.includes(m.id));
}

/** Re-reads the install record (on app start and when the AI pack screen opens). */
export async function refresh(): Promise<void> {
  const record = await readRecord();
  emit({ installedIds: usableModelIds(manifest, record), pendingId: record.pending?.modelId ?? null });
}

async function networkKind(): Promise<NetworkKind> {
  const net = await Network.getNetworkStateAsync();
  if (!net.isConnected || net.type === Network.NetworkStateType.NONE) return 'none';
  if (net.type === Network.NetworkStateType.WIFI || net.type === Network.NetworkStateType.ETHERNET) return 'wifi';
  return net.type === Network.NetworkStateType.CELLULAR ? 'cellular' : 'other';
}

/** Downloads every missing model of the plan, one after another, resuming a paused one first. */
export async function download(allowMobileData: boolean): Promise<DownloadOutcome> {
  if (handle) return { kind: 'paused' };
  await refresh();
  const missing = state.plan.models.filter((m) => !state.installedIds.includes(m.id));
  const block = downloadBlock({
    network: await networkKind(),
    allowMobileData,
    storage: storageCheck(state.plan.models, state.installedIds, Paths.availableDiskSpace),
    freeBytes: Paths.availableDiskSpace,
  });
  if (block) return { kind: 'blocked', block };
  const record = await readRecord();
  for (const model of missing) {
    const resumeFrom = record.pending?.modelId === model.id ? record.pending.state : undefined;
    emit({ active: { modelId: model.id, fraction: 0 } });
    handle = startDownload(model, { resumeFrom, onProgress: (fraction) => emit({ active: { modelId: model.id, fraction } }) });
    let result: DownloadResult;
    try {
      result = await handle.done;
    } finally {
      // Whatever happened, the screen must stop showing a download in progress.
      handle = null;
      emit({ active: null });
      await refresh();
    }
    if (result.status === 'paused') return { kind: 'paused' };
    if (result.status === 'cancelled') return { kind: 'cancelled' };
    if (result.status === 'checksum-failed') return { kind: 'checksum-failed', modelName: model.name };
    if (result.status === 'failed') return { kind: 'failed', modelName: model.name };
  }
  return { kind: 'installed' };
}

export function pause(): void {
  handle?.pause();
}

export async function cancel(): Promise<void> {
  if (handle) {
    handle.cancel();
    return;
  }
  // Nothing running: drop a paused download's partial file.
  const record = await readRecord();
  const pending = state.plan.models.find((m) => m.id === record.pending?.modelId);
  if (pending) {
    const part = partFile(pending);
    if (part.exists) part.delete();
  }
  await writeRecord({ ...record, pending: null });
  await refresh();
}

/** Deletes every AI file; the app goes back to its non-AI behaviour. */
export async function remove(): Promise<void> {
  handle?.cancel();
  try {
    deletePack();
  } catch (e: unknown) {
    logError('delete AI pack', e);
    throw e;
  }
  await refresh();
}

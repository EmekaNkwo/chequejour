import { createHash } from 'node:crypto';
import type { FakeFs } from '../../test-utils/fake-file-system';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const STT = 'speech weights';
const LLM = 'language model weights';
const mockManifest = {
  version: 1,
  allowedHosts: ['huggingface.co'],
  stt: { standard: 'stt', light: 'stt' },
  llm: { high: 'llm', mid: 'llm' },
  models: [
    { id: 'stt', kind: 'stt', name: 'Speech', file: 'stt.bin', url: 'https://huggingface.co/a/stt.bin', bytes: STT.length, sha256: sha(STT), licence: 'MIT', source: 's' },
    { id: 'llm', kind: 'llm', name: 'Language', file: 'llm.gguf', url: 'https://huggingface.co/a/llm.gguf', bytes: LLM.length, sha256: sha(LLM), licence: 'Apache-2.0', source: 's' },
  ],
};
jest.mock('../../content/ai/manifest.json', () => mockManifest);
jest.mock('expo-file-system', () => jest.requireActual('../../test-utils/fake-file-system').fakeFileSystem());
jest.mock('expo-device', () => ({ totalMemory: 6e9 }));
const mockNetwork = { type: 'WIFI', isConnected: true };
jest.mock('expo-network', () => ({
  NetworkStateType: { NONE: 'NONE', WIFI: 'WIFI', ETHERNET: 'ETHERNET', CELLULAR: 'CELLULAR', UNKNOWN: 'UNKNOWN' },
  getNetworkStateAsync: async () => mockNetwork,
}));

const fs = (jest.requireMock('expo-file-system') as { __fs: FakeFs }).__fs;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pack = require('../ai/ai-pack-controller') as typeof import('../ai/ai-pack-controller');

beforeEach(async () => {
  fs.reset();
  fs.remote.set(mockManifest.models[0]!.url, STT);
  fs.remote.set(mockManifest.models[1]!.url, LLM);
  Object.assign(mockNetwork, { type: 'WIFI', isConnected: true });
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  await pack.refresh();
});

describe('AI pack controller', () => {
  it('plans a mid-tier pack for a 6 GB phone and starts uninstalled', () => {
    expect(pack.getState().plan.tier).toBe('mid');
    expect(pack.isInstalled()).toBe(false);
  });

  it('installs every model in the plan and reports progress', async () => {
    const seen: (string | null)[] = [];
    const unsubscribe = pack.subscribe((s) => seen.push(s.active?.modelId ?? null));
    expect(await pack.download(false)).toEqual({ kind: 'installed' });
    unsubscribe();
    expect(pack.getState().installedIds).toEqual(['stt', 'llm']);
    expect(pack.isInstalled()).toBe(true);
    expect(seen).toContain('stt');
    expect(seen).toContain('llm');
  });

  it('waits for Wi-Fi unless mobile data is allowed, and checks storage', async () => {
    mockNetwork.type = 'CELLULAR';
    expect(await pack.download(false)).toEqual({ kind: 'blocked', block: { reason: 'mobile-data' } });
    mockNetwork.isConnected = false;
    expect(await pack.download(true)).toEqual({ kind: 'blocked', block: { reason: 'offline' } });
    Object.assign(mockNetwork, { type: 'WIFI', isConnected: true });
    fs.freeBytes = 1000;
    expect(await pack.download(false)).toMatchObject({ kind: 'blocked', block: { reason: 'storage' } });
    expect(fs.files.size).toBe(0);
  });

  it('pauses, then resumes the same model later', async () => {
    fs.holdDownloads = true;
    const run = pack.download(false);
    await new Promise((r) => setTimeout(r, 0));
    pack.pause();
    expect(await run).toEqual({ kind: 'paused' });
    expect(pack.getState().pendingId).toBe('stt');
    fs.holdDownloads = false;
    expect(await pack.download(false)).toEqual({ kind: 'installed' });
    expect(pack.getState().pendingId).toBeNull();
  });

  it('cancels a paused download and removes its partial file', async () => {
    fs.holdDownloads = true;
    const run = pack.download(false);
    await new Promise((r) => setTimeout(r, 0));
    pack.pause();
    await run;
    await pack.cancel();
    expect(pack.getState().pendingId).toBeNull();
    expect([...fs.files.keys()].some((k) => k.endsWith('.part'))).toBe(false);
  });

  it('cancels a running download and clears the progress so a new one can start', async () => {
    fs.holdDownloads = true;
    const run = pack.download(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(pack.getState().active).not.toBeNull();
    await pack.cancel();
    expect(await run).toEqual({ kind: 'cancelled' });
    expect(pack.getState()).toMatchObject({ active: null, pendingId: null });
    expect([...fs.files.keys()].some((k) => k.endsWith('.part'))).toBe(false);
    fs.holdDownloads = false;
    expect(await pack.download(false)).toEqual({ kind: 'installed' });
  });

  it('reports a dropped connection by name and clears the progress', async () => {
    fs.holdDownloads = true;
    const run = pack.download(false);
    await new Promise((r) => setTimeout(r, 0));
    fs.remote.clear();
    fs.holdDownloads = false;
    fs.finishDownloads();
    expect(await run).toEqual({ kind: 'failed', modelName: mockManifest.models[0]!.name });
    expect(pack.getState()).toMatchObject({ active: null, pendingId: null });
  });

  it('reports a damaged file by name', async () => {
    fs.remote.set(mockManifest.models[0]!.url, 'corrupted');
    expect(await pack.download(false)).toEqual({ kind: 'checksum-failed', modelName: 'Speech' });
    expect(pack.getState().installedIds).toEqual([]);
  });

  it('deletes the whole pack', async () => {
    await pack.download(false);
    await pack.remove();
    expect(pack.getState().installedIds).toEqual([]);
    expect(fs.files.size).toBe(0);
  });
});

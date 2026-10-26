import { blockMessage, downloadBlock, formatBytes } from '../ai/download-check';
import manifestJson from '../../content/ai/manifest.json';
import { parseManifest } from '../ai/manifest';
import { GB, MB, planPack, storageCheck, STORAGE_HEADROOM_BYTES, tierFor } from '../ai/tiers';

const manifest = parseManifest(manifestJson);

describe('AI model manifest', () => {
  it('parses the bundled manifest and resolves every referenced model', () => {
    expect(manifest.models.map((m) => m.id)).toEqual(['whisper-small', 'whisper-base', 'smollm3-3b', 'qwen3-1.7b']);
  });

  it('rejects a model hosted outside the allowed hosts or without https', () => {
    const bad = (url: string) => ({ ...manifestJson, models: manifestJson.models.map((m, i) => (i === 0 ? { ...m, url } : m)) });
    expect(() => parseManifest(bad('https://evil.example.com/x.bin'))).toThrow(/host/);
    expect(() => parseManifest(bad('http://huggingface.co/x.bin'))).toThrow();
  });

  it('rejects a bad checksum, a missing reference and the wrong kind of model', () => {
    expect(() => parseManifest({ ...manifestJson, models: manifestJson.models.map((m) => ({ ...m, sha256: 'abc' })) })).toThrow();
    expect(() => parseManifest({ ...manifestJson, llm: { ...manifestJson.llm, mid: 'nope' } })).toThrow(/nope/);
    expect(() => parseManifest({ ...manifestJson, llm: { ...manifestJson.llm, mid: 'whisper-base' } })).toThrow(/llm/);
    expect(() => parseManifest({ ...manifestJson, models: [...manifestJson.models, manifestJson.models[0]] })).toThrow(/twice/);
  });
});

describe('device tiers', () => {
  it('sorts phones by memory, with a tolerance for memory the system keeps back', () => {
    expect(tierFor(12 * GB)).toBe('high');
    expect(tierFor(7.3 * GB)).toBe('high'); // an "8 GB" phone reports about 7.3 GiB
    expect(tierFor(5.54 * GB)).toBe('mid'); // a "6 GB" phone (a POCO M5 reports 5.54 GiB)
    expect(tierFor(3.6 * GB)).toBe('low'); // a "4 GB" phone
    expect(tierFor(null)).toBe('low');
  });

  it('gives each tier its models: a language model only from the mid tier up', () => {
    expect(planPack(manifest, 8 * GB).models.map((m) => m.id)).toEqual(['whisper-small', 'smollm3-3b']);
    expect(planPack(manifest, 5.54 * GB).models.map((m) => m.id)).toEqual(['whisper-small', 'qwen3-1.7b']);
    expect(planPack(manifest, 3.6 * GB)).toMatchObject({ tier: 'low', llm: null, models: [{ id: 'whisper-small' }] });
    expect(planPack(manifest, 2.8 * GB).models.map((m) => m.id)).toEqual(['whisper-base']);
  });

  it('needs room for the missing models plus headroom', () => {
    const pack = planPack(manifest, 6 * GB);
    const total = pack.models.reduce((n, m) => n + m.bytes, 0);
    expect(storageCheck(pack.models, [], total + STORAGE_HEADROOM_BYTES)).toEqual({ ok: true, neededBytes: total + STORAGE_HEADROOM_BYTES });
    expect(storageCheck(pack.models, [], total)).toEqual({ ok: false, neededBytes: total + STORAGE_HEADROOM_BYTES });
    // Models already installed don't count again.
    expect(storageCheck(pack.models, ['qwen3-1.7b', 'whisper-small'], 600 * MB)).toEqual({ ok: true, neededBytes: STORAGE_HEADROOM_BYTES });
  });
});

describe('before downloading', () => {
  const room = { ok: true, neededBytes: 700 * MB };
  it('allows Wi-Fi, and mobile data only when the learner allowed it', () => {
    expect(downloadBlock({ network: 'wifi', allowMobileData: false, storage: room, freeBytes: GB })).toBeNull();
    expect(downloadBlock({ network: 'cellular', allowMobileData: false, storage: room, freeBytes: GB })).toEqual({ reason: 'mobile-data' });
    expect(downloadBlock({ network: 'cellular', allowMobileData: true, storage: room, freeBytes: GB })).toBeNull();
    expect(downloadBlock({ network: 'none', allowMobileData: true, storage: room, freeBytes: GB })).toEqual({ reason: 'offline' });
  });

  it('says how much space is needed', () => {
    const block = downloadBlock({ network: 'wifi', allowMobileData: false, storage: { ok: false, neededBytes: 1.6e9 }, freeBytes: 0.9e9 });
    expect(block).toEqual({ reason: 'storage', neededBytes: 1.6e9, freeBytes: 0.9e9 });
    expect(blockMessage(block!)).toBe('The AI pack needs 1.6 GB free (including room to spare); this phone has 900 MB.');
    expect(blockMessage({ reason: 'mobile-data' })).toMatch(/Wi-Fi/);
    expect(blockMessage({ reason: 'offline' })).toMatch(/internet/);
  });

  it('writes sizes the way phones show them', () => {
    expect(formatBytes(190085487)).toBe('190 MB');
    expect(formatBytes(1107409472)).toBe('1.1 GB');
    expect(formatBytes(59707625)).toBe('60 MB');
  });
});

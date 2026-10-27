import { createHash } from 'node:crypto';
import type { ModelEntry } from '../../domain/ai/manifest';
import { readRecord } from '../../data/ai/modelStore';
import { startDownload } from '../../services/ai/downloader';
import type { FakeFs } from '../../test-utils/fake-file-system';

jest.mock('expo-file-system', () => jest.requireActual('../../test-utils/fake-file-system').fakeFileSystem());
const fs = (jest.requireMock('expo-file-system') as { __fs: FakeFs }).__fs;

const BODY = 'pretend model weights';
const model: ModelEntry = {
  id: 'qwen3-1.7b',
  kind: 'llm',
  name: 'Qwen3 1.7B',
  file: 'model.gguf',
  url: 'https://huggingface.co/x/model.gguf',
  bytes: BODY.length,
  sha256: createHash('sha256').update(BODY).digest('hex'),
  licence: 'MIT',
  source: 'test',
};
const FINAL = 'file:///documents/ai-pack/model.gguf';
const PART = `${FINAL}.part`;

beforeEach(() => {
  fs.reset();
  fs.remote.set(model.url, BODY);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('AI pack downloader', () => {
  it('downloads to a partial file, checks the checksum, then installs and records the model', async () => {
    const progress: number[] = [];
    const result = await startDownload(model, { onProgress: (p) => progress.push(p) }).done;
    expect(result).toEqual({ status: 'installed' });
    expect(fs.files.get(FINAL)).toBe(BODY);
    expect(fs.files.has(PART)).toBe(false);
    expect(progress.at(-1)).toBe(1);
    expect(await readRecord()).toEqual({ installed: [{ id: model.id, sha256: model.sha256 }], pending: null });
  });

  it('deletes the file and reports it when the checksum does not match', async () => {
    fs.remote.set(model.url, 'tampered weights!!!!!');
    expect(await startDownload(model).done).toEqual({ status: 'checksum-failed' });
    expect(fs.files.has(FINAL)).toBe(false);
    expect(fs.files.has(PART)).toBe(false);
    expect((await readRecord()).installed).toEqual([]);
  });

  it('pauses, remembers where it was, and resumes after a restart', async () => {
    fs.holdDownloads = true;
    const first = startDownload(model);
    await Promise.resolve();
    first.pause();
    const paused = await first.done;
    expect(paused).toMatchObject({ status: 'paused' });
    expect(fs.files.get(PART)).toBe(BODY.slice(0, Math.floor(BODY.length / 2)));
    const record = await readRecord();
    expect(record.pending).toMatchObject({ modelId: model.id, state: { url: model.url, fileUri: PART } });

    fs.holdDownloads = false;
    const resumed = await startDownload(model, { resumeFrom: record.pending!.state }).done;
    expect(resumed).toEqual({ status: 'installed' });
    expect(fs.files.get(FINAL)).toBe(BODY);
    expect((await readRecord()).pending).toBeNull();
  });

  it('cancels and removes the partial file', async () => {
    fs.holdDownloads = true;
    const task = startDownload(model);
    await Promise.resolve();
    task.cancel();
    expect(await task.done).toEqual({ status: 'cancelled' });
    expect(fs.files.has(PART)).toBe(false);
    expect((await readRecord()).pending).toBeNull();
  });

  it('reports a failed download without throwing', async () => {
    fs.remote.clear();
    expect(await startDownload(model).done).toMatchObject({ status: 'failed' });
    expect((await readRecord()).pending).toBeNull();
  });

  it('reports a dropped connection and removes the partial file, since there is nothing to resume from', async () => {
    fs.holdDownloads = true;
    const task = startDownload(model);
    await Promise.resolve();
    await new Promise((r) => setImmediate(r));
    fs.remote.clear(); // the server goes away mid-download
    fs.holdDownloads = false;
    fs.finishDownloads();
    expect(await task.done).toMatchObject({ status: 'failed' });
    expect(fs.files.has(PART)).toBe(false);
    expect((await readRecord()).pending).toBeNull();
    fs.remote.set(model.url, BODY);
    expect(await startDownload(model).done).toEqual({ status: 'installed' });
  });
});

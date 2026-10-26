import { createHash } from 'node:crypto';
import type { ModelEntry } from '../../domain/ai/manifest';
import { readRecord } from '../../data/ai/modelStore';
import { startDownload } from '../../services/ai/downloader';
import type { FakeFs } from '../../test-utils/fake-file-system';

jest.mock('expo-file-system', () => jest.requireActual('../../test-utils/fake-file-system').fakeFileSystem());
const fs = (jest.requireMock('expo-file-system') as { __fs: FakeFs }).__fs;

const BODY = 'pretend model weights';
const model: ModelEntry = {
  id: 'whisper-base',
  kind: 'stt',
  name: 'Whisper base',
  file: 'ggml-base.bin',
  url: 'https://huggingface.co/x/ggml-base.bin',
  bytes: BODY.length,
  sha256: createHash('sha256').update(BODY).digest('hex'),
  licence: 'MIT',
  source: 'test',
};
const FINAL = 'file:///documents/ai-pack/ggml-base.bin';
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
    expect(await startDownload(model).done).toMatchObject({ status: 'failed', resumable: false });
    expect((await readRecord()).pending).toBeNull();
  });

  it('keeps what arrived when the connection drops, so the download can resume', async () => {
    fs.holdDownloads = true;
    const task = startDownload(model);
    await Promise.resolve();
    fs.remote.clear(); // the server goes away; the next request fails
    task.pause();
    await task.done;
    fs.holdDownloads = false;
    const pending = (await readRecord()).pending!;
    expect(await startDownload(model, { resumeFrom: pending.state }).done).toMatchObject({ status: 'failed', resumable: true });
    expect(fs.files.has(PART)).toBe(true);
    expect((await readRecord()).pending).toMatchObject({ modelId: model.id });
    fs.remote.set(model.url, BODY);
    expect(await startDownload(model, { resumeFrom: pending.state }).done).toEqual({ status: 'installed' });
  });
});

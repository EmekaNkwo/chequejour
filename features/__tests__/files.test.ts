/**
 * @jest-environment node
 */
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { exportProgress } from '../../data/backup';
import { migrate } from '../../data/migrations';
import { ProgressRepository } from '../../data/progress-repo';
import type { FakeFs } from '../../test-utils/fake-file-system';
import { createNodeDb } from '../../test-utils/node-db';
import { recentErrors } from '../app/log';
import { exportToFile, importFromFile } from '../settings/backup-files';
import { deleteAllRecordingFiles, deleteAllRecordings, deleteRecording, recordingUri, saveRecording } from '../skills/recordings';

jest.mock('expo-file-system', () => jest.requireActual('../../test-utils/fake-file-system').fakeFileSystem());
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn(async () => undefined) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

const fs = (jest.requireMock('expo-file-system') as { __fs: FakeFs }).__fs;
const DIR = 'file:///documents/recordings';
const isAvailable = Sharing.isAvailableAsync as jest.Mock;
const pick = DocumentPicker.getDocumentAsync as jest.Mock;

async function setup() {
  const db = createNodeDb();
  await migrate(db);
  return { db, progress: new ProgressRepository(db) };
}

beforeEach(() => {
  fs.reset();
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('recordings', () => {
  it('moves a finished recording into permanent storage and stores only its name', async () => {
    const { progress } = await setup();
    fs.files.set('file:///cache/rec-123.m4a', 'audio');
    const name = await saveRecording(progress, 'u01-sp01', 'file:///cache/rec-123.m4a', 4200, 1000);
    expect(name).toBe('u01-sp01-1000.m4a');
    expect(fs.dirs.has(DIR)).toBe(true);
    expect(fs.files.get(`${DIR}/u01-sp01-1000.m4a`)).toBe('audio');
    expect(fs.files.has('file:///cache/rec-123.m4a')).toBe(false);
    expect(await progress.recordings('u01-sp01')).toEqual([expect.objectContaining({ taskId: 'u01-sp01', uri: name, durationMs: 4200, createdAt: 1000 })]);
  });

  it('keeps file names safe when the task id has characters like a colon', async () => {
    const { progress } = await setup();
    fs.files.set('file:///cache/rec-9.m4a', 'audio');
    const name = await saveRecording(progress, 'shadow:u01-w002', 'file:///cache/rec-9.m4a', 900, 5);
    expect(name).toBe('shadow_u01-w002-5.m4a');
    expect(await progress.recordings('shadow:u01-w002')).toHaveLength(1);
  });

  it('defaults to .m4a when the temporary file has no extension', async () => {
    const { progress } = await setup();
    fs.files.set('cachefile', 'audio');
    expect(await saveRecording(progress, 'sp', 'cachefile', 1, 5)).toBe('sp-5.m4a');
  });

  it('resolves stored names inside the recordings folder and keeps old absolute URIs', () => {
    expect(recordingUri('sp-5.m4a')).toBe(`${DIR}/sp-5.m4a`);
    expect(recordingUri('file:///old/place.m4a')).toBe('file:///old/place.m4a');
  });

  it('deletes the file and its row, and the row even when the file is gone', async () => {
    const { progress } = await setup();
    fs.files.set('file:///cache/a.m4a', 'audio');
    const name = await saveRecording(progress, 'sp', 'file:///cache/a.m4a', 1, 5);
    const [rec] = await progress.recordings();
    await deleteRecording(progress, rec.id, name);
    expect(fs.files.size).toBe(0);
    expect(await progress.recordings()).toHaveLength(0);

    await progress.addRecording('sp', 'missing.m4a', 1, 6);
    const [missing] = await progress.recordings();
    await deleteRecording(progress, missing.id, 'missing.m4a');
    expect(await progress.recordings()).toHaveLength(0);
  });

  it('logs a file that cannot be deleted but still removes the row', async () => {
    const { progress } = await setup();
    await progress.addRecording('sp', 'x.m4a', 1, 6);
    const [rec] = await progress.recordings();
    const { File } = jest.requireMock('expo-file-system') as { File: { prototype: { delete: () => void } } };
    fs.files.set(`${DIR}/x.m4a`, 'audio');
    const spy = jest.spyOn(File.prototype, 'delete').mockImplementation(() => {
      throw new Error('read-only');
    });
    await deleteRecording(progress, rec.id, 'x.m4a');
    spy.mockRestore();
    expect(await progress.recordings()).toHaveLength(0);
    expect(recentErrors()[0]).toMatchObject({ where: 'delete recording file', message: 'read-only' });
  });

  it('removes every recording file on reset', () => {
    deleteAllRecordingFiles();
    fs.dirs.add(DIR);
    fs.files.set(`${DIR}/a.m4a`, 'a');
    deleteAllRecordingFiles();
    expect(fs.dirs.has(DIR)).toBe(false);
    expect(fs.files.size).toBe(0);
  });

  it('deletes all recordings, rows and files, and reports how many there were', async () => {
    const { progress } = await setup();
    await progress.addRecording('u01-sp01', 'a.m4a', 1000, 1);
    await progress.addRecording('shadow:s001', 'b.m4a', 1000, 2);
    fs.dirs.add(DIR);
    fs.files.set(`${DIR}/a.m4a`, 'a');
    expect(await deleteAllRecordings(progress)).toBe(2);
    expect(await progress.recordings()).toEqual([]);
    expect(fs.files.size).toBe(0);
  });
});

describe('backup files', () => {
  const now = new Date(2026, 9, 26, 9, 0);
  const file = 'file:///cache/chaque-jour-backup-2026-10-26.json';

  it('writes the backup as JSON and opens the share sheet', async () => {
    const { db, progress } = await setup();
    await progress.addStudy('2026-10-26', { seconds: 60 });
    isAvailable.mockResolvedValue(true);
    fs.files.set(file, 'stale');
    const result = await exportToFile(db, now);
    expect(result).toEqual({ ok: true, uri: file, shared: true });
    expect(JSON.parse(fs.files.get(file)!)).toEqual(JSON.parse(JSON.stringify(await exportProgress(db, now))));
    expect(Sharing.shareAsync).toHaveBeenCalledWith(file, { mimeType: 'application/json', dialogTitle: 'Save your Chaque Jour backup', UTI: 'public.json' });
  });

  it('still saves the file when sharing is unavailable', async () => {
    const { db } = await setup();
    isAvailable.mockResolvedValue(false);
    expect(await exportToFile(db, now)).toEqual({ ok: true, uri: file, shared: false });
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    expect(fs.files.has(file)).toBe(true);
  });

  it('imports a picked backup file into another install', async () => {
    const source = await setup();
    await source.progress.addStudy('2026-10-25', { seconds: 120, reviews: 1 });
    fs.files.set('file:///cache/picked.json', JSON.stringify(await exportProgress(source.db, now)));
    pick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/picked.json' }] });
    const target = await setup();
    const result = await importFromFile(target.db);
    expect(result).toMatchObject({ ok: true });
    expect(await target.progress.studyDays('2026-10-25', '2026-10-25')).toEqual([{ day: '2026-10-25', seconds: 120, reviews: 1, exercises: 0 }]);
    expect(pick).toHaveBeenCalledWith({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false });
  });

  it('reports an unreadable file as an import error', async () => {
    const { db } = await setup();
    fs.files.set('file:///cache/bad.json', 'not json');
    pick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/bad.json' }] });
    expect(await importFromFile(db)).toMatchObject({ ok: false });
  });

  it('returns null when the picker is cancelled or returns nothing', async () => {
    const { db } = await setup();
    pick.mockResolvedValueOnce({ canceled: true, assets: null });
    expect(await importFromFile(db)).toBeNull();
    pick.mockResolvedValueOnce({ canceled: false, assets: [] });
    expect(await importFromFile(db)).toBeNull();
  });
});

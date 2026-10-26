/**
 * @jest-environment node
 *
 * Upgrading from the A2–B1 course (content v6, no A1 units) to the A1–B1 course: the
 * learner keeps their unit, progress and mistakes, and older backups still restore.
 */
import { exportProgress, importProgress, resetProgress } from '../../data/backup';
import { ContentRepository } from '../../data/content-repo';
import { seedContentIfNeeded } from '../../data/content-seed';
import { migrate } from '../../data/migrations';
import { ProgressRepository } from '../../data/progress-repo';
import { loadSettings, saveSetting } from '../../data/settings-repo';
import type { ContentBundle } from '../../domain/content-types';
import { newCard } from '../../domain/srs';
import { createNodeDb } from '../../test-utils/node-db';
import { realBundle } from '../../test-utils/real-content';
import { loadPath } from '../path/path-service';

/** The shipped course as it was before the A1 units: u01–u18 numbered 1–18. */
const beforeA1: ContentBundle = {
  ...realBundle,
  version: 6,
  units: realBundle.units.filter((u) => u.id.startsWith('u')).map((u) => ({ ...u, order: u.order - 6 })),
};

const mistake = { itemId: 'u02-ex01', skill: 'structures' as const, grammarTag: 'passe-compose' as const, prompt: 'p', userAnswer: 'x', correctAnswer: 'y', explanation: 'e', at: 0 };

async function oldInstall() {
  const db = createNodeDb();
  await migrate(db);
  await seedContentIfNeeded(db, beforeA1);
  const progress = new ProgressRepository(db);
  await saveSetting(db, 'onboarded', true);
  await progress.saveCheckpoint('u01', 0.9, true, 1);
  await progress.saveCheckpoint('u02', 0.8, true, 2);
  await progress.addCards([newCard('u02-w001', 'word', 0)], 0);
  await progress.recordMistake(mistake);
  return { db, progress, content: new ContentRepository(db) };
}

describe('upgrading to the A1 course', () => {
  it('has six A1 units before the original ones, which keep their ids', () => {
    expect(realBundle.units.map((u) => u.id)).toEqual([...['a01', 'a02', 'a03', 'a04', 'a05', 'a06'], ...beforeA1.units.map((u) => u.id)]);
    expect(realBundle.units.map((u) => u.order)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(realBundle.units.slice(0, 6).map((u) => u.level)).toEqual(['A1', 'A1', 'A1', 'A1+', 'A1+', 'A1+']);
    const a1Words = realBundle.units.slice(0, 6).reduce((n, u) => n + u.vocab.length, 0);
    expect(a1Words).toBeGreaterThanOrEqual(380);
  });

  it('keeps the current unit, progress and mistakes when the new content is seeded', async () => {
    const { db, progress, content } = await oldInstall();
    const settings = await loadSettings(db);
    expect(settings.placementLevel).toBeNull();
    // Before the upgrade this learner was on u03: u01 and u02 passed, no placement taken.

    expect(await seedContentIfNeeded(db, realBundle)).toBe(true);
    const after = await loadPath(content, progress, (await loadSettings(db)).placementLevel, new Set());
    expect(after.current?.id).toBe('u03');
    expect(after.units.filter((u) => u.status === 'completed').map((u) => u.id)).toEqual(['u01', 'u02']);
    // The A1 units are open, optional review.
    expect(after.units.filter((u) => u.id.startsWith('a')).every((u) => u.status === 'available')).toBe(true);
    expect(await progress.card('u02-w001')).not.toBeNull();
    expect((await progress.mistakes()).map((m) => m.itemId)).toEqual(['u02-ex01']);
  });

  it('restores a backup made before the A1 units into the new course at the same place', async () => {
    const old = await oldInstall();
    const json = JSON.stringify(await exportProgress(old.db, new Date(0)));

    const db = createNodeDb();
    await migrate(db);
    await seedContentIfNeeded(db, realBundle);
    const progress = new ProgressRepository(db);
    await resetProgress(db);
    expect((await importProgress(db, json)).ok).toBe(true);
    const settings = await loadSettings(db);
    const path = await loadPath(new ContentRepository(db), progress, settings.placementLevel, new Set());
    expect(path.current?.id).toBe('u03');
    expect((await progress.mistakes()).map((m) => m.itemId)).toEqual(['u02-ex01']);
    expect(await progress.card('u02-w001')).not.toBeNull();
  });
});

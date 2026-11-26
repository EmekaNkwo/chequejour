/**
 * @jest-environment node
 */
import { recordAnswer } from '../../domain/conjugation-trainer';
import { exportProgress, importProgress, resetProgress } from '../backup';
import { ConjugationRepository } from '../conjugation-repo';
import { migrate } from '../migrations';
import { createNodeDb } from '../../test-utils/node-db';

async function setup() {
  const db = createNodeDb();
  await migrate(db);
  return { db, repo: new ConjugationRepository(db) };
}

describe('conjugation repository', () => {
  it('saves a record, replaces it on the next answer, and reads it back', async () => {
    const { repo } = await setup();
    expect(await repo.all()).toEqual([]);
    const first = recordAnswer(null, 'être|présent|0', 'wrong', 1000);
    await repo.save(first, 1000);
    const second = recordAnswer(first, 'être|présent|0', 'correct', 2000);
    await repo.save(second, 2000);
    expect(await repo.all()).toEqual([second]);
    expect(await repo.get('être|présent|0')).toEqual(second);
    expect(await repo.get('avoir|présent|0')).toBeNull();
  });

  it('is part of backups and of a progress reset', async () => {
    const { db, repo } = await setup();
    await repo.save(recordAnswer(null, 'aller|imparfait|3', 'correct', 1000), 1000);
    const json = JSON.stringify(await exportProgress(db, new Date(0)));
    await resetProgress(db);
    expect(await repo.all()).toEqual([]);
    expect((await importProgress(db, json)).ok).toBe(true);
    expect((await repo.all()).map((r) => r.key)).toEqual(['aller|imparfait|3']);
  });

  it('restores a backup made before the trainer existed', async () => {
    const { db, repo } = await setup();
    const backup = await exportProgress(db, new Date(0));
    const { conj_cards: _dropped, ...oldTables } = backup.tables;
    expect((await importProgress(db, JSON.stringify({ ...backup, schemaVersion: 3, tables: oldTables }))).ok).toBe(true);
    expect(await repo.all()).toEqual([]);
  });
});

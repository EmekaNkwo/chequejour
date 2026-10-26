/**
 * @jest-environment node
 */
import { ContentRepository } from '../../data/content-repo';
import { migrate } from '../../data/migrations';
import { ProgressRepository } from '../../data/progress-repo';
import { loadSettings } from '../../data/settings-repo';
import { toDayKey } from '../../domain/dates';
import { createNodeDb } from '../../test-utils/node-db';
import { realBundle } from '../../test-utils/real-content';
import { initDatabase } from '../app/bootstrap';
import { recordComprehension } from '../exercises/record-result';

const NOW = Date.UTC(2026, 9, 25, 9);

describe('initDatabase', () => {
  it('migrates, seeds the bundled content and remembers the install day once', async () => {
    const db = createNodeDb();
    await initDatabase(db);
    const content = new ContentRepository(db);
    expect((await content.units()).map((u) => u.id)).toEqual(realBundle.units.map((u) => u.id));
    const installDay = (await loadSettings(db)).installDay;
    expect(installDay).toBe(toDayKey(new Date()));
    await db.runAsync("UPDATE settings SET value = '\"2026-01-01\"' WHERE key = 'installDay'", []);
    await initDatabase(db);
    expect((await loadSettings(db)).installDay).toBe('2026-01-01');
  });
});

describe('recordComprehension', () => {
  const base = {
    questionId: 'u01-li01-q1',
    skill: 'listening' as const,
    level: 'A2' as const,
    unitId: 'u01',
    question: 'Où sont-ils ?',
    userAnswer: 'À la gare',
    correctAnswer: 'Au café',
    explanation: 'Ils commandent un café.',
    now: NOW,
  };

  async function setup() {
    const db = createNodeDb();
    await migrate(db);
    return new ProgressRepository(db);
  }

  it('records the attempt and saves a wrong answer as a mistake', async () => {
    const progress = await setup();
    await recordComprehension(progress, { ...base, correct: false, context: 'lesson' });
    expect(await progress.allAttempts()).toEqual([{ skill: 'listening', grammarTag: null, correct: false, answeredAt: NOW }]);
    expect((await progress.mistakes())[0]).toMatchObject({ itemId: 'u01-li01-q1', prompt: 'Où sont-ils ?', userAnswer: 'À la gare', correctAnswer: 'Au café' });
  });

  it('keeps right answers and mock answers out of the mistakes', async () => {
    const progress = await setup();
    await recordComprehension(progress, { ...base, correct: true, context: 'lesson' });
    await recordComprehension(progress, { ...base, questionId: 'mk1-li01-q1', correct: false, context: 'mock' });
    expect(await progress.allAttempts()).toHaveLength(2);
    expect(await progress.mistakes()).toHaveLength(0);
  });
});

describe('progress repository extras', () => {
  async function setup() {
    const db = createNodeDb();
    await migrate(db);
    return { db, progress: new ProgressRepository(db) };
  }

  it('looks mistakes up by id and deletes them', async () => {
    const { progress } = await setup();
    const m = { skill: 'structures' as const, grammarTag: null, prompt: 'p', userAnswer: 'x', correctAnswer: 'y', explanation: 'e', at: 0 };
    await progress.recordMistake({ ...m, itemId: 'a' });
    await progress.recordMistake({ ...m, itemId: 'b' });
    const all = await progress.mistakes();
    expect(await progress.mistakesByIds([])).toEqual([]);
    expect((await progress.mistakesByIds([all[1].id])).map((x) => x.itemId)).toEqual([all[1].itemId]);
    await progress.deleteMistake(all[0].id);
    expect((await progress.mistakes()).map((x) => x.id)).toEqual([all[1].id]);
    await progress.retryMistake('missing', true, 0);
  });

  it('reads a draft with a damaged checklist as unticked', async () => {
    const { db, progress } = await setup();
    await progress.saveDraft('w1', 'Bonjour', [true], 1);
    await db.runAsync("UPDATE writing_drafts SET checklist = '{oops' WHERE task_id = 'w1'", []);
    expect(await progress.draft('w1')).toEqual({ text: 'Bonjour', checklist: [] });
    await db.runAsync("UPDATE writing_drafts SET checklist = '{\"a\":1}' WHERE task_id = 'w1'", []);
    expect(await progress.draft('w1')).toEqual({ text: 'Bonjour', checklist: [] });
    expect(await progress.draft('none')).toBeNull();
  });
});

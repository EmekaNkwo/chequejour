/**
 * @jest-environment node
 */
import { ConjugationRepository } from '../../data/conjugation-repo';
import { loadSettings, saveSetting } from '../../data/settings-repo';
import { setupRealContent } from '../../test-utils/real-content';
import { loadTrainer, saveTrainerAnswer, trainerOverview } from '../conjugation/trainer-service';

const NOW = Date.UTC(2026, 10, 26, 9);

async function app() {
  const base = await setupRealContent();
  await saveSetting(base.db, 'placementLevel', 'A2');
  return { ...base, settings: await loadSettings(base.db) };
}

describe('conjugation trainer service', () => {
  it('builds a session of exercises at the learner level', async () => {
    const a = await app();
    const session = await loadTrainer(a, { now: NOW, seed: 's' });
    expect(session.exercises).toHaveLength(10);
    expect(session.exercises.every((e) => e.type === 'conjugation' && e.id.startsWith('conj:'))).toBe(true);
    expect(session.items).toHaveLength(10);
  });

  it('focuses on one verb', async () => {
    const a = await app();
    const session = await loadTrainer(a, { now: NOW, seed: 's', verb: 'donner' });
    expect(session.exercises.every((e) => e.verb === 'donner')).toBe(true);
  });

  it('saves answers to the schedule and the attempt history, and brings wrong ones back first', async () => {
    const a = await app();
    const { items } = await loadTrainer(a, { now: NOW, seed: 's' });
    await saveTrainerAnswer(a, items[0], 'wrong', NOW);
    await saveTrainerAnswer(a, items[1], 'correct', NOW);
    const records = await new ConjugationRepository(a.db).all();
    expect(records).toHaveLength(2);
    expect((await a.progress.allAttempts()).length).toBe(2);
    expect((await a.progress.mistakes()).length).toBe(0);

    const later = NOW + 30 * 60_000;
    const next = await loadTrainer(a, { now: later, seed: 't' });
    expect(next.items[0]).toEqual(items[0]);
    const overview = await trainerOverview(a, later);
    // New forms go through short learning steps: wrong ≈ 1 min, right ≈ 10 min, so both are due again.
    expect(overview.due).toBe(2);
    expect(overview.stats.find((s) => s.tense === items[0].tense)?.attempts).toBeGreaterThan(0);
  });
});

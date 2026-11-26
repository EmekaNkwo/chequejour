import { buildTrainerSession, conjKey, gradeFor, parseConjKey, recordAnswer, tenseStats, type ConjRecord } from '../conjugation-trainer';
import { TENSES } from '../exercises/conjugation-tables';
import { newCard } from '../srs';
import { quizTenses, verbPool } from '../verb-of-day';

const NOW = Date.UTC(2026, 10, 26, 9);
const DAY = 86_400_000;

function record(key: string, over: Partial<ConjRecord> = {}): ConjRecord {
  return { key, card: newCard(key, 'conjugation', NOW - DAY), attempts: 1, correct: 1, ...over };
}

describe('conjugation trainer keys', () => {
  it('round-trips a verb, tense and person, and rejects anything else', () => {
    const key = conjKey({ verb: 'être', tense: 'imparfait', person: 3 });
    expect(parseConjKey(key)).toEqual({ verb: 'être', tense: 'imparfait', person: 3 });
    expect(parseConjKey('nope|imparfait|3')).toBeNull();
    expect(parseConjKey('être|passé simple|3')).toBeNull();
    expect(parseConjKey('être|imparfait|6')).toBeNull();
  });
});

describe('trainer sessions', () => {
  it('starts a new learner on new forms from their level and tenses only', () => {
    const items = buildTrainerSession({ level: 'A1', records: [], now: NOW, seed: 's' });
    expect(items).toHaveLength(10);
    const verbs = new Set(verbPool('A1').map((v) => v.infinitive));
    expect(items.every((i) => verbs.has(i.verb) && quizTenses('A1').includes(i.tense))).toBe(true);
    expect(new Set(items.map(conjKey)).size).toBe(10);
  });

  it('puts due forms first, oldest due first, then tops up with new ones', () => {
    const due = [
      record('être|présent|0', { card: { ...newCard('être|présent|0', 'conjugation', NOW), due: NOW - 2 * DAY } }),
      record('avoir|présent|1', { card: { ...newCard('avoir|présent|1', 'conjugation', NOW), due: NOW - 5 * DAY } }),
      record('aller|présent|2', { card: { ...newCard('aller|présent|2', 'conjugation', NOW), due: NOW + 5 * DAY } }),
    ];
    const items = buildTrainerSession({ level: 'A1', records: due, now: NOW, seed: 's' });
    expect(items.slice(0, 2).map(conjKey)).toEqual(['avoir|présent|1', 'être|présent|0']);
    expect(items.map(conjKey)).not.toContain('aller|présent|2');
    expect(items).toHaveLength(10);
  });

  it('spreads new forms across tenses, weakest tense first', () => {
    const weakImparfait = [record('parler|imparfait|0', { card: { ...newCard('x', 'conjugation', NOW), due: NOW + DAY }, attempts: 4, correct: 1 })];
    const items = buildTrainerSession({ level: 'A2', records: weakImparfait, now: NOW, seed: 's', size: 8 });
    expect(items[0].tense).toBe('imparfait');
    expect(new Set(items.map((i) => i.tense)).size).toBe(quizTenses('A2').length);
  });

  it('focuses on one verb when asked, practising ahead once its new forms run out', () => {
    const items = buildTrainerSession({ level: 'B1', records: [], now: NOW, seed: 's', verb: 'donner' });
    expect(items).toHaveLength(10);
    expect(items.every((i) => i.verb === 'donner')).toBe(true);
    expect(new Set(items.map((i) => i.tense)).size).toBe(TENSES.length);

    const all = TENSES.flatMap((tense) => [0, 1, 2, 3, 4, 5].map((person) => record(conjKey({ verb: 'donner', tense, person }), { card: { ...newCard('x', 'conjugation', NOW), due: NOW + DAY } })));
    expect(buildTrainerSession({ level: 'B1', records: all, now: NOW, seed: 's', verb: 'donner' })).toHaveLength(10);
  });
});

describe('recording answers', () => {
  it('maps answer results to review grades', () => {
    expect(gradeFor('correct')).toBe('good');
    expect(gradeFor('almost')).toBe('hard');
    expect(gradeFor('wrong')).toBe('again');
  });

  it('creates a record on the first answer and counts attempts without changing the input', () => {
    const first = recordAnswer(null, 'être|présent|0', 'wrong', NOW);
    expect(first).toMatchObject({ key: 'être|présent|0', attempts: 1, correct: 0 });
    expect(first.card.lapses + first.card.reps).toBeGreaterThan(0);
    const second = recordAnswer(first, 'être|présent|0', 'correct', NOW + DAY);
    expect(second).toMatchObject({ attempts: 2, correct: 1 });
    expect(first.attempts).toBe(1);
    expect(second.card.due).toBeGreaterThan(NOW + DAY);
  });

  it('summarises accuracy per tense', () => {
    const stats = tenseStats([record('être|présent|0', { attempts: 4, correct: 3 }), record('avoir|présent|1', { attempts: 6, correct: 3 })]);
    expect(stats.find((s) => s.tense === 'présent')).toEqual({ tense: 'présent', attempts: 10, correct: 6, accuracy: 0.6, forms: 2 });
    expect(stats.find((s) => s.tense === 'imparfait')?.accuracy).toBeNull();
    expect(stats.map((s) => s.tense)).toEqual([...TENSES]);
  });
});

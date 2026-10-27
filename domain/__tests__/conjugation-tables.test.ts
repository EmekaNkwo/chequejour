import bundleJson from '../../content/build/content.json';
import type { ContentBundle } from '../content-types';
import { normalize } from '../answers';
import { conjugate, findVerb, PERSONS, TENSES, VERBS, withPronoun, type Tense } from '../exercises/conjugation-tables';

const bundle = bundleJson as unknown as ContentBundle;

describe('conjugation tables', () => {
  it('derives the regular tenses correctly, including spelling changes', () => {
    const manger = findVerb('manger')!;
    expect(conjugate(manger, 'imparfait')).toEqual(['mangeais', 'mangeais', 'mangeait', 'mangions', 'mangiez', 'mangeaient']);
    expect(conjugate(findVerb('être')!, 'imparfait')[0]).toBe('étais');
    expect(conjugate(findVerb('venir')!, 'subjonctif présent')).toEqual(['vienne', 'viennes', 'vienne', 'venions', 'veniez', 'viennent']);
    expect(conjugate(findVerb('voir')!, 'subjonctif présent')[3]).toBe('voyions');
    expect(conjugate(findVerb('pouvoir')!, 'conditionnel présent')[0]).toBe('pourrais');
    expect(conjugate(findVerb('aller')!, 'passé composé')).toEqual(['suis allé(e)', 'es allé(e)', 'est allé(e)', 'sommes allé(e)s', 'êtes allé(e)s', 'sont allé(e)s']);
  });

  it('adds pronouns with elision and que for the subjonctif', () => {
    const avoir = findVerb('avoir')!;
    expect(withPronoun(conjugate(avoir, 'présent')[0], 0, 'présent')).toBe("j'ai");
    expect(withPronoun(conjugate(avoir, 'subjonctif présent')[0], 0, 'subjonctif présent')).toBe("que j'aie");
    expect(withPronoun(conjugate(avoir, 'subjonctif présent')[2], 2, 'subjonctif présent')).toBe("qu'il/elle/on ait");
    expect(withPronoun('parle', 0, 'présent')).toBe('je parle');
  });

  it('gives six forms for every verb and tense', () => {
    for (const v of VERBS) for (const t of TENSES) expect(conjugate(v, t).every((f) => f.length > 0)).toBe(true);
  });

  it('agrees with every course conjugation exercise for the verbs and tenses it covers', () => {
    const person: Record<string, number> = { je: 0, "j'": 0, tu: 1, il: 2, elle: 2, on: 2, nous: 3, vous: 4, ils: 5, elles: 5 };
    const exercises = bundle.units.flatMap((u) => [...u.exercises, ...u.checkpoint]).filter((e) => e.type === 'conjugation');
    let compared = 0;
    for (const e of exercises) {
      const verb = findVerb(e.verb);
      const p = person[e.person.toLowerCase()];
      if (!verb || p === undefined || !(TENSES as readonly string[]).includes(e.tense)) continue;
      // Passé composé with être shows (e)/(e)s; compare against the masculine form.
      const plain = normalize(conjugate(verb, e.tense as Tense)[p].replace(/\(e\)(s?)$/, '$1'));
      const accepted = e.answers.map(normalize);
      expect({ id: e.id, ok: accepted.includes(plain) }).toEqual({ id: e.id, ok: true });
      compared += 1;
    }
    expect(compared).toBeGreaterThan(10);
    expect(PERSONS).toHaveLength(6);
  });
});

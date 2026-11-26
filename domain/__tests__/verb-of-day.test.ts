import { checkConjugation } from '../exercises/conjugation-check';
import { findVerb, TENSES, VERBS } from '../exercises/conjugation-tables';
import { conjugationTable, quizTenses, verbOfDay, verbPool, verbQuiz } from '../verb-of-day';
import { addDays } from '../dates';

describe('verb of the day', () => {
  it('only offers verbs at or below the learner level', () => {
    const a1 = verbPool('A1');
    expect(a1.length).toBeGreaterThanOrEqual(10);
    expect(a1.every((v) => v.level === 'A1')).toBe(true);
    expect(verbPool('B1')).toHaveLength(VERBS.length);
    expect(verbPool('A2').length).toBeGreaterThan(verbPool('A1+').length);
  });

  it('gives the same verb for the same day and level', () => {
    expect(verbOfDay('2026-11-26', 'A2')).toBe(verbOfDay('2026-11-26', 'A2'));
  });

  it("doesn't repeat a verb until the whole pool has been used", () => {
    const pool = verbPool('A2');
    const seen = Array.from({ length: pool.length }, (_, i) => verbOfDay(addDays('2026-11-26', i), 'A2').infinitive);
    expect(new Set(seen).size).toBe(pool.length);
  });

  it('builds a table with pronouns for every tense', () => {
    const table = conjugationTable(findVerb('avoir')!);
    expect(table.map((t) => t.tense)).toEqual([...TENSES]);
    expect(table[0].forms[0]).toBe("j'ai");
    expect(table[5].forms[2]).toBe("qu'il/elle/on ait");
  });

  it('quizzes only tenses the learner has met', () => {
    expect(quizTenses('A1')).toEqual(['présent']);
    expect(quizTenses('B1')).toEqual([...TENSES]);
    for (let i = 0; i < 20; i += 1) {
      expect(verbQuiz(findVerb('parler')!, addDays('2026-01-01', i), 'A1').tense).toBe('présent');
    }
  });

  it('builds a quiz whose canonical answer is accepted, with or without the pronoun', () => {
    for (let i = 0; i < 30; i += 1) {
      const quiz = verbQuiz(verbOfDay(addDays('2026-01-01', i), 'B1'), addDays('2026-01-01', i), 'B1');
      expect(quiz.type).toBe('conjugation');
      expect(checkConjugation(quiz.answers[0], quiz).result).not.toBe('wrong');
      expect(checkConjugation(`${quiz.person} ${quiz.answers[0]}`, quiz).result).not.toBe('wrong');
    }
  });

  it('accepts masculine and feminine agreement for être verbs in the passé composé', () => {
    const quiz = verbQuiz(findVerb('aller')!, '2026-01-01', 'A1+', { tense: 'passé composé', person: 3 });
    expect(quiz.answers).toEqual(['sommes allés', 'sommes allées']);
  });
});

describe('expanded conjugation table', () => {
  it('handles the new irregular and spelling-change verbs', () => {
    const c = (verb: string, tense: (typeof TENSES)[number]) => {
      const v = findVerb(verb);
      if (!v) throw new Error(`missing ${verb}`);
      return conjugationTable(v).find((t) => t.tense === tense)!.forms;
    };
    expect(c('boire', 'imparfait')[0]).toBe('je buvais');
    expect(c('boire', 'subjonctif présent')[0]).toBe('que je boive');
    expect(c('commencer', 'imparfait')).toEqual(['je commençais', 'tu commençais', 'il/elle/on commençait', 'nous commencions', 'vous commenciez', 'ils/elles commençaient']);
    expect(c('appeler', 'futur simple')[0]).toBe("j'appellerai");
    expect(c('acheter', 'présent')[0]).toBe("j'achète");
    expect(c('envoyer', 'conditionnel présent')[0]).toBe("j'enverrais");
    expect(c('recevoir', 'subjonctif présent')[3]).toBe('que nous recevions');
    expect(c('naître', 'passé composé')[0]).toBe('je suis né(e)');
    expect(c('habiter', 'présent')[0]).toBe("j'habite");
  });
});

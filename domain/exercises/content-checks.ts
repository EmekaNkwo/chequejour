/**
 * Content rules for typed and matching exercises that a schema can't express, run by
 * the content validator. Each problem is a readable sentence naming the exercise.
 */
import { normalize } from '../answers';
import type { Exercise } from '../content-types';
import { conjugate, findVerb, TENSES, type Tense } from './conjugation-tables';

export const CONJUGATION_TENSES: readonly string[] = [...TENSES, 'futur proche', 'impératif', 'passé composé, negative'];
const PERSON_INDEX: Readonly<Record<string, number>> = { je: 0, tu: 1, il: 2, elle: 2, on: 2, nous: 3, vous: 4, ils: 5, elles: 5 };
const SENTENCE_END = /[.!?…]["»)]?$/;

const duplicates = (items: readonly string[]): string[] => {
  const seen = new Set<string>();
  return items.map(normalize).filter((x) => (seen.has(x) ? true : (seen.add(x), false)));
};

export function exerciseProblems(e: Exercise): string[] {
  const out: string[] = [];
  switch (e.type) {
    case 'conjugation': {
      if (!CONJUGATION_TENSES.includes(e.tense)) out.push(`${e.id}: unknown tense "${e.tense}"`);
      if (PERSON_INDEX[e.person.toLowerCase()] === undefined) out.push(`${e.id}: unknown person "${e.person}"`);
      for (const d of duplicates(e.answers)) out.push(`${e.id}: answer "${d}" is listed twice`);
      // Where the reference tables know the verb, the drill must accept their form.
      const verb = findVerb(e.verb);
      const p = PERSON_INDEX[e.person.toLowerCase()];
      if (verb && p !== undefined && (TENSES as readonly string[]).includes(e.tense)) {
        const form = normalize(conjugate(verb, e.tense as Tense)[p].replace(/\(e\)(s?)$/, '$1'));
        const fem = normalize(conjugate(verb, e.tense as Tense)[p].replace(/\(e\)(s?)$/, 'e$1'));
        if (!e.answers.map(normalize).some((a) => a === form || a === fem)) {
          out.push(`${e.id}: answers ${JSON.stringify(e.answers)} don't include the table form "${form}"`);
        }
      }
      break;
    }
    case 'translate':
      for (const d of duplicates(e.answers)) out.push(`${e.id}: answer "${d}" is listed twice`);
      if (e.answers.some((a) => normalize(a) === normalize(e.source))) out.push(`${e.id}: an answer repeats the source text`);
      break;
    case 'match':
      if (duplicates(e.pairs.map((p) => p.left)).length > 0) out.push(`${e.id}: two left items are the same`);
      if (duplicates(e.pairs.map((p) => p.right)).length > 0) out.push(`${e.id}: two right items are the same, so the match is ambiguous`);
      break;
    case 'dictation': {
      const words = e.text.split(/\s+/).filter(Boolean).length;
      if (!SENTENCE_END.test(e.text.trim())) out.push(`${e.id}: dictation text should end with . ! ? or …`);
      if (words < 3 || words > 25) out.push(`${e.id}: dictation has ${words} words (expected 3–25)`);
      break;
    }
    default:
      break;
  }
  return out;
}

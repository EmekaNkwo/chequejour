/**
 * Conjugation answers are stored without the subject pronoun ("sommes allés"), but
 * learners often type it ("nous sommes allés", "j'ai été"); both are accepted.
 */
import { checkTyped, normalize, type CheckOutcome } from '../answers';
import type { ConjugationExercise } from '../content-types';

/** "je" may be written elided before a vowel or mute h. */
function pronounForms(person: string): string[] {
  const p = normalize(person);
  return p === 'je' ? ['je ', "j'"] : [`${p} `];
}

export function checkConjugation(answer: string, exercise: Pick<ConjugationExercise, 'person' | 'answers'>): CheckOutcome {
  const typed = normalize(answer);
  const prefix = pronounForms(exercise.person).find((f) => typed.startsWith(f));
  const withoutPronoun = prefix ? typed.slice(prefix.length) : typed;
  const bare = checkTyped(withoutPronoun, exercise.answers);
  // An answer that itself starts with the pronoun word is still judged as typed.
  return bare.result === 'wrong' && prefix ? checkTyped(typed, exercise.answers) : bare;
}

/**
 * Verb of the Day: one verb from the conjugation tables per calendar day, with its full
 * table and a quick conjugation check.
 *
 * - Verbs come from the learner's level and below: core verbs such as être stay worth
 *   drilling at every level, while harder verbs wait until the learner gets there.
 * - The pick is computed from the date, so it needs no storage and is the same on every
 *   screen; within a level the verbs go round in a fixed shuffled order, so none repeats
 *   until all have been seen.
 * - The quiz only asks for tenses the learner has met at their level.
 */
import { LEVELS, type ConjugationExercise, type GrammarTag, type Level } from './content-types';
import { dayNumber, type DayKey } from './dates';
import { conjugate, PERSONS, TENSES, VERBS, withPronoun, type Tense, type VerbSpec } from './exercises/conjugation-tables';
import { hashSeed, seededShuffle } from './shuffle';

const ORDER_SEED = 'verbe-du-jour';

/** Level at which each tense is introduced. */
const TENSE_LEVEL: Readonly<Record<Tense, Level>> = {
  présent: 'A1',
  'passé composé': 'A1+',
  imparfait: 'A2',
  'futur simple': 'A2',
  'conditionnel présent': 'A2+',
  'subjonctif présent': 'B1',
};

export const TENSE_TAG: Readonly<Record<Tense, GrammarTag>> = {
  présent: 'present',
  'passé composé': 'passe-compose',
  imparfait: 'imparfait',
  'futur simple': 'futur-simple',
  'conditionnel présent': 'conditionnel',
  'subjonctif présent': 'subjonctif',
};

/** Subject shown in the quiz; a single pronoun so the answer checker can strip it. */
const QUIZ_PERSONS = ['je', 'tu', 'il', 'nous', 'vous', 'ils'] as const;

const atOrBelow = (item: Level, level: Level): boolean => LEVELS.indexOf(item) <= LEVELS.indexOf(level);

export function verbPool(level: Level): VerbSpec[] {
  return VERBS.filter((v) => atOrBelow(v.level, level));
}

export function verbOfDay(day: DayKey, level: Level): VerbSpec {
  const order = seededShuffle(verbPool(level), ORDER_SEED);
  const n = order.length;
  return order[((dayNumber(day) % n) + n) % n];
}

export function quizTenses(level: Level): Tense[] {
  return TENSES.filter((t) => atOrBelow(TENSE_LEVEL[t], level));
}

export interface TenseTable {
  tense: Tense;
  /** Six forms with their subject pronoun, je to ils/elles. */
  forms: string[];
}

export function conjugationTable(verb: VerbSpec): TenseTable[] {
  return TENSES.map((tense) => ({ tense, forms: conjugate(verb, tense).map((form, i) => withPronoun(form, i, tense)) }));
}

/** Masculine then feminine for "allé(e)s"-style forms; a single form otherwise. */
function acceptedForms(form: string): string[] {
  if (!/\(e\)s?$/.test(form)) return [form];
  return [form.replace(/\(e\)(s?)$/, '$1'), form.replace(/\(e\)(s?)$/, 'e$1')];
}

export interface QuizPick {
  tense: Tense;
  /** 0 (je) to 5 (ils). */
  person: number;
}

/** "Type the form" exercise for one verb, tense and person. */
export function conjugationExercise(verb: VerbSpec, { tense, person }: QuizPick, id: string): ConjugationExercise {
  const form = conjugate(verb, tense)[person];
  return {
    id,
    type: 'conjugation',
    level: verb.level,
    skill: 'structures',
    grammarTag: TENSE_TAG[tense],
    verb: verb.infinitive,
    tense,
    person: QUIZ_PERSONS[person],
    answers: acceptedForms(form),
    explanation: `${verb.infinitive} (${verb.en}), ${tense}: ${withPronoun(form, person, tense)}`,
  };
}

/** One form to type, picked from the day so it stays the same when the screen reopens. */
export function verbQuiz(verb: VerbSpec, day: DayKey, level: Level, pick?: QuizPick): ConjugationExercise {
  const tenses = quizTenses(level);
  const seed = hashSeed(`${day}:${verb.infinitive}`);
  const tense = pick?.tense ?? tenses[seed % tenses.length];
  const person = pick?.person ?? Math.floor(seed / tenses.length) % PERSONS.length;
  return conjugationExercise(verb, { tense, person }, `daily-verb-${verb.infinitive}-${day}`);
}

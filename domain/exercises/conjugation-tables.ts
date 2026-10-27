/**
 * Conjugation reference for the verbs a TCF learner meets most. Only the irregular
 * parts are written out; the rest follows the standard rules:
 * - imparfait: "nous" présent stem + -ais… (except être);
 * - futur simple and conditionnel: one stem + their endings;
 * - subjonctif: "ils" présent stem + -e…, with "nous"/"vous" as in the imparfait,
 *   unless the verb lists its own forms.
 */

export const PERSONS = ['je', 'tu', 'il/elle/on', 'nous', 'vous', 'ils/elles'] as const;
export const TENSES = ['présent', 'passé composé', 'imparfait', 'futur simple', 'conditionnel présent', 'subjonctif présent'] as const;
export type Tense = (typeof TENSES)[number];
type Six = readonly [string, string, string, string, string, string];

export interface VerbSpec {
  infinitive: string;
  en: string;
  present: Six;
  aux: 'avoir' | 'être';
  participle: string;
  futureStem: string;
  /** Only for verbs whose imparfait stem is not the "nous" présent stem. */
  imperfectStem?: string;
  /** Only for verbs whose subjonctif doesn't follow the rule. */
  subjunctive?: Six;
}

export const VERBS: readonly VerbSpec[] = [
  { infinitive: 'être', en: 'to be', present: ['suis', 'es', 'est', 'sommes', 'êtes', 'sont'], aux: 'avoir', participle: 'été', futureStem: 'ser', imperfectStem: 'ét', subjunctive: ['sois', 'sois', 'soit', 'soyons', 'soyez', 'soient'] },
  { infinitive: 'avoir', en: 'to have', present: ['ai', 'as', 'a', 'avons', 'avez', 'ont'], aux: 'avoir', participle: 'eu', futureStem: 'aur', subjunctive: ['aie', 'aies', 'ait', 'ayons', 'ayez', 'aient'] },
  { infinitive: 'aller', en: 'to go', present: ['vais', 'vas', 'va', 'allons', 'allez', 'vont'], aux: 'être', participle: 'allé', futureStem: 'ir', subjunctive: ['aille', 'ailles', 'aille', 'allions', 'alliez', 'aillent'] },
  { infinitive: 'faire', en: 'to do, to make', present: ['fais', 'fais', 'fait', 'faisons', 'faites', 'font'], aux: 'avoir', participle: 'fait', futureStem: 'fer', subjunctive: ['fasse', 'fasses', 'fasse', 'fassions', 'fassiez', 'fassent'] },
  { infinitive: 'venir', en: 'to come', present: ['viens', 'viens', 'vient', 'venons', 'venez', 'viennent'], aux: 'être', participle: 'venu', futureStem: 'viendr' },
  { infinitive: 'prendre', en: 'to take', present: ['prends', 'prends', 'prend', 'prenons', 'prenez', 'prennent'], aux: 'avoir', participle: 'pris', futureStem: 'prendr' },
  { infinitive: 'pouvoir', en: 'can, to be able to', present: ['peux', 'peux', 'peut', 'pouvons', 'pouvez', 'peuvent'], aux: 'avoir', participle: 'pu', futureStem: 'pourr', subjunctive: ['puisse', 'puisses', 'puisse', 'puissions', 'puissiez', 'puissent'] },
  { infinitive: 'vouloir', en: 'to want', present: ['veux', 'veux', 'veut', 'voulons', 'voulez', 'veulent'], aux: 'avoir', participle: 'voulu', futureStem: 'voudr', subjunctive: ['veuille', 'veuilles', 'veuille', 'voulions', 'vouliez', 'veuillent'] },
  { infinitive: 'devoir', en: 'must, to have to', present: ['dois', 'dois', 'doit', 'devons', 'devez', 'doivent'], aux: 'avoir', participle: 'dû', futureStem: 'devr' },
  { infinitive: 'savoir', en: 'to know (a fact)', present: ['sais', 'sais', 'sait', 'savons', 'savez', 'savent'], aux: 'avoir', participle: 'su', futureStem: 'saur', subjunctive: ['sache', 'saches', 'sache', 'sachions', 'sachiez', 'sachent'] },
  { infinitive: 'dire', en: 'to say', present: ['dis', 'dis', 'dit', 'disons', 'dites', 'disent'], aux: 'avoir', participle: 'dit', futureStem: 'dir' },
  { infinitive: 'voir', en: 'to see', present: ['vois', 'vois', 'voit', 'voyons', 'voyez', 'voient'], aux: 'avoir', participle: 'vu', futureStem: 'verr' },
  { infinitive: 'mettre', en: 'to put', present: ['mets', 'mets', 'met', 'mettons', 'mettez', 'mettent'], aux: 'avoir', participle: 'mis', futureStem: 'mettr' },
  { infinitive: 'partir', en: 'to leave', present: ['pars', 'pars', 'part', 'partons', 'partez', 'partent'], aux: 'être', participle: 'parti', futureStem: 'partir' },
  { infinitive: 'parler', en: 'to speak', present: ['parle', 'parles', 'parle', 'parlons', 'parlez', 'parlent'], aux: 'avoir', participle: 'parlé', futureStem: 'parler' },
  { infinitive: 'aimer', en: 'to like, to love', present: ['aime', 'aimes', 'aime', 'aimons', 'aimez', 'aiment'], aux: 'avoir', participle: 'aimé', futureStem: 'aimer' },
  { infinitive: 'manger', en: 'to eat', present: ['mange', 'manges', 'mange', 'mangeons', 'mangez', 'mangent'], aux: 'avoir', participle: 'mangé', futureStem: 'manger' },
  { infinitive: 'finir', en: 'to finish', present: ['finis', 'finis', 'finit', 'finissons', 'finissez', 'finissent'], aux: 'avoir', participle: 'fini', futureStem: 'finir' },
  { infinitive: 'attendre', en: 'to wait', present: ['attends', 'attends', 'attend', 'attendons', 'attendez', 'attendent'], aux: 'avoir', participle: 'attendu', futureStem: 'attendr' },
];

const IMPERFECT_ENDINGS: Six = ['ais', 'ais', 'ait', 'ions', 'iez', 'aient'];
const FUTURE_ENDINGS: Six = ['ai', 'as', 'a', 'ons', 'ez', 'ont'];
const SUBJUNCTIVE_ENDINGS: Six = ['e', 'es', 'e', 'ions', 'iez', 'ent'];

/** "mangeons" keeps its e only before a or o: mangeais, but mangions. */
function joinStem(stem: string, ending: string): string {
  if (stem.endsWith('ge') && ending.startsWith('i')) return stem.slice(0, -1) + ending;
  if (stem.endsWith('ç') && ending.startsWith('i')) return `${stem.slice(0, -1)}c${ending}`;
  return stem + ending;
}

const six = (f: (i: number) => string): Six => [f(0), f(1), f(2), f(3), f(4), f(5)];

function imperfect(v: VerbSpec): Six {
  const stem = v.imperfectStem ?? v.present[3].replace(/ons$/, '');
  return six((i) => joinStem(stem, IMPERFECT_ENDINGS[i]));
}

/** Verb forms without pronouns, for one tense. */
export function conjugate(v: VerbSpec, tense: Tense): Six {
  switch (tense) {
    case 'présent':
      return v.present;
    case 'passé composé': {
      const aux = v.aux === 'avoir' ? VERBS[1].present : VERBS[0].present;
      return six((i) => `${aux[i]} ${v.participle}${v.aux === 'être' ? (i < 3 ? '(e)' : '(e)s') : ''}`);
    }
    case 'imparfait':
      return imperfect(v);
    case 'futur simple':
      return six((i) => v.futureStem + FUTURE_ENDINGS[i]);
    case 'conditionnel présent':
      return six((i) => v.futureStem + IMPERFECT_ENDINGS[i]);
    case 'subjonctif présent': {
      if (v.subjunctive) return v.subjunctive;
      const stem = v.present[5].replace(/ent$/, '');
      const imp = imperfect(v);
      return six((i) => (i === 3 || i === 4 ? imp[i] : stem + SUBJUNCTIVE_ENDINGS[i]));
    }
  }
}

/** "je" becomes "j'" before a vowel or h; the subjonctif adds "que"/"qu'". */
export function withPronoun(form: string, personIndex: number, tense: Tense): string {
  const person = PERSONS[personIndex];
  const elide = personIndex === 0 && /^[aeiouhâàéèêîïôûœ]/i.test(form);
  const subject = elide ? `j'${form}` : `${person} ${form}`;
  if (tense !== 'subjonctif présent') return subject;
  return /^[aeiouâàéèêîïôû]/i.test(subject) ? `qu'${subject}` : `que ${subject}`;
}

export function findVerb(infinitive: string): VerbSpec | undefined {
  return VERBS.find((v) => v.infinitive === infinitive.trim().toLowerCase());
}

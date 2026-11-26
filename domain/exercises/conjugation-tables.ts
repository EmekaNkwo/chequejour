/**
 * Conjugation reference for the verbs a TCF learner meets most. Only the irregular
 * parts are written out; the rest follows the standard rules:
 * - imparfait: "nous" présent stem + -ais… (except être);
 * - futur simple and conditionnel: one stem + their endings;
 * - subjonctif: "ils" présent stem + -e…, with "nous"/"vous" as in the imparfait,
 *   unless the verb lists its own forms.
 */

import type { Level } from '../content-types';

export const PERSONS = ['je', 'tu', 'il/elle/on', 'nous', 'vous', 'ils/elles'] as const;
export const TENSES = ['présent', 'passé composé', 'imparfait', 'futur simple', 'conditionnel présent', 'subjonctif présent'] as const;
export type Tense = (typeof TENSES)[number];
type Six = readonly [string, string, string, string, string, string];

export interface VerbSpec {
  infinitive: string;
  /** Level at which a learner usually meets the verb. */
  level: Level;
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
  { infinitive: 'être', level: 'A1', en: 'to be', present: ['suis', 'es', 'est', 'sommes', 'êtes', 'sont'], aux: 'avoir', participle: 'été', futureStem: 'ser', imperfectStem: 'ét', subjunctive: ['sois', 'sois', 'soit', 'soyons', 'soyez', 'soient'] },
  { infinitive: 'avoir', level: 'A1', en: 'to have', present: ['ai', 'as', 'a', 'avons', 'avez', 'ont'], aux: 'avoir', participle: 'eu', futureStem: 'aur', subjunctive: ['aie', 'aies', 'ait', 'ayons', 'ayez', 'aient'] },
  { infinitive: 'aller', level: 'A1', en: 'to go', present: ['vais', 'vas', 'va', 'allons', 'allez', 'vont'], aux: 'être', participle: 'allé', futureStem: 'ir', subjunctive: ['aille', 'ailles', 'aille', 'allions', 'alliez', 'aillent'] },
  { infinitive: 'faire', level: 'A1', en: 'to do, to make', present: ['fais', 'fais', 'fait', 'faisons', 'faites', 'font'], aux: 'avoir', participle: 'fait', futureStem: 'fer', subjunctive: ['fasse', 'fasses', 'fasse', 'fassions', 'fassiez', 'fassent'] },
  { infinitive: 'venir', level: 'A1', en: 'to come', present: ['viens', 'viens', 'vient', 'venons', 'venez', 'viennent'], aux: 'être', participle: 'venu', futureStem: 'viendr' },
  { infinitive: 'prendre', level: 'A1', en: 'to take', present: ['prends', 'prends', 'prend', 'prenons', 'prenez', 'prennent'], aux: 'avoir', participle: 'pris', futureStem: 'prendr' },
  { infinitive: 'pouvoir', level: 'A1', en: 'can, to be able to', present: ['peux', 'peux', 'peut', 'pouvons', 'pouvez', 'peuvent'], aux: 'avoir', participle: 'pu', futureStem: 'pourr', subjunctive: ['puisse', 'puisses', 'puisse', 'puissions', 'puissiez', 'puissent'] },
  { infinitive: 'vouloir', level: 'A1', en: 'to want', present: ['veux', 'veux', 'veut', 'voulons', 'voulez', 'veulent'], aux: 'avoir', participle: 'voulu', futureStem: 'voudr', subjunctive: ['veuille', 'veuilles', 'veuille', 'voulions', 'vouliez', 'veuillent'] },
  { infinitive: 'devoir', level: 'A1+', en: 'must, to have to', present: ['dois', 'dois', 'doit', 'devons', 'devez', 'doivent'], aux: 'avoir', participle: 'dû', futureStem: 'devr' },
  { infinitive: 'savoir', level: 'A1+', en: 'to know (a fact)', present: ['sais', 'sais', 'sait', 'savons', 'savez', 'savent'], aux: 'avoir', participle: 'su', futureStem: 'saur', subjunctive: ['sache', 'saches', 'sache', 'sachions', 'sachiez', 'sachent'] },
  { infinitive: 'dire', level: 'A1+', en: 'to say', present: ['dis', 'dis', 'dit', 'disons', 'dites', 'disent'], aux: 'avoir', participle: 'dit', futureStem: 'dir' },
  { infinitive: 'voir', level: 'A1+', en: 'to see', present: ['vois', 'vois', 'voit', 'voyons', 'voyez', 'voient'], aux: 'avoir', participle: 'vu', futureStem: 'verr' },
  { infinitive: 'mettre', level: 'A1+', en: 'to put', present: ['mets', 'mets', 'met', 'mettons', 'mettez', 'mettent'], aux: 'avoir', participle: 'mis', futureStem: 'mettr' },
  { infinitive: 'partir', level: 'A1+', en: 'to leave', present: ['pars', 'pars', 'part', 'partons', 'partez', 'partent'], aux: 'être', participle: 'parti', futureStem: 'partir' },
  { infinitive: 'parler', level: 'A1', en: 'to speak', present: ['parle', 'parles', 'parle', 'parlons', 'parlez', 'parlent'], aux: 'avoir', participle: 'parlé', futureStem: 'parler' },
  { infinitive: 'aimer', level: 'A1', en: 'to like, to love', present: ['aime', 'aimes', 'aime', 'aimons', 'aimez', 'aiment'], aux: 'avoir', participle: 'aimé', futureStem: 'aimer' },
  { infinitive: 'manger', level: 'A1', en: 'to eat', present: ['mange', 'manges', 'mange', 'mangeons', 'mangez', 'mangent'], aux: 'avoir', participle: 'mangé', futureStem: 'manger' },
  { infinitive: 'finir', level: 'A1+', en: 'to finish', present: ['finis', 'finis', 'finit', 'finissons', 'finissez', 'finissent'], aux: 'avoir', participle: 'fini', futureStem: 'finir' },
  { infinitive: 'attendre', level: 'A1+', en: 'to wait', present: ['attends', 'attends', 'attend', 'attendons', 'attendez', 'attendent'], aux: 'avoir', participle: 'attendu', futureStem: 'attendr' },
  { infinitive: 'habiter', level: 'A1', en: 'to live (somewhere)', present: ['habite', 'habites', 'habite', 'habitons', 'habitez', 'habitent'], aux: 'avoir', participle: 'habité', futureStem: 'habiter' },
  { infinitive: 'regarder', level: 'A1', en: 'to watch, to look at', present: ['regarde', 'regardes', 'regarde', 'regardons', 'regardez', 'regardent'], aux: 'avoir', participle: 'regardé', futureStem: 'regarder' },
  { infinitive: 'écouter', level: 'A1', en: 'to listen', present: ['écoute', 'écoutes', 'écoute', 'écoutons', 'écoutez', 'écoutent'], aux: 'avoir', participle: 'écouté', futureStem: 'écouter' },
  { infinitive: 'travailler', level: 'A1', en: 'to work', present: ['travaille', 'travailles', 'travaille', 'travaillons', 'travaillez', 'travaillent'], aux: 'avoir', participle: 'travaillé', futureStem: 'travailler' },
  { infinitive: 'donner', level: 'A1', en: 'to give', present: ['donne', 'donnes', 'donne', 'donnons', 'donnez', 'donnent'], aux: 'avoir', participle: 'donné', futureStem: 'donner' },
  { infinitive: 'trouver', level: 'A1+', en: 'to find', present: ['trouve', 'trouves', 'trouve', 'trouvons', 'trouvez', 'trouvent'], aux: 'avoir', participle: 'trouvé', futureStem: 'trouver' },
  { infinitive: 'penser', level: 'A1+', en: 'to think', present: ['pense', 'penses', 'pense', 'pensons', 'pensez', 'pensent'], aux: 'avoir', participle: 'pensé', futureStem: 'penser' },
  { infinitive: 'demander', level: 'A1+', en: 'to ask', present: ['demande', 'demandes', 'demande', 'demandons', 'demandez', 'demandent'], aux: 'avoir', participle: 'demandé', futureStem: 'demander' },
  { infinitive: 'acheter', level: 'A1+', en: 'to buy', present: ['achète', 'achètes', 'achète', 'achetons', 'achetez', 'achètent'], aux: 'avoir', participle: 'acheté', futureStem: 'achèter' },
  { infinitive: 'commencer', level: 'A1+', en: 'to begin', present: ['commence', 'commences', 'commence', 'commençons', 'commencez', 'commencent'], aux: 'avoir', participle: 'commencé', futureStem: 'commencer' },
  { infinitive: 'sortir', level: 'A1+', en: 'to go out', present: ['sors', 'sors', 'sort', 'sortons', 'sortez', 'sortent'], aux: 'être', participle: 'sorti', futureStem: 'sortir' },
  { infinitive: 'dormir', level: 'A1+', en: 'to sleep', present: ['dors', 'dors', 'dort', 'dormons', 'dormez', 'dorment'], aux: 'avoir', participle: 'dormi', futureStem: 'dormir' },
  { infinitive: 'boire', level: 'A1+', en: 'to drink', present: ['bois', 'bois', 'boit', 'buvons', 'buvez', 'boivent'], aux: 'avoir', participle: 'bu', futureStem: 'boir' },
  { infinitive: 'comprendre', level: 'A1+', en: 'to understand', present: ['comprends', 'comprends', 'comprend', 'comprenons', 'comprenez', 'comprennent'], aux: 'avoir', participle: 'compris', futureStem: 'comprendr' },
  { infinitive: 'apprendre', level: 'A1+', en: 'to learn', present: ['apprends', 'apprends', 'apprend', 'apprenons', 'apprenez', 'apprennent'], aux: 'avoir', participle: 'appris', futureStem: 'apprendr' },
  { infinitive: 'choisir', level: 'A1+', en: 'to choose', present: ['choisis', 'choisis', 'choisit', 'choisissons', 'choisissez', 'choisissent'], aux: 'avoir', participle: 'choisi', futureStem: 'choisir' },
  { infinitive: 'arriver', level: 'A2', en: 'to arrive', present: ['arrive', 'arrives', 'arrive', 'arrivons', 'arrivez', 'arrivent'], aux: 'être', participle: 'arrivé', futureStem: 'arriver' },
  { infinitive: 'rester', level: 'A2', en: 'to stay', present: ['reste', 'restes', 'reste', 'restons', 'restez', 'restent'], aux: 'être', participle: 'resté', futureStem: 'rester' },
  { infinitive: 'lire', level: 'A2', en: 'to read', present: ['lis', 'lis', 'lit', 'lisons', 'lisez', 'lisent'], aux: 'avoir', participle: 'lu', futureStem: 'lir' },
  { infinitive: 'écrire', level: 'A2', en: 'to write', present: ['écris', 'écris', 'écrit', 'écrivons', 'écrivez', 'écrivent'], aux: 'avoir', participle: 'écrit', futureStem: 'écrir' },
  { infinitive: 'connaître', level: 'A2', en: 'to know (a person, a place)', present: ['connais', 'connais', 'connaît', 'connaissons', 'connaissez', 'connaissent'], aux: 'avoir', participle: 'connu', futureStem: 'connaîtr' },
  { infinitive: 'croire', level: 'A2', en: 'to believe', present: ['crois', 'crois', 'croit', 'croyons', 'croyez', 'croient'], aux: 'avoir', participle: 'cru', futureStem: 'croir' },
  { infinitive: 'appeler', level: 'A2', en: 'to call', present: ['appelle', 'appelles', 'appelle', 'appelons', 'appelez', 'appellent'], aux: 'avoir', participle: 'appelé', futureStem: 'appeller' },
  { infinitive: 'payer', level: 'A2', en: 'to pay', present: ['paie', 'paies', 'paie', 'payons', 'payez', 'paient'], aux: 'avoir', participle: 'payé', futureStem: 'paier' },
  { infinitive: 'envoyer', level: 'A2', en: 'to send', present: ['envoie', 'envoies', 'envoie', 'envoyons', 'envoyez', 'envoient'], aux: 'avoir', participle: 'envoyé', futureStem: 'enverr' },
  { infinitive: 'ouvrir', level: 'A2', en: 'to open', present: ['ouvre', 'ouvres', 'ouvre', 'ouvrons', 'ouvrez', 'ouvrent'], aux: 'avoir', participle: 'ouvert', futureStem: 'ouvrir' },
  { infinitive: 'répondre', level: 'A2', en: 'to answer', present: ['réponds', 'réponds', 'répond', 'répondons', 'répondez', 'répondent'], aux: 'avoir', participle: 'répondu', futureStem: 'répondr' },
  { infinitive: 'vendre', level: 'A2', en: 'to sell', present: ['vends', 'vends', 'vend', 'vendons', 'vendez', 'vendent'], aux: 'avoir', participle: 'vendu', futureStem: 'vendr' },
  { infinitive: 'perdre', level: 'A2', en: 'to lose', present: ['perds', 'perds', 'perd', 'perdons', 'perdez', 'perdent'], aux: 'avoir', participle: 'perdu', futureStem: 'perdr' },
  { infinitive: 'devenir', level: 'A2', en: 'to become', present: ['deviens', 'deviens', 'devient', 'devenons', 'devenez', 'deviennent'], aux: 'être', participle: 'devenu', futureStem: 'deviendr' },
  { infinitive: 'vivre', level: 'A2', en: 'to live', present: ['vis', 'vis', 'vit', 'vivons', 'vivez', 'vivent'], aux: 'avoir', participle: 'vécu', futureStem: 'vivr' },
  { infinitive: 'tenir', level: 'A2+', en: 'to hold', present: ['tiens', 'tiens', 'tient', 'tenons', 'tenez', 'tiennent'], aux: 'avoir', participle: 'tenu', futureStem: 'tiendr' },
  { infinitive: 'recevoir', level: 'A2+', en: 'to receive', present: ['reçois', 'reçois', 'reçoit', 'recevons', 'recevez', 'reçoivent'], aux: 'avoir', participle: 'reçu', futureStem: 'recevr' },
  { infinitive: 'offrir', level: 'A2+', en: 'to offer, to give (a gift)', present: ['offre', 'offres', 'offre', 'offrons', 'offrez', 'offrent'], aux: 'avoir', participle: 'offert', futureStem: 'offrir' },
  { infinitive: 'conduire', level: 'A2+', en: 'to drive', present: ['conduis', 'conduis', 'conduit', 'conduisons', 'conduisez', 'conduisent'], aux: 'avoir', participle: 'conduit', futureStem: 'conduir' },
  { infinitive: 'suivre', level: 'A2+', en: 'to follow', present: ['suis', 'suis', 'suit', 'suivons', 'suivez', 'suivent'], aux: 'avoir', participle: 'suivi', futureStem: 'suivr' },
  { infinitive: 'courir', level: 'A2+', en: 'to run', present: ['cours', 'cours', 'court', 'courons', 'courez', 'courent'], aux: 'avoir', participle: 'couru', futureStem: 'courr' },
  { infinitive: 'craindre', level: 'B1', en: 'to fear', present: ['crains', 'crains', 'craint', 'craignons', 'craignez', 'craignent'], aux: 'avoir', participle: 'craint', futureStem: 'craindr' },
  { infinitive: 'atteindre', level: 'B1', en: 'to reach', present: ['atteins', 'atteins', 'atteint', 'atteignons', 'atteignez', 'atteignent'], aux: 'avoir', participle: 'atteint', futureStem: 'atteindr' },
  { infinitive: 'mourir', level: 'B1', en: 'to die', present: ['meurs', 'meurs', 'meurt', 'mourons', 'mourez', 'meurent'], aux: 'être', participle: 'mort', futureStem: 'mourr' },
  { infinitive: 'naître', level: 'A2', en: 'to be born', present: ['nais', 'nais', 'naît', 'naissons', 'naissez', 'naissent'], aux: 'être', participle: 'né', futureStem: 'naîtr' },
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

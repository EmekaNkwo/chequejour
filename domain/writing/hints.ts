/**
 * Offline, rule-based hints on a learner's text, shown after they hand it in. They are
 * heuristics, not grading: every tip says "Possible…" because a rule can be wrong
 * (a proper name, an unusual construction, a word the lists don't know).
 */
import { stripAccents } from '../answers';
import type { WritingTask } from '../content-types';

export type HintKind = 'accent' | 'elision' | 'agreement' | 'connectors' | 'tenses' | 'repetition' | 'greeting' | 'signoff';

export interface WritingHint {
  kind: HintKind;
  /** "tip" suggests a change; "ok" confirms something the text already does. */
  tone: 'tip' | 'ok';
  message: string;
}

export interface HintContext {
  taskType: WritingTask['taskType'];
  /** Noun → gender, from the course vocabulary. */
  nounGenders: ReadonlyMap<string, 'm' | 'f'>;
}

const WORD = /[\p{L}'’-]+/gu;

function words(text: string): string[] {
  return (text.match(WORD) ?? []).map((w) => w.replace(/’/g, "'"));
}

const matchCase = (original: string, fix: string): string =>
  original[0] && original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase() ? fix[0].toUpperCase() + fix.slice(1) : fix;

// ── Accents ───────────────────────────────────────────────────────────────

/**
 * Common words whose unaccented spelling is not itself a French word, so a match is
 * almost always a missing accent. Ambiguous pairs (a/à, ou/où, la/là, des/dès, sur/sûr)
 * are left out on purpose.
 */
const ACCENTED = [
  'très', 'était', 'étais', 'étaient', 'été', 'déjà', 'après', 'voilà', 'problème', 'problèmes', 'première', 'premières',
  'dernière', 'dernières', 'fête', 'fêtes', 'même', 'mêmes', 'bientôt', 'être', 'école', 'écoles', 'élève', 'élèves',
  'intéressant', 'intéressante', 'intéressants', 'frère', 'frères', 'mère', 'père', 'deuxième', 'troisième', 'étage',
  'gâteau', 'gâteaux', 'français', 'française', 'françaises', 'ça', 'noël', 'hôpital', 'théâtre', 'café', 'cafés',
  'téléphone', 'numéro', 'période', 'expérience', 'société', 'réussi', 'préféré', 'préfère', 'désolé', 'désolée',
  'étudiant', 'étudiante', 'étudiants', 'études', 'équipe', 'événement', 'événements', 'tôt', 'plutôt', 'dîner',
  'année', 'années', 'journée', 'journées', 'soirée', 'soirées', 'idée', 'idées', 'vélo', 'réponse', 'fenêtre', 'forêt',
  'tête', 'prêt', 'prête', 'agréable', 'différent', 'différente', 'différents', 'général', 'généralement', 'réveil',
  'préparer', 'écouter', 'écrire', 'économie', 'électrique', 'énergie', 'répondre', 'réfléchir', 'réunion', 'résultat',
  'sécurité', 'qualité', 'activité', 'activités', 'université', 'liberté', 'santé', 'séjour', 'métro', 'église',
  'étranger', 'étrangère', 'évidemment', 'à côté', 'collègue', 'collègues', 'entrée', 'arrivée', 'médecin', 'éviter',
  'déménager', 'déménagé', 'invité', 'invités', 'été',
];
const ACCENT_FIXES: ReadonlyMap<string, string> = new Map(
  ACCENTED.filter((w) => !w.includes(' ')).map((w) => [stripAccents(w), w] as const),
);

export function missingAccents(text: string): { word: string; fix: string }[] {
  const seen = new Set<string>();
  const out: { word: string; fix: string }[] = [];
  for (const w of words(text)) {
    const key = w.toLowerCase();
    const fix = ACCENT_FIXES.get(key);
    if (!fix || fix === key || seen.has(key)) continue;
    seen.add(key);
    out.push({ word: w, fix: matchCase(w, fix) });
  }
  return out;
}

// ── Elision ───────────────────────────────────────────────────────────────

/** Short words that lose their vowel before a vowel or a silent h: je ai → j'ai. */
const ELIDING: Readonly<Record<string, string>> = { je: "j'", me: "m'", te: "t'", se: "s'", le: "l'", la: "l'", de: "d'", ne: "n'", que: "qu'" };
/** Words starting with an aspirated h (no elision: le héros) and numbers (le onze). */
const NO_ELISION = new Set([
  'haine', 'hall', 'hamburger', 'hanche', 'handicap', 'hareng', 'haricot', 'haricots', 'harpe', 'hasard', 'hâte', 'haut', 'haute',
  'hauteur', 'héros', 'hibou', 'hockey', 'hollande', 'homard', 'honte', 'hors', 'housse', 'huit', 'huitième', 'hurler', 'onze', 'onzième',
]);
const VOWEL_START = /^[aeiouhàâäéèêëîïôöùûü]/;
const WORD_AT = /[\p{L}'’-]+/gu;

/** Pairs like "je ai" that need elision ("j'ai"), in text order. Words split by punctuation are not paired. */
export function elisionSlips(text: string): { phrase: string; fix: string }[] {
  const tokens = [...text.matchAll(WORD_AT)].map((m) => ({ word: m[0], start: m.index ?? 0 }));
  const out: { phrase: string; fix: string }[] = [];
  for (let i = 0; i + 1 < tokens.length; i += 1) {
    const { word, start } = tokens[i];
    const next = tokens[i + 1];
    if (!/^\s+$/.test(text.slice(start + word.length, next.start))) continue;
    const short = word.toLowerCase();
    const following = next.word.toLowerCase();
    const elided =
      short === 'si' && (following === 'il' || following === 'ils')
        ? "s'"
        : ELIDING[short] && (following === 'y' ? ['je', 'ne', 'me', 'te', 'se'].includes(short) : VOWEL_START.test(following) && !NO_ELISION.has(following))
          ? ELIDING[short]
          : null;
    if (elided) out.push({ phrase: `${word} ${next.word}`, fix: `${matchCase(word, elided)}${next.word}` });
  }
  return out;
}

// ── Agreement ─────────────────────────────────────────────────────────────

/**
 * Single-word nouns with their gender. A noun listed with both genders (le livre /
 * la livre, le poste / la poste) is left out, since either article can be right.
 */
export function nounGenderMap(nouns: readonly { fr: string; gender?: string }[]): Map<string, 'm' | 'f'> {
  const seen = new Map<string, 'm' | 'f' | 'both'>();
  for (const n of nouns) {
    if ((n.gender !== 'm' && n.gender !== 'f') || /\s/.test(n.fr)) continue;
    const key = n.fr.toLowerCase();
    const before = seen.get(key);
    seen.set(key, before && before !== n.gender ? 'both' : n.gender);
  }
  return new Map([...seen].filter((e): e is [string, 'm' | 'f'] => e[1] !== 'both'));
}

const FEMININE_DETERMINERS: Readonly<Record<string, string>> = { la: 'le', une: 'un', cette: 'ce' };
const MASCULINE_DETERMINERS: Readonly<Record<string, string>> = { le: 'la', un: 'une', ce: 'cette' };
/** After these, le/la are object pronouns (il la porte), not articles. */
const PRONOUN_CONTEXT = new Set(['je', "j'", 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'ne', "n'", 'me', 'te', 'se']);

/** Determiner + noun pairs whose genders clash, e.g. "la problème" → "le problème". */
export function agreementSlips(text: string, genders: ReadonlyMap<string, 'm' | 'f'>): { phrase: string; fix: string }[] {
  const tokens = words(text);
  const out: { phrase: string; fix: string }[] = [];
  for (let i = 0; i + 1 < tokens.length; i += 1) {
    const det = tokens[i].toLowerCase();
    const noun = tokens[i + 1];
    const gender = genders.get(noun.toLowerCase());
    if (!gender) continue;
    const before = i > 0 ? tokens[i - 1].toLowerCase() : '';
    if ((det === 'le' || det === 'la') && PRONOUN_CONTEXT.has(before)) continue;
    // "cette" before a vowel is "cet" in the masculine.
    const swap = gender === 'm' ? FEMININE_DETERMINERS[det] : MASCULINE_DETERMINERS[det];
    if (!swap) continue;
    const fixedDet = swap === 'ce' && /^[aeiouhâàéèêîôû]/i.test(noun) ? 'cet' : swap === 'le' && /^[aeiouhâàéèêîôû]/i.test(noun) ? "l'" : swap;
    out.push({ phrase: `${tokens[i]} ${noun}`, fix: fixedDet === "l'" ? `${matchCase(tokens[i], "l'")}${noun}` : `${matchCase(tokens[i], fixedDet)} ${noun}` });
  }
  return out;
}

// ── Connectors ────────────────────────────────────────────────────────────

export const CONNECTORS = [
  "d'abord", 'ensuite', 'puis', 'enfin', 'finalement', 'cependant', 'pourtant', 'mais', 'donc', 'alors', 'alors que',
  'par contre', 'en revanche', 'de plus', 'en effet', 'car', 'parce que', 'puisque', 'par exemple', 'en conclusion',
  "d'une part", "d'autre part", 'bien que', 'même si', 'ainsi', 'pour conclure', 'premièrement', 'deuxièmement', 'grâce à',
];
/** Linking words worth aiming for in each task type. */
const CONNECTOR_TARGET: Readonly<Record<WritingTask['taskType'], number>> = { message: 1, description: 2, opinion: 3 };

/** Connectors in the order they first appear. "Alors que" is not also counted as "alors". */
export function connectorsUsed(text: string): string[] {
  let normalized = ` ${text.toLowerCase().replace(/’/g, "'").replace(/[^\p{L}' -]+/gu, ' ').replace(/\s+/g, ' ')} `;
  const found: { c: string; at: number }[] = [];
  // Longest first, so multi-word connectors are removed before their single words are searched.
  for (const c of [...CONNECTORS].sort((a, b) => b.length - a.length)) {
    const needle = ` ${c} `;
    const at = normalized.indexOf(needle);
    if (at < 0) continue;
    found.push({ c, at });
    normalized = normalized.split(needle).join(` ${'_'.repeat(c.length)} `);
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.c);
}

// ── Tenses ────────────────────────────────────────────────────────────────

export type SpottedTense = 'passé composé' | 'imparfait' | 'futur' | 'conditionnel';
const TENSE_ORDER: readonly SpottedTense[] = ['passé composé', 'imparfait', 'futur', 'conditionnel'];

const AUXILIARIES = new Set(['ai', 'as', 'a', 'avons', 'avez', 'ont', 'suis', 'es', 'est', 'sommes', 'êtes', 'sont']);
const PARTICIPLE = /^(?:\p{L}+(?:é|ée|és|ées|i|ie|is|ies|u|ue|us|ues)|fait|faite|pris|mis|dit|écrit|été|eu|vu|venu|ouvert|offert|né|mort)$/u;
const NOT_A_PARTICIPLE = new Set(['ici', 'aussi', 'parmi', 'midi', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'joli', 'jolie', 'un', 'une', 'plus', 'tout', 'tu', 'si']);
const NOT_IMPARFAIT = new Set(['mais', 'jamais', 'français', 'anglais', 'frais', 'palais', 'désormais', 'souhait', 'lait', 'fait', 'plaît', 'plait', 'vrais', 'mauvais', 'épais', 'portugais', 'japonais', 'irlandais', 'néerlandais', 'marais', 'relais', 'biais', 'essais', 'balais', 'trait', 'portrait', 'extrait', 'attrait', 'parfait', 'satisfait', 'bienfait', 'avions']);
const CONDITIONNEL = /(?:e|i|d|r|u|v)r(?:ais|ait|ions|iez|aient)$/u;
const FUTUR = /(?:e|i|d|r|u|v)r(?:ai|as|a|ons|ez|ont)$/u;
const IMPARFAIT = /(?:ais|ait|aient|ions|iez)$/u;

export function tensesUsed(text: string): SpottedTense[] {
  const tokens = words(text).map((w) => w.toLowerCase());
  const spotted = new Set<SpottedTense>();
  tokens.forEach((w, i) => {
    if (AUXILIARIES.has(w)) {
      // The participle may follow a short adverb: "j'ai bien mangé".
      const next = [tokens[i + 1], tokens[i + 2]].find((t) => t && PARTICIPLE.test(t) && !NOT_A_PARTICIPLE.has(t));
      if (next) spotted.add('passé composé');
      return;
    }
    if (w.length < 5) return;
    if (CONDITIONNEL.test(w)) spotted.add('conditionnel');
    else if (FUTUR.test(w)) spotted.add('futur');
    else if (IMPARFAIT.test(w) && !NOT_IMPARFAIT.has(w) && !/[st]ions$/.test(w)) spotted.add('imparfait');
  });
  return TENSE_ORDER.filter((t) => spotted.has(t));
}

// ── Repetition ────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'avec', 'dans', 'pour', 'mais', 'nous', 'vous', 'elle', 'elles', 'ils', 'leur', 'leurs', 'cette', 'sont', 'était', 'être',
  'avoir', 'aussi', 'plus', 'très', 'tout', 'tous', 'toute', 'toutes', 'comme', 'parce', 'quand', 'alors', 'donc', 'faire',
  'votre', 'notre', 'vos', 'nos', 'mon', 'ton', 'son', 'mes', 'tes', 'ses', 'est-ce', "c'est", "qu'il", "qu'elle", 'chez',
  'entre', 'après', 'avant', 'sans', 'sous', 'vers', 'encore', 'moins', 'bien', 'même', 'autre', 'autres', 'peut', 'ceux',
]);

/** Content words (4+ letters) used three times or more, most frequent first. */
export function repeatedWords(text: string): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const w of words(text)) {
    const key = w.toLowerCase();
    if (key.length < 4 || STOPWORDS.has(key)) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([word, count]) => ({ word, count }));
}

// ── Greeting and sign-off ─────────────────────────────────────────────────

const GREETINGS = ['bonjour', 'bonsoir', 'salut', 'coucou', 'cher', 'chere', 'chers', 'cheres', 'madame', 'monsieur', 'hello', 'allo'];
const SIGN_OFFS = [
  'a bientot', 'a plus', 'bises', 'bisous', 'cordialement', 'amicalement', 'bonne journee', 'bonne soiree', 'a tres vite',
  'a demain', 'a samedi', 'a dimanche', 'a ce soir', "merci d'avance", 'salutations', 'je vous embrasse', "je t'embrasse",
  'bien a vous', 'au revoir', 'a la prochaine', 'gros bisous', 'a tout a l heure', 'bonne fin de semaine', 'au plaisir',
];

const plain = (text: string): string => stripAccents(text.toLowerCase().replace(/[’']/g, "'")).replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim();

export function hasGreeting(text: string): boolean {
  const first = plain(text).split(' ').slice(0, 3);
  return first.some((w) => GREETINGS.includes(w));
}

export function hasSignOff(text: string): boolean {
  const tail = ` ${plain(text).split(' ').slice(-12).join(' ')} `;
  return SIGN_OFFS.some((s) => tail.includes(` ${s} `) || tail.includes(` ${s.replace(/'/g, ' ')} `));
}

// ── All hints for one text ────────────────────────────────────────────────

const list = (items: readonly string[]): string => items.slice(0, 4).join(', ') + (items.length > 4 ? '…' : '');

export function writingHints(text: string, ctx: HintContext): WritingHint[] {
  if (text.trim().length === 0) return [];
  const hints: WritingHint[] = [];

  const accents = missingAccents(text);
  if (accents.length > 0) {
    hints.push({ kind: 'accent', tone: 'tip', message: `Possible missing accents: ${list(accents.map((a) => `${a.word} → ${a.fix}`))}.` });
  }

  const elisions = elisionSlips(text);
  if (elisions.length > 0) {
    hints.push({ kind: 'elision', tone: 'tip', message: `Possible missing elision: ${list(elisions.map((e) => `${e.phrase} → ${e.fix}`))}.` });
  }

  const slips = agreementSlips(text, ctx.nounGenders);
  if (slips.length > 0) {
    hints.push({ kind: 'agreement', tone: 'tip', message: `Possible gender slips: ${list(slips.map((s) => `${s.phrase} → ${s.fix}`))}.` });
  }

  const connectors = connectorsUsed(text);
  const target = CONNECTOR_TARGET[ctx.taskType];
  hints.push(
    connectors.length >= target
      ? { kind: 'connectors', tone: 'ok', message: `Linking words: ${connectors.length} (${list(connectors)}).` }
      : {
          kind: 'connectors',
          tone: 'tip',
          message: `Possible weak linking: ${connectors.length === 0 ? 'no linking words found' : `only ${list(connectors)}`}. Try d'abord, ensuite, cependant, donc, enfin.`,
        },
  );

  if (ctx.taskType !== 'message') {
    const tenses = tensesUsed(text);
    const wanted: readonly SpottedTense[] = ctx.taskType === 'description' ? ['passé composé', 'imparfait'] : ['conditionnel'];
    const missing = wanted.filter((t) => !tenses.includes(t));
    hints.push(
      missing.length === 0
        ? { kind: 'tenses', tone: 'ok', message: `Tenses spotted besides the present: ${list(tenses)}.` }
        : {
            kind: 'tenses',
            tone: 'tip',
            message:
              ctx.taskType === 'description'
                ? `Possible tense gap: if you are telling a story, use the passé composé for events and the imparfait for background. Not spotted: ${missing.join(' and ')}.`
                : 'Possible tense gap: the conditionnel (il faudrait, je préférerais, on pourrait) helps you nuance an opinion.',
          },
    );
  }

  const repeated = repeatedWords(text);
  if (repeated.length > 0) {
    hints.push({ kind: 'repetition', tone: 'tip', message: `Possible repetition: ${list(repeated.map((r) => `${r.word} ×${r.count}`))}. A synonym or pronoun can help.` });
  }

  if (ctx.taskType === 'message') {
    if (!hasGreeting(text)) hints.push({ kind: 'greeting', tone: 'tip', message: 'Possible missing greeting: a message usually opens with Bonjour, Salut or Cher/Chère…' });
    if (!hasSignOff(text)) hints.push({ kind: 'signoff', tone: 'tip', message: 'Possible missing sign-off: end with À bientôt, Bises or Cordialement, then your name.' });
  }
  return hints;
}

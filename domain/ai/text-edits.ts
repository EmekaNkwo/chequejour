/**
 * What a corrected copy of a learner's text changed, and what kind of mistake each change
 * fixes. The language model only rewrites the text; the app finds the changes itself and
 * names them from fixed rules, so a change that fits no rule (a guess, a style rewrite)
 * is never shown with an invented reason.
 */
export type EditKind = 'accent' | 'elision' | 'gender' | 'preposition' | 'auxiliary' | 'agreement' | 'verb-form';

export interface TextEdit {
  /** The learner's own words, copied from their text. */
  original: string;
  corrected: string;
}

interface Token {
  text: string;
  key: string;
  start: number;
  end: number;
}

const WORD = /[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*[’']?/gu;
const key = (s: string): string => s.normalize('NFC').toLowerCase().replace(/’/g, "'");
/** The letters alone: no accents, ligatures spelled out. */
const fold = (s: string): string => key(s).normalize('NFD').replace(/\p{M}/gu, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae');

function tokens(text: string): Token[] {
  return [...text.matchAll(WORD)].map((m) => ({ text: m[0], key: key(m[0]), start: m.index, end: m.index + m[0].length }));
}

/** Pairs of matching token positions (longest common subsequence). */
function anchors(a: readonly Token[], b: readonly Token[]): [number, number][] {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = new Uint16Array(rows * cols);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * cols + j] = a[i].key === b[j].key ? table[(i + 1) * cols + j + 1] + 1 : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i].key === b[j].key) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (table[(i + 1) * cols + j] >= table[i * cols + j + 1]) i += 1;
    else j += 1;
  }
  return pairs;
}

/** A capital the learner couldn't accent (A bientôt → À bientôt) is not worth pointing out. */
const capitalAccent = (o: readonly Token[], c: readonly Token[]): boolean =>
  o.length === 1 && c.length === 1 && o[0].text[0] !== o[0].text[0].toLowerCase() && fold(o[0].text) === fold(c[0].text);

const SHORT_WORD = 3;

/** Each stretch the corrected text changed. Words only the model added or dropped are skipped: they can't be quoted. */
export function textEdits(before: string, after: string): TextEdit[] {
  const a = tokens(before);
  const b = tokens(after);
  const edits: TextEdit[] = [];
  let i = 0;
  let j = 0;
  for (const [ai, bj] of [...anchors(a, b), [a.length, b.length] as [number, number]]) {
    // A lone short word (le, en, des) is hard to find in the text: take the next word along.
    const withNext = ai - i === 1 && a[i].key.length <= SHORT_WORD && ai < a.length;
    const o = a.slice(i, withNext ? ai + 1 : ai);
    const c = b.slice(j, withNext ? bj + 1 : bj);
    if (o.length > 0 && c.length > 0 && !capitalAccent(a.slice(i, ai), b.slice(j, bj))) {
      edits.push({
        original: before.slice(o[0].start, o[o.length - 1].end).replace(/\s+/g, ' '),
        corrected: after.slice(c[0].start, c[c.length - 1].end).replace(/\s+/g, ' '),
      });
    }
    i = ai + 1;
    j = bj + 1;
  }
  return edits;
}

/** Ratio of the learner's words the corrected text changed. */
export function changedShare(before: string, after: string): number {
  const a = tokens(before);
  if (a.length === 0) return 0;
  return 1 - anchors(a, tokens(after)).length / a.length;
}

const ELIDES: Readonly<Record<string, string>> = { le: 'l', la: 'l', je: 'j', de: 'd', ne: 'n', me: 'm', te: 't', se: 's', ce: 'c', que: 'qu' };
const DETERMINER_PAIRS = [['le', 'la'], ['un', 'une'], ['ce', 'cette', 'cet'], ['mon', 'ma'], ['ton', 'ta'], ['son', 'sa'], ['du', 'de la'], ['au', 'à la']];
const PREPOSITIONS = new Set(['à', 'a', 'en', 'au', 'aux', 'dans', 'de', 'des', 'du', "d'", 'chez', 'pour', 'sur', 'par', 'avec', 'sans', 'vers']);
const AUXILIARIES = new Set(['ai', 'as', 'a', 'avons', 'avez', 'ont', 'avais', 'avait', 'avions', 'aviez', 'avaient', 'suis', 'es', 'est', 'sommes', 'êtes', 'sont', 'étais', 'était', 'étions', 'étiez', 'étaient']);
/** Endings that only mark gender and number. */
const AGREEMENT_ENDINGS = new Set(['', 'e', 's', 'es']);
/** Endings that change a verb's form (infinitive, participle, person). */
const VERB_ENDINGS = new Set(['er', 'é', 'ée', 'és', 'ées', 'ez', 'ai', 'ais', 'ait', 'a', 'e', 'es', 'ent', 'ons', 'i', 'is', 'it', 'ir', 'u', 'ue', 'us', 'ues', 're']);
const MIN_STEM = 3;

const sameDeterminerFamily = (x: string, y: string): boolean => DETERMINER_PAIRS.some((family) => family.includes(x) && family.includes(y));

function commonPrefix(x: string, y: string): number {
  let n = 0;
  while (n < x.length && n < y.length && x[n] === y[n]) n += 1;
  return n;
}

type WordChange = EditKind | 'other';

function wordChange(x: string, y: string, position: number): WordChange {
  if (fold(x) === fold(y)) return 'accent';
  if (position === 0 && AUXILIARIES.has(x) && AUXILIARIES.has(y)) return 'auxiliary';
  if (sameDeterminerFamily(x, y)) return 'gender';
  if (PREPOSITIONS.has(x) && PREPOSITIONS.has(y)) return 'preposition';
  const stem = commonPrefix(x, y);
  if (stem < MIN_STEM) return 'other';
  const [ex, ey] = [x.slice(stem), y.slice(stem)];
  if (AGREEMENT_ENDINGS.has(ex) && AGREEMENT_ENDINGS.has(ey)) return 'agreement';
  if (VERB_ENDINGS.has(ex) && VERB_ENDINGS.has(ey)) return 'verb-form';
  return 'other';
}

const RANK: readonly EditKind[] = ['auxiliary', 'gender', 'preposition', 'verb-form', 'agreement', 'accent'];

/** The kind of mistake a change fixes, or null when it fits no rule. */
export function classifyEdit(original: string, corrected: string): EditKind | null {
  const o = tokens(original).map((t) => t.key);
  const c = tokens(corrected).map((t) => t.key);
  if (o.join(' ') === c.join(' ')) return null;
  if (o.length === 2 && c.length === 1) {
    const elided = /^(l|j|d|n|m|t|s|c|qu)'(.+)$/.exec(c[0]);
    if (elided && ELIDES[o[0]] === elided[1] && fold(o[1]) === fold(elided[2])) return 'elision';
  }
  if (o.length !== c.length) return null;
  const kinds = o.map((x, n) => (x === c[n] ? null : wordChange(x, c[n], n))).filter((k): k is WordChange => k !== null);
  if (kinds.includes('other')) return null;
  return RANK.find((k) => kinds.includes(k)) ?? null;
}

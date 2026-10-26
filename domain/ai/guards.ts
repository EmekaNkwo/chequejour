/**
 * Checks every language-model output must pass before a learner sees it. A failed
 * check throws AiError('rejected'); the screen then says so and keeps its non-AI
 * behaviour. The checks are deliberately strict: a missing hint costs little, a wrong
 * or unsafe one costs trust.
 */
import type { z } from 'zod';
import { AiError } from './errors';

export function stripReasoning(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*$/, '')
    .trim();
}

/** The first {...} object in the output, fences and chatter around it ignored. */
export function parseModelJson<T>(text: string, schema: z.ZodType<T>): T {
  const body = stripReasoning(text);
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new AiError('rejected', 'The AI answer was not in the expected form.');
  let value: unknown;
  try {
    value = JSON.parse(body.slice(start, end + 1));
  } catch {
    throw new AiError('rejected', 'The AI answer was not in the expected form.');
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AiError('rejected', 'The AI answer was not in the expected form.');
  return parsed.data;
}

// Common words that only one of the two languages uses ("a", "on", "as" are left out, and so are
// single letters: elided "l'" or "j'" look just like the "t" and "s" of "isn't" or "it's").
const FRENCH_WORDS = new Set(
  'le la les un une des du de et est sont je tu il elle nous vous ils elles que qui pour avec dans sur pas ne ce cette ces mon ma mes ton ta tes son sa ses notre votre leur leurs au aux mais ou donc car très plus aussi être avoir fait faire qu en été était avez avons suis es'.split(' '),
);
const ENGLISH_WORDS = new Set(
  'the and is are was were i you he she we they that which who for with this these those my your his her our their not but or so very more also be have has had do does did of to it its use before after when if then there here what why how than because'.split(' '),
);

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .split(/[^\p{L}]+/u)
    .filter(Boolean);

/** Share of language-marking words that are French (0–1); 0 when none are found. */
export function frenchShare(text: string): number {
  let fr = 0;
  let en = 0;
  for (const w of words(text)) {
    if (FRENCH_WORDS.has(w)) fr += 1;
    else if (ENGLISH_WORDS.has(w)) en += 1;
  }
  return fr + en === 0 ? 0 : fr / (fr + en);
}

const marked = (text: string): number => words(text).filter((w) => FRENCH_WORDS.has(w) || ENGLISH_WORDS.has(w)).length;

/** Fewer marking words than this and the language can't be told reliably. */
const MIN_MARKERS = 3;
const QUOTED = /“[^”]*”|«[^»]*»|"[^"]*"|‘[^’]*’/g;

const LINK = /\bhttps?:\/\/|\bwww\.|\b[\w.-]+\.(?:com|fr|ca|org|net|io)\b/i;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
/** Ten or more digits in a run: a phone number, not a date like 2026-10-26 or 12 345 678. */
const PHONE = /(?:\+?\d[\s.-]?){10,}/;
const TEMPLATE_TOKEN = /<\|[^|>]*\|>|<\/?s>|\[\/?INST\]|<\/?(?:think|tool_call)>/i;
// Letter-aware edges (\b treats accented letters as word breaks); a hyphen joins words, so
// "pique-nique" is not "nique".
const UNSAFE = new RegExp(
  `(?<![\\p{L}-])(?:${[
    'connard', 'connasse', 'salope', 'pute', 'putain', 'encul\\w*', 'nique', 'niquer', 'couille\\w*', 'pédé', 'nègre', 'bougnoule', 'suicide', 'suicider',
    'idiot', 'stupid', 'moron', 'fuck\\w*', 'shit', 'bitch', 'cunt', 'dick', 'whore', 'nigger', 'faggot', 'rape',
  ].join('|')})(?![\\p{L}-])`,
  'iu',
);

/** True when the text contains a word the app never shows or answers. */
export function hasUnsafeWords(text: string): boolean {
  return UNSAFE.test(text);
}

export interface TextCheck {
  /** 'fr' for French replies, 'en' for explanations (French quotes allowed), 'any' for short snippets. */
  language: 'fr' | 'en' | 'any';
  maxChars: number;
}

const reject = (why: string): never => {
  throw new AiError('rejected', why);
};

/** The text, trimmed, if it passes; throws AiError('rejected') otherwise. */
export function checkText(raw: string, { language, maxChars }: TextCheck): string {
  const text = stripReasoning(raw);
  if (text.length === 0) reject('The AI answer was empty.');
  if (text.length > maxChars) reject('The AI answer was too long.');
  if (TEMPLATE_TOKEN.test(text)) reject('The AI answer was garbled.');
  if (LINK.test(text) || EMAIL.test(text) || PHONE.test(text)) reject('The AI answer contained a link or contact details.');
  if (UNSAFE.test(text)) reject('The AI answer contained unsuitable words.');
  if (language === 'fr' && marked(text) >= MIN_MARKERS && frenchShare(text) < 0.5) reject('The AI answer was not in French.');
  if (language === 'en') {
    const own = text.replace(QUOTED, ' ');
    if (marked(own) >= MIN_MARKERS && frenchShare(own) > 0.5) reject('The AI answer was not in English.');
  }
  return text;
}

const comparable = (s: string): string => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

/**
 * True when `quote` really appears in the learner's text, as whole words, so a correction
 * can't point at words they never wrote (or at "a" inside "avec").
 */
export function quotedIn(text: string, quote: string): boolean {
  const q = comparable(quote);
  if (q.length === 0) return false;
  const haystack = comparable(text);
  const isLetter = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c);
  for (let at = haystack.indexOf(q); at >= 0; at = haystack.indexOf(q, at + 1)) {
    const before = haystack[at - 1];
    const after = haystack[at + q.length];
    const startsInWord = isLetter(q[0]) && isLetter(before);
    const endsInWord = isLetter(q[q.length - 1]) && isLetter(after);
    if (!startsInWord && !endsInWord) return true;
  }
  return false;
}

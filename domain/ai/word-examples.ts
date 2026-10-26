/**
 * AI-made example sentences for a word, and fill-the-gap practice built from them. This
 * is the riskiest AI use (new French text, not feedback), so it is off by default and
 * every sentence must contain the word, read as French, and differ from the course's
 * own example. The gap answer comes from the sentence itself, never from the model.
 */
import { z } from 'zod';
import { stripAccents } from '../answers';
import type { Level, PartOfSpeech, VocabItem } from '../content-types';
import { AiError } from './errors';
import { checkText } from './guards';

export type ExampleWord = Pick<VocabItem, 'fr' | 'en' | 'pos' | 'level' | 'example'>;

export interface WordExample {
  fr: string;
  en: string;
  /** The form of the word as it appears in the sentence. */
  form: string;
}

export const WORD_EXAMPLES_SCHEMA = z.object({
  examples: z.array(z.object({ fr: z.string().min(1).max(160), en: z.string().min(1).max(160) })).max(3),
});

const SYSTEM = (level: Level) =>
  [
    'You write example sentences for a French learner preparing for the TCF Canada.',
    `Write three different, natural, everyday French sentences at level ${level} that each use the given word (conjugated or agreed as needed), with an English translation.`,
    'Keep each sentence under 15 words. Use correct French with all accents. No names of real people, no links. Reply with JSON only.',
  ].join('\n');

export function wordExamplesMessages(word: ExampleWord): { role: 'system' | 'user'; content: string }[] {
  return [
    { role: 'system', content: SYSTEM(word.level) },
    { role: 'user', content: `Word: ${word.fr} (${word.pos}) — ${word.en}\nThe course already has: ${word.example.fr}` },
  ];
}

interface Token {
  text: string;
  folded: string;
  start: number;
  end: number;
}

const fold = (s: string): string => stripAccents(s).toLowerCase();

function tokens(text: string): Token[] {
  return [...text.matchAll(/\p{L}+/gu)].map((m) => ({ text: m[0], folded: fold(m[0]), start: m.index, end: m.index + m[0].length }));
}

const REFLEXIVE = new Set(['se', 's']);
const STEM_POS: ReadonlySet<PartOfSpeech> = new Set(['verb']);
const MIN_STEM = 3;

/** The part of a single-word headword that every form shares: verbs lose their ending. */
function stemOf(word: string, pos: PartOfSpeech): string {
  const folded = fold(word);
  if (STEM_POS.has(pos) && /(?:er|ir|re)$/.test(folded) && folded.length - 2 >= MIN_STEM) return folded.slice(0, -2);
  return folded;
}

/** The word as it appears in `sentence` (conjugated, agreed or plural), or null. */
export function findWordForm(sentence: string, word: Pick<ExampleWord, 'fr' | 'pos'>): string | null {
  const head = tokens(word.fr).map((t) => t.folded);
  const words = tokens(sentence);
  const main = head.length === 2 && REFLEXIVE.has(head[0]) ? [head[1]] : head;
  if (main.length === 1) {
    const stem = stemOf(main[0], word.pos);
    const found = words.find((t) => t.folded.startsWith(stem) && t.folded.length <= stem.length + 4);
    return found ? found.text : null;
  }
  for (let i = 0; i + main.length <= words.length; i += 1) {
    if (main.every((m, j) => words[i + j].folded === m)) return sentence.slice(words[i].start, words[i + main.length - 1].end);
  }
  return null;
}

export function gapSentence(sentence: string, form: string): string {
  return sentence.replace(form, '____');
}

const same = (a: string, b: string): boolean => fold(a).replace(/\W+/g, ' ').trim() === fold(b).replace(/\W+/g, ' ').trim();

function soundExample(e: { fr: string; en: string }, word: ExampleWord): WordExample | null {
  try {
    const fr = checkText(e.fr, { language: 'fr', maxChars: 160 });
    const en = checkText(e.en, { language: 'any', maxChars: 160 });
    if (same(fr, word.example.fr)) return null;
    const form = findWordForm(fr, word);
    return form ? { fr, en, form } : null;
  } catch {
    return null;
  }
}

export function checkWordExamples(value: z.infer<typeof WORD_EXAMPLES_SCHEMA>, word: ExampleWord): WordExample[] {
  const kept = value.examples.map((e) => soundExample(e, word)).filter((e): e is WordExample => e !== null);
  if (kept.length === 0) throw new AiError('rejected', 'None of the AI examples passed the checks.');
  return kept;
}

/**
 * AI feedback on a handed-in text: a few specific corrections, what already works, and
 * one next step. Never a score or level: grading stays with the app's own rules. False
 * corrections are the main risk, so each correction is checked on its own and dropped
 * unless it quotes the learner's real words and actually changes them.
 */
import { z } from 'zod';
import type { Level, WritingTask } from '../content-types';
import { AiError } from './errors';
import { checkText, quotedIn } from './guards';

export interface WritingFeedbackInput {
  taskType: WritingTask['taskType'];
  level: Level;
  promptFr: string;
  minWords: number;
  maxWords: number;
  text: string;
}

const MAX_CORRECTIONS = 5;

export const WRITING_FEEDBACK_SCHEMA = z.object({
  corrections: z
    .array(z.object({ original: z.string().min(1).max(120), corrected: z.string().min(1).max(120), why: z.string().min(1).max(240) }))
    .max(MAX_CORRECTIONS),
  strengths: z.array(z.string().min(1).max(200)).max(2),
  nextStep: z.string().min(1).max(240),
});

export type WritingFeedback = z.infer<typeof WRITING_FEEDBACK_SCHEMA>;
export type Correction = WritingFeedback['corrections'][number];

const TASK_NAME: Record<WritingTask['taskType'], string> = {
  message: 'TCF Canada writing task 1 (a short message)',
  description: 'TCF Canada writing task 2 (an account or description)',
  opinion: 'TCF Canada writing task 3 (an opinion text comparing two views)',
};

const SYSTEM = [
  'You are a careful French teacher. Your student is an English-speaking adult preparing for the TCF Canada.',
  `Find at most ${MAX_CORRECTIONS} clear mistakes of grammar, spelling, accents or agreement in the student’s text. For each: "original" is the exact words copied from the text (one to four words, not a whole sentence), "corrected" is the same words fixed, "why" explains the rule in one short sentence in English.`,
  'List only words that are wrong; if you are not sure something is wrong, leave it out. Never list a correct sentence. Fewer mistakes is fine. Do not change style, word choice that is correct, punctuation spacing or capital letters.',
  'In "strengths", give one or two short things the text really does well, in English. In "nextStep", give one concrete thing to improve next time, in English.',
  'Give no score, mark, grade or level of any kind, and do not mention the student’s level. Reply with JSON only, on one line.',
].join('\n');

export function writingFeedbackMessages(input: WritingFeedbackInput): { role: 'system' | 'user'; content: string }[] {
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `Task: ${TASK_NAME[input.taskType]}, level ${input.level}, ${input.minWords}–${input.maxWords} words.\nStatement: ${input.promptFr}\n\nStudent’s text:\n${input.text}`,
    },
  ];
}

/** Scores, marks or levels: the AI must not grade. */
export const GRADES = /\b\d{1,3}\s*(?:\/|out of|sur)\s*\d{1,3}\b|\bscor(?:e|ed|ing)\b|\b(?:mark|grade|note)\s*(?:[:=]|of)\s*\d|\b\d{1,3}\s*points?\b|\bNCLC\b|\b(?:CLB|CECRL|CEFR)\b|\b[ABC][12]\b|\b(?:beginner|elementary|intermediate|advanced|upper[- ]intermediate)\s+level\b/i;

const tidy = (s: string): string => s.replace(/\s+/g, ' ').trim();
const norm = (s: string): string => tidy(s.replace(/[’']/g, "'"));
/** What a change looks like ignoring capitals and the spaces French puts around punctuation. */
const substance = (s: string): string => norm(s).toLowerCase().replace(/\s*([?!:;,.])/g, '$1');

/** Lower case, no accents, one kind of apostrophe: the letters a learner typed. */
const letters = (s: string): string => norm(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row.push(Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    previous = row;
  }
  return previous[b.length];
}

/**
 * Learners' slips are small edits: an accent, an ending, an elision. A "correction" that
 * rewrites the words ("je etais" → "je suis") is the model guessing, so it is held back.
 */
const MAX_EDIT_SHARE = 0.34;
const MIN_EDIT_ALLOWANCE = 2;
function smallEdit(original: string, corrected: string): boolean {
  const a = letters(original);
  const b = letters(corrected);
  return editDistance(a, b) <= Math.max(MIN_EDIT_ALLOWANCE, MAX_EDIT_SHARE * Math.max(a.length, b.length));
}

/** The correction, tidied, if it quotes the learner's words and really changes them; null otherwise. */
export function soundCorrection(c: Correction, text: string): Correction | null {
  if (!quotedIn(text, c.original)) return null;
  if (substance(c.original) === substance(c.corrected)) return null;
  if (!smallEdit(c.original, c.corrected)) return null;
  try {
    const corrected = checkText(c.corrected, { language: 'any', maxChars: 120 });
    const why = checkText(c.why, { language: 'en', maxChars: 240 });
    if (GRADES.test(why)) return null;
    return { original: tidy(c.original), corrected: tidy(corrected), why };
  } catch {
    return null;
  }
}

export interface CheckedWritingFeedback extends WritingFeedback {
  /** Corrections the AI proposed that failed the checks and are not shown. */
  heldBack: number;
}

export function checkWritingFeedback(value: WritingFeedback, input: WritingFeedbackInput): CheckedWritingFeedback {
  if (GRADES.test(value.nextStep)) throw new AiError('rejected', 'The AI feedback tried to give a score.');
  // A strength that mentions a level is left out; the rest of the feedback can still help.
  const strengths = value.strengths.filter((s) => !GRADES.test(s)).map((s) => checkText(s, { language: 'en', maxChars: 200 }));
  const nextStep = checkText(value.nextStep, { language: 'en', maxChars: 240 });
  const corrections = value.corrections.map((c) => soundCorrection(c, input.text)).filter((c): c is Correction => c !== null);
  return { corrections, strengths, nextStep, heldBack: value.corrections.length - corrections.length };
}

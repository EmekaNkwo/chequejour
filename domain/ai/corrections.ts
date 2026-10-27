/**
 * Checks shared by the AI's corrections of a learner's French (writing and speaking):
 * a correction must quote the learner's real words, really change them, and stay a small
 * edit; advice must be English and never a grade.
 */
import { checkText, quotedIn } from './guards';

export interface Correction {
  original: string;
  corrected: string;
  why: string;
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

/** A correction as shown: the reason is left out when it failed the checks (often French on the phone). */
export interface CheckedCorrection {
  original: string;
  corrected: string;
  why: string | null;
}

/** The correction, tidied, if it quotes the learner's words and really changes them; null otherwise. */
export function soundCorrection(c: Correction, text: string): CheckedCorrection | null {
  if (!quotedIn(text, c.original)) return null;
  if (substance(c.original) === substance(c.corrected)) return null;
  if (!smallEdit(c.original, c.corrected)) return null;
  try {
    const corrected = checkText(c.corrected, { language: 'any', maxChars: 120 });
    return { original: tidy(c.original), corrected: tidy(corrected), why: usableAdvice(c.why, 240) };
  } catch {
    return null;
  }
}

/** English advice without a grade, or null: one bad item is left out, not the whole answer. */
export function usableAdvice(text: string, maxChars: number): string | null {
  if (GRADES.test(text)) return null;
  try {
    return checkText(text, { language: 'en', maxChars });
  } catch {
    return null;
  }
}

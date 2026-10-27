/**
 * AI feedback on a handed-in text. The model only writes a corrected copy of the text:
 * small models do that far better than listing and explaining mistakes. The app then
 * finds the changes itself, keeps those that fit a known kind of mistake, and explains
 * each kind in its own words, so the learner never sees an invented reason. Never a
 * score or level: grading stays with the app's own rules.
 */
import type { Level, WritingTask } from '../content-types';
import { quotedIn } from './guards';
import { AiError } from './errors';
import { changedShare, classifyEdit, textEdits, type EditKind } from './text-edits';

export interface WritingFeedbackInput {
  taskType: WritingTask['taskType'];
  level: Level;
  promptFr: string;
  minWords: number;
  maxWords: number;
  text: string;
}

/** A model told to "change as little as possible" copies the text unchanged; one worked example fixes that. */
const EXAMPLE_TEXT = 'Hier, je suis alle au cinema avec le ami de ma soeur. Le film etait tres bien. Apres, nous avons allé dans une petit restaurant italien en Toronto. Mes cousins sont parti tôt et ma soeur est arrive en retard. Elle a pris trop des photos.';
const EXAMPLE_FIXED = 'Hier, je suis allé au cinéma avec l’ami de ma sœur. Le film était très bien. Après, nous sommes allés dans un petit restaurant italien à Toronto. Mes cousins sont partis tôt et ma sœur est arrivée en retard. Elle a pris trop de photos.';

const SYSTEM = [
  'You correct French texts written by English-speaking adults preparing for the TCF Canada. They make many small mistakes: missing accents (mange → mangé, tres → très), missing elision (le ami → l’ami, je ai → j’ai), wrong gender (le voiture → la voiture), agreement (elle est parti → elle est partie), wrong auxiliary (je ai allé → je suis allé), wrong preposition (en Paris → à Paris).',
  'Rewrite the text with every mistake fixed. Keep everything that is already correct exactly as it is: same words, same order, same punctuation. Do not improve the style. Reply with the corrected text only.',
].join('\n\n');

/** The example is a real exchange, not part of the instructions: written into the instructions, the model ignored it. */
export function writingFeedbackMessages(input: WritingFeedbackInput): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: EXAMPLE_TEXT },
    { role: 'assistant', content: EXAMPLE_FIXED },
    { role: 'user', content: input.text },
  ];
}

/** French runs to about 1.6 tokens a word; the copy is as long as the text, plus room. */
const TOKENS_PER_WORD = 2;
const TOKEN_ROOM = 40;
export function writingMaxTokens(text: string): number {
  return text.trim().split(/\s+/).length * TOKENS_PER_WORD + TOKEN_ROOM;
}

/** Room for accents, elisions and a few changed words; well short of a rewrite. */
export function writingMaxChars(text: string): number {
  return Math.ceil(text.length * 1.3) + 40;
}

export const EXPLANATIONS: Readonly<Record<EditKind, string>> = {
  accent: 'Accent: in French the accent is part of the spelling, and can change the word (a / à, mange / mangé).',
  elision: 'Elision: le, la, je, de, ne and que drop their vowel before a vowel or silent h (l’ami, j’étais).',
  gender: 'Gender: the article or determiner must match the noun’s gender (la maison, un gâteau).',
  preposition: 'Small word: this phrase takes a different preposition or article (à before a city, beaucoup de + noun).',
  auxiliary: 'Auxiliary: a few verbs form the passé composé with être (je suis resté); most take avoir (ils ont joué).',
  agreement: 'Agreement: the ending follows the gender and number of the word it goes with (-e feminine, -s plural).',
  'verb-form': 'Verb form: this verb needs a different ending here, e.g. the past participle (joué) after avoir, not the infinitive (jouer).',
};

const NEXT_STEPS: Readonly<Record<EditKind, string>> = {
  accent: 'Reread for accents before handing in: past participles of -er verbs end in é.',
  elision: 'Watch for le, je, de and que before a vowel: they become l’, j’, d’ and qu’.',
  gender: 'Learn each noun with its article (la maison, le gâteau) so the gender sticks.',
  preposition: 'Note the small words that go with places and quantities: à Montréal, au Canada, beaucoup de.',
  auxiliary: 'Review the verbs that take être in the passé composé: aller, venir, arriver, partir, rester and their family.',
  agreement: 'Check endings: with être, the past participle agrees with the subject (elle est arrivée).',
  'verb-form': 'After avoir or être, write the past participle (joué, fini), not the infinitive.',
};

/** More changed than this means the model rewrote the text rather than correcting it. */
const MAX_CHANGED_SHARE = 0.4;
/** Enough to act on; a long list of slips discourages more than it helps. */
const MAX_SHOWN = 8;

export interface WritingCorrection {
  original: string;
  corrected: string;
  kind: EditKind;
  /** The app's own explanation of this kind of mistake. */
  why: string;
}

export interface CheckedWritingFeedback {
  corrections: WritingCorrection[];
  /** For the most frequent kind of mistake; null when none was found. */
  nextStep: string | null;
  /** Changes the AI made that fit no known kind of mistake and are not shown. */
  heldBack: number;
}

function mostFrequent(kinds: readonly EditKind[]): EditKind | null {
  const counts = new Map<EditKind, number>();
  for (const k of kinds) counts.set(k, (counts.get(k) ?? 0) + 1);
  let best: EditKind | null = null;
  for (const [k, n] of counts) if (best === null || n > (counts.get(best) ?? 0)) best = k;
  return best;
}

/** The corrections worth showing from the model's corrected copy of the text. */
export function checkWritingFeedback(corrected: string, input: WritingFeedbackInput): CheckedWritingFeedback {
  if (changedShare(input.text, corrected) > MAX_CHANGED_SHARE) {
    throw new AiError('rejected', 'The AI rewrote the text instead of correcting it.');
  }
  const seen = new Set<string>();
  const kept: WritingCorrection[] = [];
  let heldBack = 0;
  for (const edit of textEdits(input.text, corrected)) {
    const id = `${edit.original}→${edit.corrected}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const kind = classifyEdit(edit.original, edit.corrected);
    if (kind === null || !quotedIn(input.text, edit.original)) heldBack += 1;
    else kept.push({ ...edit, kind, why: EXPLANATIONS[kind] });
  }
  const kind = mostFrequent(kept.map((c) => c.kind));
  return { corrections: kept.slice(0, MAX_SHOWN), nextStep: kind ? NEXT_STEPS[kind] : null, heldBack };
}

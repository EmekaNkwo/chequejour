/**
 * Quick "Test me" checks for the Word and Sentence of the Day, built from content so
 * they need no authoring.
 */
import { headword } from '../../domain/audio-keys';
import type { McqExercise, ReorderExercise, Sentence, VocabItem } from '../../domain/content-types';
import { seededShuffle } from '../../domain/shuffle';

/** Sentences longer than this are too fiddly to reorder on a phone. */
export const MAX_REORDER_TOKENS = 12;

/** "What does X mean?" with the meaning and up to three distractors from the same unit. */
export function wordMeaningQuiz(word: VocabItem, unitWords: readonly VocabItem[], seed: string): McqExercise {
  const distractors = seededShuffle(
    unitWords.filter((w) => w.id !== word.id && w.en !== word.en),
    seed,
  )
    .map((w) => w.en)
    .filter((en, i, all) => all.indexOf(en) === i)
    .slice(0, 3);
  const options = seededShuffle([word.en, ...distractors], `${seed}:options`);
  return {
    id: `daily-${word.id}`,
    type: 'mcq',
    level: word.level,
    skill: 'structures',
    grammarTag: 'vocabulary',
    prompt: `What does « ${headword(word)} » mean?`,
    options,
    answer: options.indexOf(word.en),
    explanation: `${word.example.fr} — ${word.example.en}`,
  };
}

/** Rebuild the sentence from its words, or null when it is too long. */
export function sentenceReorderQuiz(sentence: Sentence): ReorderExercise | null {
  const tokens = sentence.fr.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length < 3 || tokens.length > MAX_REORDER_TOKENS) return null;
  return {
    id: `daily-${sentence.id}`,
    type: 'reorder',
    level: sentence.level,
    skill: 'structures',
    grammarTag: sentence.grammarTag,
    prompt: 'Rebuild the sentence of the day',
    tokens,
    translation: sentence.en,
    explanation: sentence.grammarNote,
  };
}

/** Fallback for long sentences: pick the right translation. */
export function sentenceMeaningQuiz(sentence: Sentence, others: readonly Sentence[], seed: string): McqExercise {
  const distractors = seededShuffle(
    others.filter((s) => s.id !== sentence.id),
    seed,
  )
    .slice(0, 2)
    .map((s) => s.en);
  const options = seededShuffle([sentence.en, ...distractors], `${seed}:options`);
  return {
    id: `daily-${sentence.id}`,
    type: 'mcq',
    level: sentence.level,
    skill: 'structures',
    grammarTag: sentence.grammarTag,
    prompt: 'Which translation is right?',
    promptFr: sentence.fr,
    options,
    answer: options.indexOf(sentence.en),
    explanation: sentence.grammarNote,
  };
}

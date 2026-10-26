/**
 * "Explain my mistake": the prompt and the checks for a short English explanation of a
 * wrong answer. The answer key is given to the model as fact; the AI only explains it,
 * and an explanation that sides with the wrong answer is thrown away.
 */
import { z } from 'zod';
import { GRAMMAR_TAG_LABELS, type GrammarTag } from '../content-types';
import { AiError } from './errors';
import { checkText } from './guards';

export interface ExplainInput {
  prompt: string;
  userAnswer: string;
  correctAnswer: string;
  /** The app's own explanation, which the AI must stay consistent with. */
  explanation: string;
  grammarTag: GrammarTag | null;
}

export const EXPLAIN_SCHEMA = z.object({
  explanation: z.string().min(1).max(600),
  example: z.string().min(1).max(200),
});

export type Explanation = z.infer<typeof EXPLAIN_SCHEMA>;

const SYSTEM = [
  'You are a patient French teacher. Your student is an English-speaking adult preparing for the TCF Canada, around level A2–B1.',
  'You are given an exercise, the student’s wrong answer and the correct answer. The correct answer is certain: never question it and never say the student’s answer could also be right.',
  'In "explanation", say in simple English, in at most three short sentences, why the student’s answer is wrong and how to choose the right form. Quote French words in double quotes.',
  'In "example", write one new short French sentence that uses the correct form. Do not reuse the exercise sentence.',
  'Reply with JSON only.',
].join('\n');

export function explainMessages(m: ExplainInput): { role: 'system' | 'user'; content: string }[] {
  const point = m.grammarTag ? `\nGrammar point: ${GRAMMAR_TAG_LABELS[m.grammarTag]}` : '';
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `Exercise: ${m.prompt}\nLearner’s answer: ${m.userAnswer}\nCorrect answer: ${m.correctAnswer}${point}\nTeacher’s note: ${m.explanation}`,
    },
  ];
}

/** Phrases that concede the learner was right, which would contradict the answer key. */
const CONCEDES = /\byour answer (?:is|was) (?:also )?(?:correct|right|acceptable|fine|possible)\b|\byou were right\b|\bboth (?:answers |forms |options )?(?:are|work|would work)\b|\balso (?:correct|right|acceptable)\b|\b(?:is|was)(?: not|n[’']t) (?:wrong|a mistake|incorrect)\b|\bnot (?:really )?a mistake\b/i;

const norm = (s: string): string => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

export function checkExplanation(value: Explanation, m: ExplainInput): Explanation {
  const explanation = checkText(value.explanation, { language: 'en', maxChars: 600 });
  if (CONCEDES.test(explanation)) throw new AiError('rejected', 'The AI explanation contradicted the answer key.');
  const example = checkText(value.example, { language: 'fr', maxChars: 200 });
  const wrong = norm(m.userAnswer);
  // A wrong answer that is part of the right one ("à" in "à la") can't be told apart; only longer slips are checked.
  if (wrong.length >= 3 && !norm(m.correctAnswer).includes(wrong) && norm(example).includes(wrong)) {
    throw new AiError('rejected', 'The AI example repeated the wrong answer.');
  }
  return { explanation, example };
}

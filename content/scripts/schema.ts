/**
 * Zod schemas mirroring domain/content-types.ts. `satisfies` keeps them in sync:
 * if a type changes and the schema doesn't, this file stops compiling.
 */
import { z } from 'zod';
import {
  CEFR_BANDS,
  GRAMMAR_TAGS,
  LEVELS,
  type CefrBand,
  type ContentBundle,
  type Exercise,
  type MockTest,
  type PlacementTest,
  type Sentence,
  type Unit,
} from '../../domain/content-types';

const text = z.string().trim().min(1);
const level = z.enum(LEVELS as [string, ...string[]]) as z.ZodType<Unit['level']>;
const grammarTag = z.enum(GRAMMAR_TAGS as [string, ...string[]]) as z.ZodType<Sentence['grammarTag']>;
const bilingual = z.object({ fr: text, en: text });

const exerciseBase = {
  id: text,
  level,
  skill: z.enum(['structures', 'listening', 'reading']),
  grammarTag,
  explanation: text,
};

const mcq = z
  .object({
    ...exerciseBase,
    type: z.literal('mcq'),
    prompt: text,
    promptFr: text.optional(),
    options: z.array(text).min(2).max(5),
    answer: z.number().int().min(0),
  })
  .refine((e) => e.answer < e.options.length, { message: 'answer index out of range' })
  .refine((e) => new Set(e.options).size === e.options.length, { message: 'duplicate options' });

const blankCount = (s: string): number => s.split('___').length - 1;

const fillBlank = z
  .object({
    ...exerciseBase,
    type: z.literal('fill_blank'),
    prompt: text,
    sentence: text,
    answers: z.array(text).min(1),
    hint: text.optional(),
    translation: text,
  })
  .refine((e) => blankCount(e.sentence) === 1, { message: 'sentence must contain exactly one ___' });

const conjugation = z.object({
  ...exerciseBase,
  type: z.literal('conjugation'),
  verb: text,
  tense: text,
  person: text,
  answers: z.array(text).min(1),
});

const reorder = z.object({
  ...exerciseBase,
  type: z.literal('reorder'),
  prompt: text,
  tokens: z.array(text).min(3).max(12),
  translation: text,
});

const match = z.object({
  ...exerciseBase,
  type: z.literal('match'),
  prompt: text,
  pairs: z.array(z.object({ left: text, right: text })).min(3).max(5),
});

const translate = z.object({
  ...exerciseBase,
  type: z.literal('translate'),
  direction: z.enum(['fr-en', 'en-fr']),
  source: text,
  answers: z.array(text).min(1),
});

const dictation = z.object({
  ...exerciseBase,
  type: z.literal('dictation'),
  text,
  translation: text,
});

export const exerciseSchema = z.union([
  mcq,
  fillBlank,
  conjugation,
  reorder,
  match,
  translate,
  dictation,
]) satisfies z.ZodType<Exercise>;

const question = z
  .object({
    id: text,
    question: text,
    options: z.array(text).min(3).max(4),
    answer: z.number().int().min(0),
    explanation: text,
  })
  .refine((q) => q.answer < q.options.length, { message: 'answer index out of range' });

const listening = z.object({
  id: text,
  title: text,
  level,
  kind: z.enum(['dialogue', 'announcement', 'message', 'interview']),
  context: text,
  lines: z.array(z.object({ speaker: text, fr: text })).min(1),
  translation: text,
  questions: z.array(question).min(2),
});

const reading = z.object({
  id: text,
  title: text,
  level,
  kind: z.enum(['message', 'notice', 'email', 'article', 'advert', 'letter']),
  text,
  translation: text,
  questions: z.array(question).min(2),
});

const writing = z
  .object({
    id: text,
    title: text,
    level,
    taskType: z.enum(['message', 'description', 'opinion']),
    instructions: text,
    promptFr: text,
    minWords: z.number().int().positive(),
    maxWords: z.number().int().positive(),
    documents: z.array(z.object({ title: text, text })).length(2).optional(),
    modelAnswer: text,
    checklist: z.array(text).min(3),
  })
  .refine((w) => w.minWords < w.maxWords, { message: 'minWords must be < maxWords' });

const speaking = z.object({
  id: text,
  title: text,
  level,
  taskType: z.enum(['entretien', 'interaction', 'opinion']),
  instructions: text,
  promptFr: text,
  prepSeconds: z.number().int().min(0),
  speakSeconds: z.number().int().positive(),
  modelAnswer: text,
  tips: z.array(text).min(2),
});

const vocab = z
  .object({
    id: text,
    fr: text,
    en: text,
    pos: z.enum([
      'noun',
      'verb',
      'adjective',
      'adverb',
      'expression',
      'preposition',
      'conjunction',
      'pronoun',
      'other',
    ]),
    gender: z.enum(['m', 'f', 'mf']).optional(),
    plural: text.optional(),
    pluralOnly: z.boolean().optional(),
    level,
    core: z.boolean(),
    example: bilingual,
  })
  .refine((v) => v.pos !== 'noun' || v.gender !== undefined, { message: 'nouns need a gender' });

const grammarLesson = z.object({
  id: text,
  title: text,
  level,
  grammarTag,
  explanation: z.array(text).min(1),
  table: z.array(z.array(z.string())).optional(),
  examples: z.array(bilingual).min(3),
  commonMistakes: z.array(z.object({ wrong: text, right: text, why: text })).min(1),
});

export const unitSchema = z.object({
  // u01–u18 are the original A2–B1 units; a01–a06 the A1 units added before them.
  id: z.string().regex(/^[ua]\d{2}$/),
  order: z.number().int().positive(),
  level,
  theme: text,
  titleFr: text,
  description: text,
  vocab: z.array(vocab).min(15),
  grammar: z.array(grammarLesson).min(1),
  exercises: z.array(exerciseSchema).min(10),
  listening: z.array(listening).min(1),
  reading: z.array(reading).min(1),
  writing: z.array(writing).min(1),
  speaking: z.array(speaking).min(1),
  checkpoint: z.array(exerciseSchema).min(8),
}) satisfies z.ZodType<Unit>;

export const sentenceSchema = z.object({
  id: z.string().regex(/^s\d{3}$/),
  fr: text,
  en: text,
  grammarNote: text,
  grammarTag,
  level,
}) satisfies z.ZodType<Sentence>;

export const placementSchema = z.object({
  version: z.number().int(),
  questions: z.array(z.intersection(mcq, z.object({ band: level }))).min(10),
}) satisfies z.ZodType<PlacementTest>;

const mockQuestion = question.and(z.object({ band: z.enum(CEFR_BANDS as [CefrBand, ...CefrBand[]]) }));

export const mockTestSchema = z.object({
  id: z.string().regex(/^mk\d+$/),
  title: text,
  listening: z.array(listening.extend({ questions: z.array(mockQuestion).min(1) })).min(1),
  reading: z.array(reading.extend({ questions: z.array(mockQuestion).min(1) })).min(1),
  writing: z.array(writing).length(3),
  speaking: z.array(speaking).length(3),
}) satisfies z.ZodType<MockTest>;

export type ValidatedBundle = ContentBundle;

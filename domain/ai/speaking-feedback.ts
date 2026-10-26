/**
 * AI feedback on a speaking take, from its transcript: whether it answers the task, a
 * few clear slips, useful phrases and one next step. The transcript comes from speech
 * recognition and can contain mishearings, so corrections are kept to a minimum and
 * checked like writing corrections; no score is ever given.
 */
import { z } from 'zod';
import type { Level, SpeakingTask } from '../content-types';
import { AiError } from './errors';
import { checkText } from './guards';
import { GRADES, soundCorrection, type Correction } from './writing-feedback';

export interface SpeakingFeedbackInput {
  taskType: SpeakingTask['taskType'];
  level: Level;
  promptFr: string;
  transcript: string;
  durationMs: number;
}

const MAX_ITEMS = 3;

export const SPEAKING_FEEDBACK_SCHEMA = z.object({
  task: z.string().min(1).max(240),
  corrections: z
    .array(z.object({ original: z.string().min(1).max(120), corrected: z.string().min(1).max(120), why: z.string().min(1).max(240) }))
    .max(MAX_ITEMS),
  phrases: z.array(z.object({ fr: z.string().min(1).max(120), en: z.string().min(1).max(120) })).max(MAX_ITEMS),
  nextStep: z.string().min(1).max(240),
});

export type SpeakingFeedback = z.infer<typeof SPEAKING_FEEDBACK_SCHEMA>;

const TASK_NAME: Record<SpeakingTask['taskType'], string> = {
  entretien: 'TCF Canada speaking task 1 (guided interview about oneself)',
  interaction: 'TCF Canada speaking task 2 (role-play: asking questions to get information)',
  opinion: 'TCF Canada speaking task 3 (giving and defending an opinion)',
};

const SYSTEM = [
  'You are a supportive French speaking coach. Your student is an English-speaking adult preparing for the TCF Canada.',
  'You get an automatic speech recognition transcript of what the student said. It can contain recognition errors, so do not comment on spelling, punctuation or words that look misheard.',
  '"task": one or two short English sentences on how well the answer addresses the task.',
  `"corrections": at most ${MAX_ITEMS} clear grammar mistakes, each with the exact words copied from the transcript as "original", the fix as "corrected", and a short English "why". Leave the list empty if you are not sure.`,
  `"phrases": up to ${MAX_ITEMS} useful French phrases for this task that the student did not use, with an English gloss.`,
  '"nextStep": one concrete thing to try in the next take, in English.',
  'Give no score, mark, grade or level of any kind. Reply with JSON only.',
].join('\n');

export function speakingFeedbackMessages(input: SpeakingFeedbackInput): { role: 'system' | 'user'; content: string }[] {
  const seconds = Math.round(input.durationMs / 1000);
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `Task: ${TASK_NAME[input.taskType]}, level ${input.level}.\nStatement: ${input.promptFr}\nThe student spoke for ${seconds} seconds.\n\nTranscript:\n${input.transcript}`,
    },
  ];
}

function soundPhrase(p: SpeakingFeedback['phrases'][number]): SpeakingFeedback['phrases'][number] | null {
  try {
    return { fr: checkText(p.fr, { language: 'fr', maxChars: 120 }), en: checkText(p.en, { language: 'any', maxChars: 120 }) };
  } catch {
    return null;
  }
}

export function checkSpeakingFeedback(value: SpeakingFeedback, input: SpeakingFeedbackInput): SpeakingFeedback {
  if (GRADES.test(value.task) || GRADES.test(value.nextStep)) throw new AiError('rejected', 'The AI feedback tried to give a score.');
  const task = checkText(value.task, { language: 'en', maxChars: 240 });
  const nextStep = checkText(value.nextStep, { language: 'en', maxChars: 240 });
  const corrections = value.corrections.map((c) => soundCorrection(c, input.transcript)).filter((c): c is Correction => c !== null);
  const phrases = value.phrases.map(soundPhrase).filter((p): p is SpeakingFeedback['phrases'][number] => p !== null);
  return { task, corrections, phrases, nextStep };
}

/**
 * The AI conversation partner for speaking tasks 2 (role-play) and 3 (opinion). The
 * partner opens and closes with fixed lines; in between, each reply is short, in French,
 * and checked. Unsafe input gets a fixed redirect instead of a model reply, and the
 * conversation ends after a set number of turns, as the exam does.
 */
import type { Level, SpeakingTask } from '../content-types';
import { AiError } from './errors';
import { checkText, hasUnsafeWords } from './guards';

export type ConversationTaskType = Extract<SpeakingTask['taskType'], 'interaction' | 'opinion'>;

export interface ConversationTask {
  taskType: ConversationTaskType;
  level: Level;
  promptFr: string;
}

export interface Turn {
  role: 'learner' | 'partner';
  text: string;
}

export const MAX_LEARNER_TURNS = 8;
/** Recent turns sent to the model: enough to stay coherent, small enough for a phone. */
const HISTORY_TURNS = 12;
const MAX_REPLY_CHARS = 280;

export const REDIRECT_LINE = 'Restons polis, s’il vous plaît, et revenons au sujet.';
export const CLOSING_LINE = 'Merci, c’est terminé. Vous avez bien travaillé !';

export function openingLine(task: ConversationTask): string {
  return task.taskType === 'interaction' ? 'Bonjour, je vous écoute. Que puis-je faire pour vous ?' : `${task.promptFr} Qu’en pensez-vous ?`;
}

const ROLE: Record<ConversationTaskType, string> = {
  interaction:
    'This is a TCF Canada role-play. The situation is below. You play the other person (for example the employee), never the candidate. Answer the candidate’s questions with plausible, invented details, and ask a short question back when it is natural.',
  opinion:
    'You are a TCF Canada examiner in task 3. The candidate gives an opinion on the topic below. React briefly, ask why or ask for an example, and sometimes offer a polite counter-argument so they have to defend their view.',
};

export function conversationMessages(task: ConversationTask, turns: readonly Turn[]): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  const system = [
    ROLE[task.taskType],
    `Situation: ${task.promptFr}`,
    `Speak only in French, at level ${task.level}: simple, clear sentences. Reply in at most two short sentences. Stay in this situation; if the candidate goes off topic, bring them back politely. Never give links, phone numbers or personal data. Write only your own words, with no name or label before them.`,
  ].join('\n');
  const recent = turns.slice(-HISTORY_TURNS).map((t) => ({ role: t.role === 'learner' ? ('user' as const) : ('assistant' as const), content: t.text }));
  return [{ role: 'system', content: system }, ...recent];
}

export type NextStep = { kind: 'ask' } | { kind: 'fixed'; text: string } | { kind: 'end'; text: string };

/** What answers the learner's latest words, given the turns before them. */
export function nextStep(before: readonly Turn[], said: string): NextStep {
  const learnerTurns = before.filter((t) => t.role === 'learner').length + 1;
  if (hasUnsafeWords(said)) return { kind: 'fixed', text: REDIRECT_LINE };
  if (learnerTurns >= MAX_LEARNER_TURNS) return { kind: 'end', text: CLOSING_LINE };
  return { kind: 'ask' };
}

/** Role names the model sometimes writes before its line; a general pattern would also eat "Bien sûr :". */
const SPEAKER_LABEL = /^\s*(?:l[’']|le |la )?(?:employée?|examinat(?:eur|rice)|agent(?: immobilier)?|partenaire|réceptionniste|vendeu(?:r|se)|assistant|secrétaire|conseill(?:er|ère)|interlocut(?:eur|rice))\s*:\s*/iu;

export function checkPartnerReply(raw: string): string {
  const text = checkText(raw, { language: 'fr', maxChars: MAX_REPLY_CHARS }).replace(SPEAKER_LABEL, '');
  // A line break followed by a label means the model started writing the candidate's turn too.
  if (/\n\s*[\p{L} ]{1,24}\s*:/u.test(text)) throw new AiError('rejected', 'The AI wrote more than its own turn.');
  return text.replace(/\s+/g, ' ').trim();
}

export function learnerSide(turns: readonly Turn[]): string {
  return turns
    .filter((t) => t.role === 'learner')
    .map((t) => t.text)
    .join(' ');
}

/** The part of a prompt that is the same on every request, which the model can read ahead. */
interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * A feature's fixed opening: its instructions and any worked example, i.e. every message
 * before the learner's own (the last one, when it is the user's).
 */
export function fixedPrefix<M extends Message>(messages: readonly M[]): M[] {
  const last = messages[messages.length - 1];
  return last?.role === 'user' ? messages.slice(0, -1) : [...messages];
}

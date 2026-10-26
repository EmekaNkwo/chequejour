import { CLOSING_LINE, MAX_LEARNER_TURNS, REDIRECT_LINE, checkPartnerReply, conversationMessages, learnerSide, nextStep, openingLine, type ConversationTask, type Turn } from '../ai/conversation';

const interaction: ConversationTask = {
  taskType: 'interaction',
  level: 'A2',
  promptFr: 'Vous téléphonez au club de sport pour vous renseigner. L’examinateur joue le rôle de l’employé du club.',
};
const opinion: ConversationTask = { taskType: 'opinion', level: 'B1', promptFr: 'Faut-il interdire les voitures en centre-ville ?' };

const rejected = (fn: () => unknown) => {
  try {
    fn();
    return false;
  } catch (e: unknown) {
    return (e as { failure?: string }).failure === 'rejected';
  }
};

describe('conversation partner', () => {
  it('opens with a fixed line: a greeting for a role-play, the question for an opinion task', () => {
    expect(openingLine(interaction)).toMatch(/^Bonjour/);
    expect(openingLine(opinion)).toContain('Faut-il interdire les voitures en centre-ville ?');
  });

  it('plays the role from the task and keeps replies short, in French and on topic', () => {
    const [system] = conversationMessages(interaction, [{ role: 'partner', text: openingLine(interaction) }]);
    expect(system.content).toContain(interaction.promptFr);
    expect(system.content).toMatch(/two short sentences/i);
    expect(system.content).toMatch(/only in French/i);
    expect(system.content).toMatch(/A2/);
  });

  it('challenges the learner’s opinion in task 3', () => {
    expect(conversationMessages(opinion, [])[0].content).toMatch(/counter-argument/i);
  });

  it('maps turns to chat roles, keeping only the recent history', () => {
    const turns: Turn[] = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 === 0 ? 'partner' : 'learner', text: `t${i}` }));
    const messages = conversationMessages(opinion, turns);
    expect(messages[1]).toEqual({ role: 'assistant', content: 't18' });
    expect(messages.at(-1)).toEqual({ role: 'user', content: 't29' });
    expect(messages).toHaveLength(13);
  });

  it('decides what comes next: a redirect for unsafe input, a closing line at the turn limit, else the model', () => {
    const turns = (n: number): Turn[] => Array.from({ length: n }, () => ({ role: 'learner', text: 'Oui' }));
    expect(nextStep(turns(1), 'Je voudrais des informations.')).toEqual({ kind: 'ask' });
    expect(nextStep(turns(1), 'Tu es un connard.')).toEqual({ kind: 'fixed', text: REDIRECT_LINE });
    expect(nextStep(turns(MAX_LEARNER_TURNS - 1), 'Merci.')).toEqual({ kind: 'end', text: CLOSING_LINE });
  });

  it('collects what the learner said for coaching', () => {
    expect(learnerSide([{ role: 'partner', text: 'Bonjour' }, { role: 'learner', text: 'Bonjour.' }, { role: 'learner', text: 'Merci.' }])).toBe('Bonjour. Merci.');
  });
});

describe('checking a partner reply', () => {
  it('passes a short French reply and strips a speaker label', () => {
    expect(checkPartnerReply('Employé : Bien sûr, le club est ouvert de 7 h à 22 h.')).toBe('Bien sûr, le club est ouvert de 7 h à 22 h.');
    expect(checkPartnerReply('Bien sûr : le club est ouvert tous les jours.')).toBe('Bien sûr : le club est ouvert tous les jours.');
  });

  it('rejects English, long, or multi-turn replies', () => {
    expect(rejected(() => checkPartnerReply('Sure, the club is open from 7 to 10 and you can come any day.'))).toBe(true);
    expect(rejected(() => checkPartnerReply('Oui. '.repeat(80)))).toBe(true);
    expect(rejected(() => checkPartnerReply('Bien sûr.\nCandidat : Merci beaucoup.'))).toBe(true);
  });
});

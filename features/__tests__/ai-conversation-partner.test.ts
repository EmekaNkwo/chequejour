import type { ModelEntry } from '../../domain/ai/manifest';
import { generate } from '../../services/ai/llm';
import { partnerReply } from '../ai/conversation-partner';

jest.mock('../../services/ai/llm', () => ({ generate: jest.fn() }));
const gen = generate as jest.Mock;
const task = { taskType: 'opinion' as const, level: 'B1' as const, promptFr: 'Faut-il travailler le samedi ?' };

beforeEach(() => gen.mockReset());

describe('partnerReply', () => {
  it('sends the role and history, and returns a cleaned French reply', async () => {
    gen.mockResolvedValueOnce('Examinateur : Pourquoi pensez-vous cela ? Donnez un exemple.');
    const turns = [{ role: 'partner' as const, text: 'Qu’en pensez-vous ?' }, { role: 'learner' as const, text: 'Je suis contre.' }];
    await expect(partnerReply({ id: 'llm' } as ModelEntry, task, turns)).resolves.toBe('Pourquoi pensez-vous cela ? Donnez un exemple.');
    const { messages, temperature } = gen.mock.calls[0][0];
    expect(temperature).toBe(0.7);
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'Je suis contre.' });
  });

  it('rejects a reply in English, after one more try', async () => {
    gen.mockResolvedValue('Why do you think that? Give me an example from your life.');
    await expect(partnerReply({ id: 'llm' } as ModelEntry, task, [])).rejects.toMatchObject({ failure: 'rejected' });
    expect(gen).toHaveBeenCalledTimes(2);
  });

  it('uses the second try when the first reply is rejected', async () => {
    gen.mockResolvedValueOnce('Why do you think that? Give me an example from your life.').mockResolvedValueOnce('Pourquoi pensez-vous cela ?');
    await expect(partnerReply({ id: 'llm' } as ModelEntry, task, [])).resolves.toBe('Pourquoi pensez-vous cela ?');
  });
});

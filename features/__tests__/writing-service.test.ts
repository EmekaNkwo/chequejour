/**
 * @jest-environment node
 */
import type { WritingTask } from '../../domain/content-types';
import { setupRealContent } from '../../test-utils/real-content';
import { loadNounGenders, submitWriting } from '../writing/writing-service';

const task: WritingTask = {
  id: 'u01-wr01',
  title: 't',
  level: 'A2',
  taskType: 'message',
  instructions: 'i',
  promptFr: 'p',
  minWords: 60,
  maxWords: 120,
  checklist: [],
  modelAnswer: 'm',
};

describe('writing service', () => {
  it('builds noun genders from the course vocabulary, single words only', async () => {
    const { content } = await setupRealContent();
    const genders = await loadNounGenders(content);
    expect(genders.get('journée')).toBe('f');
    expect(genders.get('matin')).toBe('m');
    expect([...genders.keys()].some((k) => k.includes(' '))).toBe(false);
    expect(await loadNounGenders(content)).toBe(genders);
  });

  it('saves a submission with its word count and number of tips, and returns the hints', async () => {
    const { content, progress } = await setupRealContent();
    const genders = await loadNounGenders(content);
    const hints = await submitWriting(progress, genders, task, 'Je suis tres content de la matin.', 50);
    expect(hints.map((h) => h.kind)).toEqual(['accent', 'agreement', 'connectors', 'greeting', 'signoff']);
    expect(await progress.submissions('u01-wr01')).toEqual([
      { id: expect.any(Number), taskId: 'u01-wr01', text: 'Je suis tres content de la matin.', words: 7, hints: 5, createdAt: 50 },
    ]);
  });

  it('does not save an empty text', async () => {
    const { content, progress } = await setupRealContent();
    expect(await submitWriting(progress, await loadNounGenders(content), task, '   ', 1)).toEqual([]);
    expect(await progress.submissions('u01-wr01')).toEqual([]);
  });
});

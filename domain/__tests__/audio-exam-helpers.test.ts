import { audioKey, collectAudioClips, listeningScript, startsWithElision } from '../audio-keys';
import type { ContentBundle, MockQuestion } from '../content-types';
import { speakingTaskFormat, TCF_CANADA, testMinutes, writingTaskFormat, writingTaskMinutes } from '../tcf/exam-format';
import { reviewItems } from '../tcf/mock-scoring';
import { SPEAKING_CRITERIA } from '../tcf/self-check';

describe('audio keys', () => {
  it('names clips by item id with suffixes for examples and model answers', () => {
    expect(audioKey.word('u01-w001')).toBe('u01-w001');
    expect(audioKey.example('u01-w001')).toBe('u01-w001-ex');
    expect(audioKey.sentence('s001')).toBe('s001');
    expect(audioKey.listening('u01-li01')).toBe('u01-li01');
    expect(audioKey.dictation('u01-ex05')).toBe('u01-ex05');
    expect(audioKey.model('u01-sp01')).toBe('u01-sp01-model');
  });

  it('reads one line per speaker turn', () => {
    expect(listeningScript([{ fr: 'Bonjour.' }, { fr: 'Salut !' }])).toBe('Bonjour.\nSalut !');
  });

  it('elides before vowels and mute h only', () => {
    expect(startsWithElision('École')).toBe(true);
    expect(startsWithElision('homme')).toBe(true);
    expect(startsWithElision('haricot')).toBe(false);
    expect(startsWithElision('table')).toBe(false);
  });

  it('collects every clip the content needs', () => {
    const bundle = {
      units: [
        {
          vocab: [{ id: 'u01-w001', fr: 'ami', pos: 'noun', gender: 'm', example: { fr: 'Mon ami.' } }],
          listening: [{ id: 'u01-li01', lines: [{ fr: 'A' }, { fr: 'B' }] }],
          exercises: [
            { id: 'u01-ex01', type: 'dictation', text: 'Je mange.' },
            { id: 'u01-ex02', type: 'mcq' },
          ],
          checkpoint: [{ id: 'u01-cp01', type: 'dictation', text: 'Il pleut.' }],
          speaking: [{ id: 'u01-sp01', modelAnswer: 'Je suis étudiant.' }],
        },
      ],
      sentences: [{ id: 's001', fr: 'Il fait beau.' }],
      mockTests: [{ listening: [{ id: 'mk1-li01', lines: [{ fr: 'Allô ?' }] }] }],
    } as unknown as ContentBundle;
    expect(collectAudioClips(bundle)).toEqual([
      { key: 'u01-w001', text: "l'ami" },
      { key: 'u01-w001-ex', text: 'Mon ami.' },
      { key: 'u01-li01', text: 'A\nB' },
      { key: 'u01-li01-l1', text: 'A' },
      { key: 'u01-li01-l2', text: 'B' },
      { key: 'u01-ex01', text: 'Je mange.' },
      { key: 'u01-cp01', text: 'Il pleut.' },
      { key: 'u01-sp01-model', text: 'Je suis étudiant.' },
      { key: 's001', text: 'Il fait beau.' },
      { key: 'mk1-li01', text: 'Allô ?' },
    ]);
  });
});

describe('exam format lookups', () => {
  it('finds writing and speaking task formats', () => {
    expect(writingTaskFormat('opinion').task).toBe(3);
    expect(speakingTaskFormat('interaction')).toMatchObject({ task: 2, prepSeconds: 120, speakSeconds: 210 });
  });

  it('throws for a task type the format does not have', () => {
    const noTasks = { ...TCF_CANADA, writing: { ...TCF_CANADA.writing, tasks: [] }, speaking: { ...TCF_CANADA.speaking, tasks: [] } };
    expect(() => writingTaskFormat('message', noTasks)).toThrow('No writing task format for message');
    expect(() => speakingTaskFormat('opinion', noTasks)).toThrow('No speaking task format for opinion');
  });

  it('shares the writing hour across tasks by their length', () => {
    const minutes = (['message', 'description', 'opinion'] as const).map((t) => writingTaskMinutes(t));
    expect(minutes[0]).toBeLessThan(minutes[1]);
    expect(minutes[1]).toBeLessThan(minutes[2]);
    expect(minutes.reduce((a, b) => a + b, 0)).toBeCloseTo(TCF_CANADA.writing.minutes, -1);
  });

  it('gives listening and reading times from the format', () => {
    expect(testMinutes('listening')).toBe(TCF_CANADA.listening.minutes);
    expect(testMinutes('reading')).toBe(TCF_CANADA.reading.minutes);
  });
});

describe('mock review items', () => {
  const q = (id: string, answer: number): MockQuestion =>
    ({ id, question: `Q ${id}`, options: ['a', 'b', 'c'], answer, explanation: `E ${id}`, band: 'A2' }) as MockQuestion;

  it('lists wrong and unanswered questions with the picked option', () => {
    const questions = [q('1', 0), q('2', 1), q('3', 2), q('4', 0)];
    const items = reviewItems(questions, [
      { questionId: '1', picked: 0 },
      { questionId: '2', picked: 2 },
      { questionId: '3', picked: null },
    ]);
    expect(items).toEqual([
      { questionId: '2', question: 'Q 2', yours: 'c', correct: 'b', explanation: 'E 2', band: 'A2' },
      { questionId: '3', question: 'Q 3', yours: null, correct: 'c', explanation: 'E 3', band: 'A2' },
      { questionId: '4', question: 'Q 4', yours: null, correct: 'a', explanation: 'E 4', band: 'A2' },
    ]);
  });
});

describe('speaking self-check', () => {
  it('has five criteria for each speaking task', () => {
    expect(Object.keys(SPEAKING_CRITERIA).sort()).toEqual(['entretien', 'interaction', 'opinion']);
    for (const list of Object.values(SPEAKING_CRITERIA)) expect(list).toHaveLength(5);
  });
});

/**
 * @jest-environment node
 */
import type { Sentence, VocabItem } from '../../domain/content-types';
import { realBundle, setupRealContent } from '../../test-utils/real-content';
import { MAX_REORDER_TOKENS, sentenceMeaningQuiz, sentenceReorderQuiz, wordMeaningQuiz } from '../daily/daily-tests';
import { countWords, findListening, findReading, findSpeaking, findWriting, formatClock, unitIdOf } from '../skills/skill-items';

const u01 = realBundle.units[0];
const [mk1, mk2] = realBundle.mockTests;

describe('skill item lookup', () => {
  it('reads the unit out of an item id', () => {
    expect(unitIdOf('u03-li01')).toBe('u03');
    expect(unitIdOf('mk1-li01')).toBeNull();
    expect(unitIdOf('')).toBeNull();
  });

  it('finds unit items directly and mock items inside their mock', async () => {
    const { content } = await setupRealContent();
    expect((await findListening(content, u01.listening[0].id))?.id).toBe(u01.listening[0].id);
    expect((await findListening(content, mk2.listening[0].id))?.id).toBe(mk2.listening[0].id);
    expect((await findReading(content, u01.reading[0].id))?.text).toBe(u01.reading[0].text);
    expect((await findReading(content, mk1.reading[0].id))?.id).toBe(mk1.reading[0].id);
    expect((await findWriting(content, u01.writing[0].id))?.id).toBe(u01.writing[0].id);
    expect((await findWriting(content, mk2.writing[0].id))?.id).toBe(mk2.writing[0].id);
    expect((await findSpeaking(content, u01.speaking[0].id))?.id).toBe(u01.speaking[0].id);
    expect((await findSpeaking(content, mk1.speaking[2].id))?.id).toBe(mk1.speaking[2].id);
  });

  it('looks only inside the given mock when one is named', async () => {
    const { content } = await setupRealContent();
    expect((await findWriting(content, mk1.writing[0].id, 'mk1'))?.id).toBe(mk1.writing[0].id);
    expect(await findWriting(content, mk1.writing[0].id, 'mk2')).toBeNull();
    expect((await findSpeaking(content, mk2.speaking[0].id, 'mk2'))?.id).toBe(mk2.speaking[0].id);
    expect(await findSpeaking(content, mk2.speaking[0].id, 'missing-mock')).toBeNull();
  });

  it('returns null for unknown ids', async () => {
    const { content } = await setupRealContent();
    expect(await findListening(content, 'nope')).toBeNull();
    expect(await findReading(content, 'nope')).toBeNull();
    expect(await findWriting(content, 'nope')).toBeNull();
    expect(await findSpeaking(content, 'nope')).toBeNull();
  });

  it('formats a clock and re-exports the word counter', () => {
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(59.2)).toBe('1:00');
    expect(formatClock(-3)).toBe('0:00');
    expect(countWords('Je suis là')).toBe(3);
  });
});

const word = (id: string, fr: string, en: string): VocabItem =>
  ({ id, fr, en, pos: 'noun', gender: 'f', level: 'A2', core: true, example: { fr: `Une ${fr}.`, en: `A ${en}.` } }) as VocabItem;

const sentence = (id: string, fr: string, en: string): Sentence => ({ id, fr, en, grammarNote: 'note', grammarTag: 'present', level: 'A2' });

describe('daily tests', () => {
  const target = word('w1', 'clé', 'key');
  const others = [target, word('w2', 'porte', 'door'), word('w3', 'table', 'table'), word('w4', 'chaise', 'chair'), word('w5', 'lampe', 'lamp'), word('w6', 'clef', 'key')];

  it('asks for a word meaning with three distinct distractors', () => {
    const quiz = wordMeaningQuiz(target, others, 'seed');
    expect(quiz).toMatchObject({ id: 'daily-w1', type: 'mcq', prompt: 'What does « la clé » mean?', explanation: 'Une clé. — A key.' });
    expect(quiz.options).toHaveLength(4);
    expect(new Set(quiz.options).size).toBe(4);
    expect(quiz.options.filter((o) => o === 'key')).toHaveLength(1);
    expect(quiz.options[quiz.answer]).toBe('key');
    expect(wordMeaningQuiz(target, others, 'seed')).toEqual(quiz);
  });

  it('still works when the unit has no other words', () => {
    const quiz = wordMeaningQuiz(target, [target], 's');
    expect(quiz.options).toEqual(['key']);
    expect(quiz.answer).toBe(0);
  });

  it('builds a reorder quiz only for sentences of a phone-friendly length', () => {
    expect(sentenceReorderQuiz(sentence('s1', 'Je  mange une pomme.', 'I eat an apple.'))).toEqual({
      id: 'daily-s1',
      type: 'reorder',
      level: 'A2',
      skill: 'structures',
      grammarTag: 'present',
      prompt: 'Rebuild the sentence of the day',
      tokens: ['Je', 'mange', 'une', 'pomme.'],
      translation: 'I eat an apple.',
      explanation: 'note',
    });
    expect(sentenceReorderQuiz(sentence('s2', 'Bonjour toi', 'Hi you'))).toBeNull();
    const long = Array.from({ length: MAX_REORDER_TOKENS + 1 }, (_, i) => `m${i}`).join(' ');
    expect(sentenceReorderQuiz(sentence('s3', long, 'long'))).toBeNull();
  });

  it('falls back to picking the right translation from other sentences', () => {
    const s = sentence('s1', 'Il pleut.', 'It is raining.');
    const pool = [s, sentence('s2', 'Il neige.', 'It is snowing.'), sentence('s3', 'Il vente.', 'It is windy.'), sentence('s4', 'Il fait chaud.', 'It is hot.')];
    const quiz = sentenceMeaningQuiz(s, pool, 'seed');
    expect(quiz).toMatchObject({ id: 'daily-s1', prompt: 'Which translation is right?', promptFr: 'Il pleut.', explanation: 'note' });
    expect(quiz.options).toHaveLength(3);
    expect(quiz.options[quiz.answer]).toBe('It is raining.');
  });
});

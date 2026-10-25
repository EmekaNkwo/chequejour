import type { Exercise } from '../content-types';
import { canonicalAnswer, checkChoice, checkMatch, checkReorder, checkTyped, joinTokens, normalize, promptText } from '../answers';

describe('normalize', () => {
  it('ignores case, spacing, punctuation and apostrophe style', () => {
    expect(normalize('  Je  m’appelle   Paul ! ')).toBe("je m'appelle paul");
    expect(normalize("J ' ai faim.")).toBe("j'ai faim");
    expect(normalize('Oui, bien sûr ? Allons-y.')).toBe('oui bien sûr allons-y');
    expect(normalize('« Bonjour », dit-il.')).toBe('bonjour dit-il');
  });
});

describe('checkTyped', () => {
  it('accepts any listed answer', () => {
    expect(checkTyped('sommes allées', ['sommes allés', 'sommes allées']).result).toBe('correct');
  });
  it('flags accent-only mistakes as almost', () => {
    const out = checkTyped('ete', ['été']);
    expect(out.result).toBe('almost');
    expect(out.expected).toBe('été');
    expect(out.note).toMatch(/accents/);
  });
  it('rejects wrong and empty answers', () => {
    expect(checkTyped('avons allé', ['sommes allés']).result).toBe('wrong');
    expect(checkTyped('   ', ['oui']).result).toBe('wrong');
  });
  it('treats œ as oe for accent tolerance', () => {
    expect(checkTyped('soeur', ['sœur']).result).toBe('almost');
  });
});

describe('choices, reorder and match', () => {
  it('checks multiple choice', () => {
    expect(checkChoice(1, 1, ['a', 'b']).result).toBe('correct');
    expect(checkChoice(0, 1, ['a', 'b'])).toEqual({ result: 'wrong', expected: 'b' });
  });
  it('joins elided tokens without a space', () => {
    expect(joinTokens(["J'", 'habite', 'à', 'Lyon'])).toBe("J'habite à Lyon");
  });
  it('checks reorder by sentence', () => {
    expect(checkReorder(['je', 'vais', 'bien'], ['je', 'vais', 'bien']).result).toBe('correct');
    expect(checkReorder(['vais', 'je', 'bien'], ['je', 'vais', 'bien']).result).toBe('wrong');
  });
  it('checks matching', () => {
    expect(checkMatch({ 0: 0, 1: 1, 2: 2 }, 3).result).toBe('correct');
    expect(checkMatch({ 0: 1, 1: 0, 2: 2 }, 3).result).toBe('wrong');
    expect(checkMatch({ 0: 0, 1: 1 }, 3).result).toBe('wrong');
  });
});

describe('canonicalAnswer and promptText', () => {
  const base = { id: 'x', level: 'A2', skill: 'structures', grammarTag: 'present', explanation: 'e' } as const;
  const cases: Exercise[] = [
    { ...base, type: 'mcq', prompt: 'p', promptFr: 'Il ___', options: ['a', 'b'], answer: 1 },
    { ...base, type: 'fill_blank', prompt: 'p', sentence: 'Je ___ ici.', answers: ['suis'], translation: 't' },
    { ...base, type: 'conjugation', verb: 'être', tense: 'présent', person: 'nous', answers: ['sommes'] },
    { ...base, type: 'reorder', prompt: 'p', tokens: ["l'", 'eau'], translation: 'water' },
    { ...base, type: 'match', prompt: 'p', pairs: [{ left: 'chat', right: 'cat' }] },
    { ...base, type: 'translate', direction: 'en-fr', source: 'cat', answers: ['chat'] },
    { ...base, type: 'dictation', text: 'Bonjour.', translation: 'Hello.' },
  ];
  it('produces a readable answer for every type', () => {
    expect(cases.map(canonicalAnswer)).toEqual(['b', 'Je suis ici.', 'nous sommes', "l'eau", 'chat → cat', 'chat', 'Bonjour.']);
  });
  it('produces a prompt for every type', () => {
    expect(cases.map(promptText).every((t) => t.length > 0)).toBe(true);
  });
});

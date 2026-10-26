import { checkConjugation } from '../exercises/conjugation-check';
import { diffWords } from '../exercises/dictation-diff';
import { checkTranslation } from '../exercises/translation-check';

describe('dictation diff', () => {
  it('marks every word right when the sentence matches, ignoring case and punctuation', () => {
    expect(diffWords('Il fait beau.', 'il fait beau').map((t) => t.status)).toEqual(['ok', 'ok', 'ok']);
  });
  it('separates accent-only slips from wrong, missing and extra words', () => {
    expect(diffWords("Nous sommes allés à l'école hier.", 'nous somme alles a école hier matin')).toEqual([
      { word: 'Nous', status: 'ok' },
      { word: 'sommes', status: 'wrong', typed: 'somme' },
      { word: 'allés', status: 'accent', typed: 'alles' },
      { word: 'à', status: 'accent', typed: 'a' },
      { word: "l'école", status: 'wrong', typed: 'école' },
      { word: 'hier', status: 'ok' },
      { word: 'matin', status: 'extra' },
    ]);
  });
  it('reports words the learner left out', () => {
    expect(diffWords('Je ne sais pas.', 'je sais pas')).toEqual([
      { word: 'Je', status: 'ok' },
      { word: 'ne', status: 'missing' },
      { word: 'sais', status: 'ok' },
      { word: 'pas', status: 'ok' },
    ]);
  });
});

describe('conjugation check', () => {
  const ex = { person: 'nous', answers: ['sommes allés', 'sommes allées'] };
  it('accepts the form with or without the subject pronoun', () => {
    expect(checkConjugation('sommes allées', ex).result).toBe('correct');
    expect(checkConjugation('nous sommes allés', ex).result).toBe('correct');
  });
  it('handles elided pronouns and keeps the accent rule', () => {
    const je = { person: 'je', answers: ['ai été'] };
    expect(checkConjugation("j'ai été", je).result).toBe('correct');
    expect(checkConjugation("j'ai ete", je)).toMatchObject({ result: 'almost', expected: 'ai été' });
    expect(checkConjugation('suis été', je).result).toBe('wrong');
  });
  it('accepts reflexive forms with the person typed', () => {
    expect(checkConjugation('je me lève', { person: 'je', answers: ['me lève'] }).result).toBe('correct');
  });
});

describe('translation check', () => {
  it('accepts any listed answer and English contractions either way', () => {
    const answers = ["I'm going to the market", 'I am going to the market'];
    expect(checkTranslation('i am going to the market.', answers, 'fr-en').result).toBe('correct');
    expect(checkTranslation("I don't know", ['I do not know'], 'fr-en').result).toBe('correct');
    expect(checkTranslation("It's late", ['It is late'], 'fr-en').result).toBe('correct');
  });
  it('does not ignore a changed article, and keeps the accent rule into French', () => {
    expect(checkTranslation('I like the cats', ['I like cats'], 'fr-en').result).toBe('wrong');
    expect(checkTranslation('je vais au marche', ['Je vais au marché.'], 'en-fr')).toMatchObject({ result: 'almost' });
  });
});

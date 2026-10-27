import { diffWords } from '../exercises/dictation-diff';

describe('lining up words that were heard differently', () => {
  it('pairs a word with a near miss rather than with an unrelated word', () => {
    const tokens = diffWords(
      "Je prends le bus tous les matins parce que je n'ai pas de voiture.",
      "Je prends le métro tous les soirs par ce que je n'ai pas de vel.",
    );
    const changed = tokens.filter((t) => t.status !== 'ok').map((t) => [t.word, t.status, t.typed ?? '']);
    expect(changed).toEqual([
      ['bus', 'wrong', 'métro'],
      ['matins', 'wrong', 'soirs'],
      ['parce', 'wrong', 'par'],
      ['ce', 'extra', ''],
      ['voiture', 'wrong', 'vel'],
    ]);
  });

  it('still reports a word that only lacks accents as an accent slip', () => {
    expect(diffWords('Il a été là.', 'Il a ete la.').filter((t) => t.status === 'accent').map((t) => t.word)).toEqual(['été', 'là']);
  });
});

import { classifyEdit, textEdits } from '../ai/text-edits';

describe('finding what a corrected text changed', () => {
  it('lists each changed stretch of words, ignoring unchanged text', () => {
    const before = 'Hier, je suis alle au cinema avec le ami de ma soeur.';
    const after = 'Hier, je suis allé au cinéma avec l’ami de ma sœur.';
    expect(textEdits(before, after).map((e) => [e.original, e.corrected])).toEqual([
      ['alle', 'allé'],
      ['cinema', 'cinéma'],
      ['le ami', 'l’ami'],
      ['soeur', 'sœur'],
    ]);
  });

  it('ignores punctuation, capitals, apostrophe style and spacing the model tidied', () => {
    expect(textEdits("C'est bien. A bientôt, Paul", 'C’est bien.  À bientôt, Paul.')).toEqual([]);
  });

  it('copies the learner’s own words for the original, so the app can quote them', () => {
    const [edit] = textEdits('Nous  avons resté jusqu’à minuit.', 'Nous sommes restés jusqu’à minuit.');
    expect(edit).toMatchObject({ original: 'avons resté', corrected: 'sommes restés' });
  });

  it('shows a short word with the word after it, so the learner can find it', () => {
    const edits = textEdits('Toute la famille était dans le maison en Montréal.', 'Toute la famille était dans la maison à Montréal.');
    expect(edits.map((e) => [e.original, e.corrected])).toEqual([
      ['le maison', 'la maison'],
      ['en Montréal', 'à Montréal'],
    ]);
  });

  it('reports nothing for a copied text', () => {
    const text = 'Le film était très bien.';
    expect(textEdits(text, text)).toEqual([]);
  });
});

describe('naming the kind of mistake', () => {
  it.each([
    ['alle', 'allé', 'accent'],
    ['grand-mere', 'grand-mère', 'accent'],
    ['soeur', 'sœur', 'accent'],
    ['le anniversaire', 'l’anniversaire', 'elision'],
    ['je etais', 'j’étais', 'elision'],
    ['le apres-midi', "l'après-midi", 'elision'],
    ['le maison', 'la maison', 'gender'],
    ['une', 'un', 'gender'],
    ['en Montréal', 'à Montréal', 'preposition'],
    ['des', 'de', 'preposition'],
    ['avons resté', 'sommes restés', 'auxiliary'],
    ['sont jouer', 'ont joué', 'auxiliary'],
    ['fatigué', 'fatiguée', 'agreement'],
    ['mangés', 'mangé', 'agreement'],
    ['venu', 'venus', 'agreement'],
    ['jouer', 'joué', 'verb-form'],
    ['grand', 'grande', 'agreement'],
  ])('%s → %s is %s', (original, corrected, kind) => {
    expect(classifyEdit(original, corrected)).toBe(kind);
  });

  it.each([
    ['danse', 'dané'],
    ['tout le', 'tout le long de l’'],
    ['content', 'heureux'],
    ['je étais', 'je étais'],
  ])('does not explain %s → %s, which fits no rule', (original, corrected) => {
    expect(classifyEdit(original, corrected)).toBeNull();
  });
});

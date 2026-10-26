import {
  agreementSlips,
  connectorsUsed,
  elisionSlips,
  hasGreeting,
  hasSignOff,
  missingAccents,
  nounGenderMap,
  repeatedWords,
  tensesUsed,
  writingHints,
} from '../writing/hints';

const GENDERS = new Map<string, 'm' | 'f'>([
  ['problème', 'm'],
  ['voiture', 'f'],
  ['porte', 'f'],
  ['journée', 'f'],
  ['matin', 'm'],
]);

describe('missing accents', () => {
  it('suggests the accented form of common words, keeping capitals', () => {
    expect(missingAccents('Je suis tres content. Ca va, Deja fini ?')).toEqual([
      { word: 'tres', fix: 'très' },
      { word: 'Ca', fix: 'Ça' },
      { word: 'Deja', fix: 'Déjà' },
    ]);
  });
  it('ignores correct text and ambiguous words like a, ou, la', () => {
    expect(missingAccents('Il a très faim, ou il est déjà là.')).toEqual([]);
  });
  it('lists each word once', () => {
    expect(missingAccents('tres tres tres')).toEqual([{ word: 'tres', fix: 'très' }]);
  });
});

describe('elision slips', () => {
  it('flags je ai, Je habite, de un, que il and si il, keeping capitals', () => {
    expect(elisionSlips('Je suis Paul et je ai 30 ans. Je habite à Ottawa.')).toEqual([
      { phrase: 'je ai', fix: "j'ai" },
      { phrase: 'Je habite', fix: "J'habite" },
    ]);
    expect(elisionSlips('Il pense que il a besoin de un vélo, si il pleut.')).toEqual([
      { phrase: 'que il', fix: "qu'il" },
      { phrase: 'de un', fix: "d'un" },
      { phrase: 'si il', fix: "s'il" },
    ]);
    expect(elisionSlips('Je ne y vais pas.')).toEqual([{ phrase: 'ne y', fix: "n'y" }]);
  });

  it('leaves correct text, aspirated h, numbers and words split by punctuation alone', () => {
    expect(elisionSlips("J'ai faim, je n'habite pas ici et l'hôtel est loin.")).toEqual([]);
    expect(elisionSlips('Le héros a honte : la haine, le hockey, le haricot, le onze.')).toEqual([]);
    expect(elisionSlips('Je veux que. Il part. Si elle vient, le yaourt est là.')).toEqual([]);
  });
});

describe('agreement slips', () => {
  it('flags a feminine determiner before a masculine noun and the reverse', () => {
    expect(agreementSlips('Il y a la problème avec un voiture.', GENDERS)).toEqual([
      { phrase: 'la problème', fix: 'le problème' },
      { phrase: 'un voiture', fix: 'une voiture' },
    ]);
  });
  it('leaves object pronouns alone (il la porte)', () => {
    expect(agreementSlips('Il le porte tous les jours.', GENDERS)).toEqual([]);
  });
  it('accepts correct pairs and unknown nouns', () => {
    expect(agreementSlips('Une belle journée, le matin, la porte, la gnognote.', GENDERS)).toEqual([]);
  });
});

describe('noun gender map', () => {
  it('keeps single-word nouns and drops ones listed with both genders', () => {
    const map = nounGenderMap([
      { fr: 'livre', gender: 'm' },
      { fr: 'Livre', gender: 'f' },
      { fr: 'porte', gender: 'f' },
      { fr: 'emploi du temps', gender: 'm' },
      { fr: 'élève', gender: 'mf' },
      { fr: 'matin', gender: 'm' },
      { fr: 'matin', gender: 'm' },
    ]);
    expect([...map]).toEqual([
      ['porte', 'f'],
      ['matin', 'm'],
    ]);
  });
});

describe('connectors', () => {
  it('finds linking words once each, including multi-word ones', () => {
    expect(connectorsUsed("D'abord, il pleut. Ensuite il fait beau, alors que hier... Cependant, ensuite.")).toEqual(["d'abord", 'ensuite', 'alors que', 'cependant']);
  });
});

describe('tenses', () => {
  it('spots passé composé, imparfait, futur and conditionnel', () => {
    expect(tensesUsed('Hier je suis allé au parc. Il faisait beau.')).toEqual(['passé composé', 'imparfait']);
    expect(tensesUsed('Demain nous partirons. Je voudrais venir.')).toEqual(['futur', 'conditionnel']);
  });
  it('does not mistake common non-verbs for imparfait', () => {
    expect(tensesUsed('Mais je parle français et anglais, jamais en questions.')).toEqual([]);
  });
});

describe('repeated words', () => {
  it('reports content words used three times or more, most frequent first', () => {
    expect(repeatedWords('vraiment vraiment super vraiment. Super super super. La la la la.')).toEqual([
      { word: 'super', count: 4 },
      { word: 'vraiment', count: 3 },
    ]);
  });
});

describe('greeting and sign-off', () => {
  it('recognises greetings and closings with or without accents', () => {
    expect(hasGreeting('Bonjour à tous, ...')).toBe(true);
    expect(hasGreeting('Chère Léa,\nmerci')).toBe(true);
    expect(hasGreeting('Je vous écris pour...')).toBe(false);
    expect(hasSignOff('... Merci. A bientot, Emeka')).toBe(true);
    expect(hasSignOff('... Bises\nLéa')).toBe(true);
    expect(hasSignOff('Je viendrai samedi.')).toBe(false);
  });
});

describe('writingHints', () => {
  it('gives a message task tips on greeting, sign-off and accents, all marked possible', () => {
    const hints = writingHints('Je suis tres content de vous inviter samedi.', { taskType: 'message', nounGenders: GENDERS });
    expect(hints.map((h) => h.kind)).toEqual(['accent', 'connectors', 'greeting', 'signoff']);
    expect(hints.every((h) => h.message.startsWith('Possible') || h.tone === 'ok')).toBe(true);
  });
  it('praises enough connectors and asks a narrative for past tenses', () => {
    const hints = writingHints("D'abord je suis arrivé. Ensuite nous avons mangé.", { taskType: 'description', nounGenders: GENDERS });
    expect(hints.find((h) => h.kind === 'connectors')).toMatchObject({ tone: 'ok' });
    expect(hints.find((h) => h.kind === 'tenses')).toMatchObject({ tone: 'tip' });
    expect(hints.find((h) => h.kind === 'tenses')?.message).toMatch(/imparfait/);
  });
  it('returns nothing for empty text', () => {
    expect(writingHints('  ', { taskType: 'opinion', nounGenders: GENDERS })).toEqual([]);
  });
});

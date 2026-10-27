import { WORD_EXAMPLES_SCHEMA, checkWordExamples, findWordForm, gapSentence, wordExamplesMessages, type ExampleWord } from '../ai/word-examples';

const lever: ExampleWord = { fr: 'se lever', en: 'to get up', pos: 'verb', level: 'A2', example: { fr: 'Je me lève à sept heures.', en: 'I get up at seven.' } };
const reveil: ExampleWord = { fr: 'réveil', en: 'alarm clock', pos: 'noun', level: 'A1', example: { fr: 'Mon réveil sonne.', en: 'My alarm rings.' } };
const heure: ExampleWord = { fr: "à l'heure", en: 'on time', pos: 'expression', level: 'A1', example: { fr: 'Le train est à l’heure.', en: 'The train is on time.' } };

const rejected = (fn: () => unknown) => {
  try {
    fn();
    return false;
  } catch (e: unknown) {
    return (e as { failure?: string }).failure === 'rejected';
  }
};

describe('finding the word in a sentence', () => {
  it('finds conjugated verbs by their stem, ignoring accents and case', () => {
    expect(findWordForm('Demain, nous nous levons tôt.', lever)).toBe('levons');
    expect(findWordForm('Elle se lève toujours la première.', lever)).toBe('lève');
  });

  it('finds nouns and their plurals', () => {
    expect(findWordForm('Les réveils sont bruyants.', reveil)).toBe('réveils');
    expect(findWordForm('Réveil cassé, quelle journée !', reveil)).toBe('Réveil');
  });

  it('finds expressions as a whole, whatever the apostrophe', () => {
    expect(findWordForm('Il arrive toujours à l’heure au travail.', heure)).toBe('à l’heure');
    expect(findWordForm('Il est huit heures.', heure)).toBeNull();
  });

  it('returns null when the word is absent', () => {
    expect(findWordForm('Je prends le bus.', lever)).toBeNull();
  });

  it('blanks the word out for practice, at its own position', () => {
    expect(gapSentence('Elle se lève tôt.', 'lève')).toBe('Elle se ____ tôt.');
    expect(gapSentence('Elle le prend.', 'le', 5)).toBe('Elle ____ prend.');
  });

  it('matches short headwords only as whole words', () => {
    const a = { fr: 'à', pos: 'preposition' as const };
    expect(findWordForm('Je vais avec elle à Laval.', a)).toBe('à');
    expect(findWordForm('Je vais avec elle.', a)).toBeNull();
    expect(findWordForm('Mon avocat est là.', { fr: 'avoir', pos: 'verb' })).toBeNull();
  });
});

describe('word example prompt and checks', () => {
  it('asks for level-appropriate sentences using the word', () => {
    const [system, user] = wordExamplesMessages(lever);
    expect(system.content).toMatch(/level A2/);
    expect(user.content).toContain('se lever');
    expect(user.content).toContain('to get up');
  });

  it('allows at most three examples', () => {
    const four = Array.from({ length: 4 }, () => ({ fr: 'a', en: 'b' }));
    expect(WORD_EXAMPLES_SCHEMA.safeParse({ examples: four }).success).toBe(false);
  });

  it('keeps sound examples with the form found, and drops the rest', () => {
    const out = checkWordExamples(
      {
        examples: [
          { fr: 'Le dimanche, je me lève tard.', en: 'On Sundays I get up late.' },
          { fr: 'Je prends le bus pour aller au travail.', en: 'I take the bus to work.' },
          { fr: 'Je me lève à sept heures.', en: 'I get up at seven.' },
          { fr: 'I get up early on Mondays because of work.', en: 'I get up early.' },
        ],
      },
      lever,
    );
    expect(out).toEqual([{ fr: 'Le dimanche, je me lève tard.', en: 'On Sundays I get up late.', form: 'lève', start: 19 }]);
  });

  it('rejects the answer when no example survives', () => {
    expect(rejected(() => checkWordExamples({ examples: [{ fr: 'Je prends le bus.', en: 'I take the bus.' }] }, lever))).toBe(true);
  });
});

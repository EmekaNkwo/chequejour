import type { ListeningItem, Sentence, VocabItem } from '../content-types';
import { shadowLines } from '../shadowing';

const word = { id: 'u01-w001', fr: 'réveil', en: 'alarm clock', pos: 'noun', gender: 'm', level: 'A2', core: true, example: { fr: 'Mon réveil sonne.', en: 'My alarm rings.' } } as VocabItem;
const sentence = { id: 's001', fr: 'Il fait beau.', en: 'The weather is nice.' } as Sentence;
const listening = { id: 'u01-li01', lines: [{ speaker: 'Léa', fr: 'Bonjour !' }, { speaker: 'Tom', fr: 'Salut, ça va ?' }] } as ListeningItem;

describe('shadowing lines', () => {
  it('shadows a word, then its example sentence', () => {
    expect(shadowLines({ kind: 'word', word })).toEqual([
      { key: 'u01-w001', fr: 'le réveil', en: 'alarm clock' },
      { key: 'u01-w001-ex', fr: 'Mon réveil sonne.', en: 'My alarm rings.' },
    ]);
  });
  it('shadows a sentence', () => {
    expect(shadowLines({ kind: 'sentence', sentence })).toEqual([{ key: 's001', fr: 'Il fait beau.', en: 'The weather is nice.' }]);
  });
  it('shadows a listening text line by line, with its own clip per line', () => {
    expect(shadowLines({ kind: 'listening', item: listening })).toEqual([
      { key: 'u01-li01-l1', fr: 'Bonjour !', speaker: 'Léa' },
      { key: 'u01-li01-l2', fr: 'Salut, ça va ?', speaker: 'Tom' },
    ]);
  });
});

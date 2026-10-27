/**
 * Shadowing: hear a line, say it straight after, then hear the original and yourself
 * back to back. Each source becomes a list of short lines with their audio clip.
 */
import { audioKey, headword } from './audio-keys';
import type { ListeningItem, Sentence, VocabItem } from './content-types';

export interface ShadowLine {
  key: string;
  fr: string;
  en?: string;
  speaker?: string;
}

export type ShadowSource = { kind: 'word'; word: VocabItem } | { kind: 'sentence'; sentence: Sentence } | { kind: 'listening'; item: ListeningItem };

export function shadowLines(source: ShadowSource): ShadowLine[] {
  switch (source.kind) {
    case 'word':
      return [
        { key: audioKey.word(source.word.id), fr: headword(source.word), en: source.word.en },
        { key: audioKey.example(source.word.id), fr: source.word.example.fr, en: source.word.example.en },
      ];
    case 'sentence':
      return [{ key: audioKey.sentence(source.sentence.id), fr: source.sentence.fr, en: source.sentence.en }];
    case 'listening':
      return source.item.lines.map((l, i) => ({ key: audioKey.listeningLine(source.item.id, i), fr: l.fr, speaker: l.speaker }));
  }
}

/** Recordings for a shadowed line are stored under this task id. */
export const shadowTaskId = (lineKey: string): string => `shadow:${lineKey}`;

/**
 * Every spoken piece of content has a stable audio key. Bundled clips are named
 * `<key>.m4a` in assets/audio; when a clip is missing the app falls back to
 * on-device text-to-speech with the same text.
 */
import type { ContentBundle, Gender, VocabItem } from './content-types';

export interface AudioClip {
  key: string;
  text: string;
}

/** Common nouns starting with an aspirated h, which block elision (le hasard, not l'hasard). */
const ASPIRATED_H = [
  'hache',
  'haie',
  'hall',
  'halte',
  'hamac',
  'hamburger',
  'hamster',
  'hanche',
  'handicap',
  'hangar',
  'hareng',
  'haricot',
  'harpe',
  'hasard',
  'hâte',
  'hausse',
  'haut',
  'hauteur',
  'hérisson',
  'héros',
  'hibou',
  'hiérarchie',
  'hockey',
  'homard',
  'honte',
  'hors-d',
  'hublot',
  'huit',
  'hurlement',
];

const VOWEL_START = /^[aeiouyàâäéèêëîïôöùûüœæ]/i;

export function startsWithElision(word: string): boolean {
  const lower = word.toLowerCase();
  if (VOWEL_START.test(lower)) return true;
  if (!lower.startsWith('h')) return false;
  return !ASPIRATED_H.some((h) => lower.startsWith(h));
}

/** Definite article for a noun: "le", "la", "l'" or "le/la". */
export function definiteArticle(word: string, gender: Gender | undefined): string {
  if (startsWithElision(word)) return "l'";
  if (gender === 'f') return 'la';
  if (gender === 'mf') return 'le/la';
  return 'le';
}

/** Headword as displayed and spoken, with an article for nouns. */
export function headword(item: Pick<VocabItem, 'fr' | 'pos' | 'gender' | 'pluralOnly'>): string {
  if (item.pos !== 'noun') return item.fr;
  if (item.pluralOnly) return `les ${item.fr}`;
  const article = definiteArticle(item.fr, item.gender);
  if (article === "l'") return `l'${item.fr}`;
  if (article === 'le/la') return `le / la ${item.fr}`;
  return `${article} ${item.fr}`;
}

export const audioKey = {
  word: (id: string): string => id,
  example: (id: string): string => `${id}-ex`,
  sentence: (id: string): string => id,
  listening: (id: string): string => id,
  dictation: (id: string): string => id,
  model: (id: string): string => `${id}-model`,
};

/** Text spoken for a listening item: one line per speaker turn. */
export function listeningScript(lines: readonly { fr: string }[]): string {
  return lines.map((l) => l.fr).join('\n');
}

/** Every clip the content needs, used by the audio generator and validator. */
export function collectAudioClips(bundle: ContentBundle): AudioClip[] {
  const clips: AudioClip[] = [];
  for (const unit of bundle.units) {
    for (const v of unit.vocab) {
      clips.push({ key: audioKey.word(v.id), text: headword(v) });
      clips.push({ key: audioKey.example(v.id), text: v.example.fr });
    }
    for (const l of unit.listening) {
      clips.push({ key: audioKey.listening(l.id), text: listeningScript(l.lines) });
    }
    for (const e of [...unit.exercises, ...unit.checkpoint]) {
      if (e.type === 'dictation') clips.push({ key: audioKey.dictation(e.id), text: e.text });
    }
    for (const s of unit.speaking) {
      clips.push({ key: audioKey.model(s.id), text: s.modelAnswer });
    }
  }
  for (const s of bundle.sentences) {
    clips.push({ key: audioKey.sentence(s.id), text: s.fr });
  }
  for (const m of bundle.mockTests) {
    for (const section of m.sections) {
      for (const l of section.listening ?? []) {
        clips.push({ key: audioKey.listening(l.id), text: listeningScript(l.lines) });
      }
    }
  }
  return clips;
}

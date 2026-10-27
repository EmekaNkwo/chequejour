/**
 * Tidies what the recognizer heard before a learner sees it: stray spaces, and any sound
 * tags or invented subtitle credits (some speech models write them on silence).
 */
import { countWords } from '../writing/word-count';

const SOUND_TAG = /\[[^\]]*\]|\([^)]*\)/g;
/** Subtitle credits a speech model may invent for quiet audio, to the end of the text. */
const CREDITS = /\s*sous-titr(?:es|age)\b(?:\s+(?:réalisés|fait|faits)\b.*|\s+ST\b.*|\s+par\b.*|\s+para\b.*)$/i;

export function cleanTranscript(raw: string): string {
  return raw.replace(SOUND_TAG, ' ').replace(/\s+/g, ' ').trim().replace(CREDITS, '').trim();
}

const BASE_MS = 30_000;
/** Phones run the model at roughly real time or better; twice the audio length is generous. */
const PER_AUDIO_MS = 2;
const MAX_MS = 10 * 60_000;

export function sttTimeoutMs(audioMs: number): number {
  return Math.min(MAX_MS, BASE_MS + audioMs * PER_AUDIO_MS);
}

export interface SpeechPace {
  words: number;
  /** null when there is too little to measure. */
  wordsPerMinute: number | null;
}

export function speechPace(transcript: string, durationMs: number): SpeechPace {
  const words = countWords(transcript);
  if (words === 0 || durationMs <= 0) return { words, wordsPerMinute: null };
  return { words, wordsPerMinute: Math.round(words / (durationMs / 60_000)) };
}

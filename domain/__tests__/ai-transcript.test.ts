import { cleanTranscript, speechPace, sttTimeoutMs } from '../ai/transcript';

describe('cleaning what the speech model heard', () => {
  it('trims and joins segments into one line', () => {
    expect(cleanTranscript('  Bonjour,\n je   m’appelle Ada.  ')).toBe('Bonjour, je m’appelle Ada.');
  });

  it('drops sound tags such as [Musique] and (rires)', () => {
    expect(cleanTranscript('[Musique] Je suis là (rires)')).toBe('Je suis là');
    expect(cleanTranscript('[BLANK_AUDIO]')).toBe('');
  });

  it('drops the subtitle credits Whisper invents on silence', () => {
    expect(cleanTranscript('Sous-titres réalisés par la communauté d’Amara.org')).toBe('');
    expect(cleanTranscript("Merci. Sous-titrage ST' 501")).toBe('Merci.');
    expect(cleanTranscript('Sous-titres réalisés para la communauté d\'Amara.org')).toBe('');
  });

  it('keeps normal French untouched', () => {
    expect(cleanTranscript('Les sous-titres du film étaient bons.')).toBe('Les sous-titres du film étaient bons.');
  });
});

describe('time limit for a transcription', () => {
  it('gives a base allowance plus time per second of audio', () => {
    expect(sttTimeoutMs(0)).toBe(30_000);
    expect(sttTimeoutMs(60_000)).toBe(30_000 + 120_000);
  });

  it('is capped for very long recordings', () => {
    expect(sttTimeoutMs(60 * 60_000)).toBe(10 * 60_000);
  });
});

describe('speaking pace from a transcript', () => {
  it('counts words and words per minute', () => {
    expect(speechPace('Je pense que c’est une bonne idée .', 30_000)).toEqual({ words: 7, wordsPerMinute: 14 });
  });

  it('has no pace for an empty or zero-length take', () => {
    expect(speechPace('', 30_000)).toEqual({ words: 0, wordsPerMinute: null });
    expect(speechPace('Bonjour', 0)).toEqual({ words: 1, wordsPerMinute: null });
  });
});

import { EXPLANATIONS, checkWritingFeedback, partialWritingCorrections, writingFeedbackMessages, writingMaxChars, writingMaxTokens, type WritingFeedbackInput } from '../ai/writing-feedback';

const text =
  'Bonjour Karim, le week-end dernier, nous avons fêté la naissance de mon neveu en Montréal. Toute la famille était là dans le maison de ma soeur. Ma soeur était fatigué mais très heureuse. Je suis rentre tres tard. Nous sommes content.';
const input: WritingFeedbackInput = { taskType: 'message', level: 'A2', promptFr: 'Racontez un événement familial.', minWords: 60, maxWords: 120, text };

describe('writing feedback prompt', () => {
  it('asks for a corrected copy, with one worked example as a real exchange', () => {
    const messages = writingFeedbackMessages(input);
    expect(messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(messages[0].content).toMatch(/corrected text only/);
    expect(messages[3].content).toBe(text);
  });

  it('leaves room for a copy as long as the text, and little more', () => {
    expect(writingMaxTokens('un deux trois')).toBeGreaterThan(6);
    expect(writingMaxChars(text)).toBeLessThan(text.length * 1.5 + 50);
  });
});

describe('turning the corrected copy into feedback', () => {
  const corrected =
    'Bonjour Karim, le week-end dernier, nous avons fêté la naissance de mon neveu à Montréal. Toute la famille était là dans la maison de ma sœur. Ma sœur était fatiguée mais très heureuse. Je suis rentré très tard. Nous sommes contents.';

  it('lists each fix with the app’s explanation of that kind of mistake', () => {
    const out = checkWritingFeedback(corrected, input);
    expect(out.corrections.map((c) => [c.original, c.corrected, c.kind])).toEqual([
      ['en Montréal', 'à Montréal', 'preposition'],
      ['le maison', 'la maison', 'gender'],
      ['soeur', 'sœur', 'accent'],
      ['fatigué', 'fatiguée', 'agreement'],
      ['rentre tres', 'rentré très', 'accent'],
      ['content', 'contents', 'agreement'],
    ]);
    expect(out.corrections[0].why).toBe(EXPLANATIONS.preposition);
    expect(out.heldBack).toBe(0);
  });

  it('shows one fix once, even when the same slip appears twice', () => {
    expect(checkWritingFeedback(corrected, input).corrections.filter((c) => c.original === 'soeur')).toHaveLength(1);
  });

  it('suggests a next step for the most frequent kind of mistake', () => {
    expect(checkWritingFeedback(corrected, input).nextStep).toMatch(/endings|accents/i);
  });

  it('holds back changes that fit no known kind of mistake, and style rewrites', () => {
    const out = checkWritingFeedback(text.replace('très heureuse', 'vraiment ravie').replace('en Montréal', 'à Montréal'), input);
    expect(out.corrections.map((c) => c.original)).toEqual(['en Montréal']);
    expect(out.heldBack).toBe(1);
  });

  it('shows nothing, without claiming the text is perfect, when the copy is unchanged', () => {
    expect(checkWritingFeedback(text, input)).toEqual({ corrections: [], nextStep: null, heldBack: 0 });
  });

  it('rejects a copy that rewrote the text instead of correcting it, so it is asked again', () => {
    expect(() => checkWritingFeedback('Salut ! Ma famille a célébré l’arrivée du bébé chez ma sœur, tout le monde était heureux.', input)).toThrow(
      expect.objectContaining({ failure: 'rejected' }),
    );
  });
});

describe('corrections while the AI is still writing', () => {
  const text = 'Je suis alle au cinema. Le film etait tres bien. Apres, nous avons mange.';
  const partial = (soFar: string) => partialWritingCorrections(soFar, { ...input, text }).map((c) => [c.original, c.corrected]);

  it('shows the fixes in each sentence the AI has finished', () => {
    expect(partial('Je suis allé au cinéma. Le film était très bien. Après, nous av')).toEqual([
      ['alle', 'allé'],
      ['cinema', 'cinéma'],
      ['etait tres', 'était très'],
    ]);
  });

  it('waits for the end of a sentence, so a half-written word is never shown', () => {
    expect(partial('Je suis allé au ciné')).toEqual([]);
    expect(partial('Je suis allé au cinéma.')).toEqual([]);
    expect(partial('Je suis allé au cinéma. ')).toEqual([['alle', 'allé'], ['cinema', 'cinéma']]);
  });

  it('shows nothing when the finished sentences are a rewrite', () => {
    expect(partial('Hier soir, on est sortis voir un film génial. ')).toEqual([]);
  });

  it('only keeps fixes it can explain', () => {
    expect(partial('Je suis allé au théâtre. ')).toEqual([['alle', 'allé']]);
  });
});

import { SPEAKING_FEEDBACK_SCHEMA, checkSpeakingFeedback, speakingFeedbackMessages, type SpeakingFeedbackInput } from '../ai/speaking-feedback';

const input: SpeakingFeedbackInput = {
  taskType: 'opinion',
  level: 'B1',
  promptFr: 'Faut-il interdire les voitures en centre-ville ?',
  transcript: 'Je pense que il faut interdire les voitures parce que la pollution est un grand problème dans les villes.',
  durationMs: 45_000,
};

const rejected = (fn: () => unknown) => {
  try {
    fn();
    return false;
  } catch (e: unknown) {
    return (e as { failure?: string }).failure === 'rejected';
  }
};

const sound = {
  task: 'You give a clear opinion with a reason, which answers the question.',
  corrections: [{ original: 'Je pense que il', corrected: 'Je pense qu’il', why: '"Que" becomes "qu’" before a vowel.' }],
  phrases: [{ fr: 'D’un côté…, de l’autre…', en: 'On the one hand…, on the other…' }],
  nextStep: 'Give a second argument and an example from your own city.',
};

describe('speaking feedback prompt', () => {
  it('warns the model that the transcript may contain recognition errors and rules out scores', () => {
    const [system, user] = speakingFeedbackMessages(input);
    expect(system.content).toMatch(/speech recognition/i);
    expect(system.content).toMatch(/no score/i);
    expect(user.content).toContain(input.promptFr);
    expect(user.content).toContain(input.transcript);
    expect(user.content).toContain('45 seconds');
  });

  it('allows at most three corrections and three phrases', () => {
    const four = Array.from({ length: 4 }, () => sound.phrases[0]);
    expect(SPEAKING_FEEDBACK_SCHEMA.safeParse({ ...sound, phrases: four }).success).toBe(false);
  });
});

describe('checking speaking feedback', () => {
  it('keeps sound feedback', () => {
    expect(checkSpeakingFeedback(sound, input)).toEqual(sound);
  });

  it('drops corrections that are not in the transcript and phrases that are not French', () => {
    const out = checkSpeakingFeedback(
      {
        ...sound,
        corrections: [...sound.corrections, { original: 'les autos', corrected: 'les voitures', why: 'More usual word.' }],
        phrases: [...sound.phrases, { fr: 'In my opinion, this is the best way to do it.', en: 'In my opinion' }],
      },
      input,
    );
    expect(out.corrections).toHaveLength(1);
    expect(out.phrases).toHaveLength(1);
  });

  it('rejects feedback that grades or that is not in English', () => {
    expect(rejected(() => checkSpeakingFeedback({ ...sound, task: 'Good answer, NCLC 7.' }, input))).toBe(true);
    expect(rejected(() => checkSpeakingFeedback({ ...sound, nextStep: 'Donne un deuxième argument et un exemple de ta ville.' }, input))).toBe(true);
  });
});

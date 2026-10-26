import { GRADES, WRITING_FEEDBACK_SCHEMA, checkWritingFeedback, writingFeedbackMessages, type WritingFeedbackInput } from '../ai/writing-feedback';

const input: WritingFeedbackInput = {
  taskType: 'message',
  level: 'A2',
  promptFr: 'Écrivez un message à un ami pour l’inviter à votre anniversaire.',
  minWords: 60,
  maxWords: 120,
  text: "Salut Marc, je t'invite a mon anniversaire samedi. Je suis allé au magasin pour acheter un gâteau. Tu peux venir ? Bisous, Ana",
};

const rejected = (fn: () => unknown) => {
  try {
    fn();
    return false;
  } catch (e: unknown) {
    return (e as { failure?: string }).failure === 'rejected';
  }
};

describe('writing feedback prompt', () => {
  it('includes the task and the text, and rules out scores and rewrites', () => {
    const [system, user] = writingFeedbackMessages(input);
    expect(system.content).toMatch(/no score/i);
    expect(system.content).toMatch(/not sure/i);
    expect(user.content).toContain(input.promptFr);
    expect(user.content).toContain('60–120 words');
    expect(user.content).toContain(input.text);
  });

  it('caps the number and length of items', () => {
    const many = Array.from({ length: 7 }, () => ({ original: 'a', corrected: 'à', why: 'x' }));
    expect(WRITING_FEEDBACK_SCHEMA.safeParse({ corrections: many, strengths: [], nextStep: 'x' }).success).toBe(false);
  });
});

describe('checking writing feedback', () => {
  const sound = {
    corrections: [{ original: 'je t\'invite a mon', corrected: 'je t\'invite à mon', why: 'The preposition "à" needs its accent; "a" is the verb avoir.' }],
    strengths: ['Your message has a clear greeting and sign-off.'],
    nextStep: 'Add one sentence that says where and at what time the party is.',
  };

  it('keeps sound corrections, strengths and the next step', () => {
    expect(checkWritingFeedback(sound, input)).toEqual({ ...sound, heldBack: 0 });
  });

  it('drops corrections that quote words the learner never wrote', () => {
    const out = checkWritingFeedback({ ...sound, corrections: [...sound.corrections, { original: 'je suis allée', corrected: 'je suis allé', why: 'Agreement with the subject.' }] }, input);
    expect(out.corrections).toHaveLength(1);
  });

  it('drops corrections that change nothing, or only case or spacing', () => {
    const noop = [
      { original: 'Tu peux venir ?', corrected: 'Tu peux venir ?', why: 'Fine.' },
      { original: 'Tu peux venir ?', corrected: 'Tu peux venir?', why: 'Spacing before the question mark.' },
      { original: 'Salut Marc', corrected: 'salut Marc', why: 'Lower case.' },
    ];
    expect(checkWritingFeedback({ ...sound, corrections: noop }, input).corrections).toEqual([]);
  });

  it('drops corrections whose reason is not in English or whose fix is unsafe', () => {
    const bad = [
      { original: 'Bisous', corrected: 'Bises', why: 'C’est plus naturel dans une lettre pour un ami proche.' },
      { original: 'Bisous', corrected: 'Va sur www.exemple.fr', why: 'See the link.' },
    ];
    expect(checkWritingFeedback({ ...sound, corrections: bad }, input).corrections).toEqual([]);
    // The learner is told corrections were held back, not that the text has no mistakes.
    expect(checkWritingFeedback({ ...sound, corrections: bad }, input).heldBack).toBe(bad.length);
  });

  it('rejects the whole answer when the overall advice gives a score or is not English', () => {
    expect(rejected(() => checkWritingFeedback({ ...sound, nextStep: 'Score: 14/20. Add details about the place.' }, input))).toBe(true);
    expect(rejected(() => checkWritingFeedback({ ...sound, nextStep: 'Ajoute une phrase pour dire où est la fête et à quelle heure.' }, input))).toBe(true);
    expect(checkWritingFeedback({ ...sound, strengths: ['This would get NCLC 7 at the exam.'] }, input).strengths).toEqual([]);
  });
});

describe('grade detection', () => {
  it('catches the usual ways of grading', () => {
    for (const text of ['8 out of 10', 'You scored well', '7 points for content', 'This is B2', 'intermediate level work', 'mark of 12', '15 sur 20']) {
      expect(GRADES.test(text)).toBe(true);
    }
  });

  it('does not mistake ordinary advice for a grade', () => {
    for (const text of ['Please note: use "à" before cities.', 'Add a second argument.', 'Note the agreement of the past participle.']) {
      expect(GRADES.test(text)).toBe(false);
    }
  });
});

describe('corrections must be small edits of what was written', () => {
  const text = 'Je suis rentre tres tard mais je etais content. Les enfants sont venu.';
  const feedback = (corrections: { original: string; corrected: string; why: string }[]) =>
    checkWritingFeedback({ corrections, strengths: [], nextStep: 'Check your past participles.' }, { ...input, text });

  it('keeps accent, agreement and elision fixes', () => {
    const out = feedback([
      { original: 'rentre', corrected: 'rentré', why: 'The past participle of rentrer ends in -é.' },
      { original: 'sont venu', corrected: 'sont venus', why: 'With être the participle agrees: venus.' },
      { original: 'je etais', corrected: "j'étais", why: 'Je becomes j’ before a vowel.' },
    ]);
    expect(out.corrections).toHaveLength(3);
  });

  it('holds back rewrites into different words', () => {
    const out = feedback([
      { original: 'rentre', corrected: 'retourné', why: 'Use the past tense.' },
      { original: 'je etais', corrected: 'je suis', why: 'Use the present tense.' },
    ]);
    expect(out.corrections).toEqual([]);
    expect(out.heldBack).toBe(2);
  });
});

describe('levels in the advice', () => {
  it('drops a strength that mentions a level instead of throwing the feedback away', () => {
    const out = checkWritingFeedback(
      { corrections: [], strengths: ['Good vocabulary for level A2.', 'Clear greeting and sign-off.'], nextStep: 'Say when the party starts.' },
      input,
    );
    expect(out.strengths).toEqual(['Clear greeting and sign-off.']);
  });
});

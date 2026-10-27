import { EXPLAIN_SCHEMA, checkExplanation, explainMessages, type ExplainInput, fromReply } from '../ai/explain';

const mistake: ExplainInput = {
  prompt: 'Je vais ___ Montréal demain.',
  userAnswer: 'en',
  correctAnswer: 'à',
  explanation: 'Use à before a city.',
  grammarTag: 'prepositions',
};

const rejected = (fn: () => unknown) => {
  try {
    fn();
    return false;
  } catch (e: unknown) {
    return (e as { failure?: string }).failure === 'rejected';
  }
};

describe('explain-my-mistake prompt', () => {
  it('gives the model the exercise, both answers and the teacher note, and says the answer key is certain', () => {
    const [system, user] = explainMessages(mistake);
    expect(system.role).toBe('system');
    expect(system.content).toMatch(/never question/i);
    expect(user.content).toContain('Je vais ___ Montréal demain.');
    expect(user.content).toContain('Learner’s answer: en');
    expect(user.content).toContain('Correct answer: à');
    expect(user.content).toContain('Use à before a city.');
  });

  it('asks for a short explanation and one example', () => {
    expect(EXPLAIN_SCHEMA.safeParse({ why_in_english: 'Because.', example_in_french: 'Je vais à Paris.' }).success).toBe(true);
    expect(EXPLAIN_SCHEMA.safeParse({ why_in_english: 'x'.repeat(301), example_in_french: 'Je vais à Paris.' }).success).toBe(false);
  });

  it('names the language in each key, since the model writes the key just before its answer', () => {
    expect(Object.keys(EXPLAIN_SCHEMA.shape)).toEqual(['why_in_english', 'example_in_french']);
    expect(fromReply({ why_in_english: 'Because.', example_in_french: 'Je vais à Paris.' })).toEqual({ explanation: 'Because.', example: 'Je vais à Paris.' });
  });
});

describe('checking an explanation', () => {
  const good = { explanation: 'Before a city name French uses "à", not "en". "En" goes before most feminine countries, like "en France".', example: 'Elle habite à Québec.' };

  it('passes a sound explanation', () => {
    expect(checkExplanation(good, mistake)).toEqual(good);
  });

  it('rejects one that says the learner was right after all', () => {
    expect(rejected(() => checkExplanation({ ...good, explanation: 'Actually your answer is also correct in Canada.' }, mistake))).toBe(true);
    expect(rejected(() => checkExplanation({ ...good, explanation: 'Both answers are fine here, so it is not a mistake.' }, mistake))).toBe(true);
  });

  it('rejects an example that repeats the wrong answer, or that is not French', () => {
    expect(rejected(() => checkExplanation({ ...good, example: 'Je vais en Montréal.' }, { ...mistake, userAnswer: 'en Montréal', correctAnswer: 'à Montréal' }))).toBe(true);
    expect(rejected(() => checkExplanation({ ...good, example: 'She lives in the city of Quebec with her family.' }, mistake))).toBe(true);
  });

  it('rejects an explanation written in French or with a link', () => {
    expect(rejected(() => checkExplanation({ ...good, explanation: 'On utilise à devant une ville et en devant un pays féminin, comme la France.' }, mistake))).toBe(true);
    expect(rejected(() => checkExplanation({ ...good, explanation: 'See https://grammar.example.com for the rule.' }, mistake))).toBe(true);
  });
});

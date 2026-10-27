import { DEFAULT_AI_FEATURES, featureReady } from '../ai/features';

const all = { speechReady: true, llmId: 'llm', installedIds: ['llm'] };

describe('when an AI feature is ready', () => {
  it('needs the toggle on and the model it uses installed', () => {
    expect(featureReady('explain', DEFAULT_AI_FEATURES, all)).toBe(true);
    expect(featureReady('explain', DEFAULT_AI_FEATURES, { ...all, installedIds: [] })).toBe(false);
  });

  it('runs speech transcripts on the phone’s own French recognizer, with no AI pack', () => {
    expect(featureReady('speaking', DEFAULT_AI_FEATURES, { speechReady: true, llmId: null, installedIds: [] })).toBe(true);
    expect(featureReady('speaking', DEFAULT_AI_FEATURES, { ...all, speechReady: false })).toBe(false);
    expect(featureReady('speaking', { ...DEFAULT_AI_FEATURES, speaking: false }, all)).toBe(false);
  });

  it('lets the conversation partner run on the language model alone, typed when speech is missing', () => {
    expect(featureReady('conversation', DEFAULT_AI_FEATURES, { ...all, speechReady: false })).toBe(true);
  });

  it('is never ready on phones without a language model, or when switched off', () => {
    expect(featureReady('writing', DEFAULT_AI_FEATURES, { ...all, llmId: null })).toBe(false);
    expect(featureReady('generatedPractice', DEFAULT_AI_FEATURES, all)).toBe(false);
    expect(featureReady('writing', { ...DEFAULT_AI_FEATURES, writing: false }, all)).toBe(false);
  });
});

import { DEFAULT_AI_FEATURES, featureReady } from '../ai/features';

const all = { sttId: 'stt', llmId: 'llm', installedIds: ['stt', 'llm'] };

describe('when an AI feature is ready', () => {
  it('needs the toggle on and the model it uses installed', () => {
    expect(featureReady('explain', DEFAULT_AI_FEATURES, all)).toBe(true);
    expect(featureReady('speaking', DEFAULT_AI_FEATURES, { ...all, installedIds: ['stt'] })).toBe(true);
    expect(featureReady('explain', DEFAULT_AI_FEATURES, { ...all, installedIds: ['stt'] })).toBe(false);
    expect(featureReady('speaking', DEFAULT_AI_FEATURES, { ...all, installedIds: ['llm'] })).toBe(false);
  });

  it('is never ready on phones without a language model, or when switched off', () => {
    expect(featureReady('writing', DEFAULT_AI_FEATURES, { ...all, llmId: null })).toBe(false);
    expect(featureReady('generatedPractice', DEFAULT_AI_FEATURES, all)).toBe(false);
    expect(featureReady('writing', { ...DEFAULT_AI_FEATURES, writing: false }, all)).toBe(false);
  });
});

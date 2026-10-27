import { renderHook } from '@testing-library/react-native';
import { DEFAULT_AI_FEATURES } from '../../domain/ai/features';
import { useAiFeature } from '../ai/useAiFeature';

const stt = { id: 'stt' };
const llm = { id: 'llm' };
const mockPack = { plan: { stt, llm: llm as typeof llm | null }, installedIds: ['stt', 'llm'] };
jest.mock('../app/AppContext', () => ({ useApp: () => ({ settings: { aiFeatures: jest.requireActual('../../domain/ai/features').DEFAULT_AI_FEATURES } }) }));
jest.mock('../ai/useAiPack', () => ({ useAiPack: () => mockPack }));

describe('useAiFeature', () => {
  beforeEach(() => Object.assign(mockPack, { plan: { stt, llm }, installedIds: ['stt', 'llm'] }));

  it('gives language-model features the installed model', async () => {
    expect((await renderHook(() => useAiFeature('writing'))).result.current).toEqual({ ready: true, llm });
    expect(DEFAULT_AI_FEATURES.generatedPractice).toBe(false);
    expect((await renderHook(() => useAiFeature('generatedPractice'))).result.current).toEqual({ ready: false, llm: null });
  });

  it('gives speaking the language model only when one is installed', async () => {
    expect((await renderHook(() => useAiFeature('speaking'))).result.current).toEqual({ ready: true, llm });
    mockPack.installedIds = ['stt'];
    expect((await renderHook(() => useAiFeature('speaking'))).result.current).toEqual({ ready: true, llm: null });
    mockPack.plan = { stt, llm: null };
    expect((await renderHook(() => useAiFeature('writing'))).result.current).toEqual({ ready: false, llm: null });
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DEFAULT_SETTINGS } from '../../data/settings-repo';
import type { AiPackState } from '../../features/ai/ai-pack-controller';
import AiPackScreen from '../../features/ai/AiPackScreen';
import { ThemeProvider } from '../theme/ThemeProvider';

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('../ui/PressableScale', () => ({ PressableScale: jest.requireActual('react-native').Pressable }));
jest.mock('../ui/Progress', () => ({ ProgressRing: () => null, ProgressBar: () => null, BarChart: () => null }));
jest.mock('../ui/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../ui/ScreenHeader', () => ({ ScreenHeader: () => null }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
const mockShow = jest.fn();
const mockConfirm = jest.fn(async () => true);
jest.mock('../ui/Toast', () => ({ useToast: () => ({ show: mockShow, confirm: mockConfirm }) }));
const mockUpdateSetting = jest.fn(async () => undefined);
jest.mock('../../features/app/AppContext', () => ({ useApp: () => ({ settings: { ...jest.requireActual('../../data/settings-repo').DEFAULT_SETTINGS }, updateSetting: mockUpdateSetting }) }));

const llm = { id: 'llm', kind: 'llm', name: 'Qwen3 1.7B', file: 'a', url: 'https://huggingface.co/a', bytes: 1.1e9, sha256: 'x'.repeat(64), licence: 'Apache-2.0', source: 'Qwen' } as const;
let mockState: AiPackState;
const mockDownload = jest.fn();
const mockRemove = jest.fn(async () => undefined);
jest.mock('../../features/ai/useAiPack', () => ({ useAiPack: () => mockState }));
jest.mock('../../features/ai/ai-pack-controller', () => ({
  download: (...a: unknown[]) => mockDownload(...a),
  pause: jest.fn(),
  cancel: jest.fn(async () => undefined),
  remove: () => mockRemove(),
  isInstalled: (s: AiPackState) => s.plan.models.every((m) => s.installedIds.includes(m.id)),
}));

const mockAsk = jest.fn();
jest.mock('../../features/ai/ask', () => ({ askText: (...a: unknown[]) => mockAsk(...a) }));

const base: AiPackState = { plan: { tier: 'mid', llm, models: [llm] }, totalMemory: 6e9, installedIds: [], pendingId: null, active: null };
const show = () => render(<ThemeProvider preference="light"><AiPackScreen /></ThemeProvider>);

beforeEach(() => jest.clearAllMocks());

describe('AI pack screen', () => {
  it('says what this phone gets, the sizes, the privacy note and the licences', async () => {
    mockState = base;
    await show();
    expect(screen.getByText(/smaller language model/)).toBeTruthy();
    expect(screen.getByText('Download (1.1 GB)')).toBeTruthy();
    expect(screen.getByText(/Speaking transcripts need no download/)).toBeTruthy();
    expect(screen.getByText(/never leave the device/)).toBeTruthy();
    expect(screen.getByText(/Licence: Apache-2.0/)).toBeTruthy();
    expect(DEFAULT_SETTINGS.aiMobileData).toBe(false);
  });

  it('starts the download with the mobile-data choice and reports why it could not start', async () => {
    mockState = base;
    mockDownload.mockResolvedValue({ kind: 'blocked', block: { reason: 'mobile-data' } });
    await show();
    await fireEvent.press(screen.getByTestId('ai-download'));
    expect(mockDownload).toHaveBeenCalledWith(false);
    await waitFor(() => expect(mockShow).toHaveBeenCalled());
    expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({ title: 'Download not started', message: expect.stringMatching(/Wi-Fi/) }));
  });

  it('shows progress with pause and cancel while downloading', async () => {
    mockState = { ...base, active: { modelId: 'llm', fraction: 0.42 } };
    await show();
    expect(screen.getByText('Downloading… 42%')).toBeTruthy();
    expect(screen.getByTestId('ai-pause')).toBeTruthy();
    expect(screen.queryByTestId('ai-download')).toBeNull();
  });

  it('offers resume after a pause, and delete once installed', async () => {
    mockState = { ...base, pendingId: 'llm' };
    const { unmount } = await show();
    expect(screen.getByText('Resume download')).toBeTruthy();
    await unmount();
    mockState = { ...base, installedIds: ['llm'] };
    await show();
    expect(screen.queryByTestId('ai-download')).toBeNull();
    await fireEvent.press(screen.getByTestId('ai-delete'));
    await waitFor(() => expect(mockShow).toHaveBeenCalledWith({ tone: 'success', title: 'AI pack deleted' }));
    expect(mockConfirm).toHaveBeenCalled();
  });

  it('tells a low-memory phone it has nothing to download, and still offers speaking transcripts', async () => {
    mockState = { ...base, plan: { tier: 'low', llm: null, models: [] } };
    await show();
    expect(screen.getByText(/nothing to download/)).toBeTruthy();
    expect(screen.queryByTestId('ai-download')).toBeNull();
    expect(screen.queryByTestId('ai-delete')).toBeNull();
    expect(screen.getByText('Speaking transcripts')).toBeTruthy();
  });

  it('offers speaking transcripts before the language model is downloaded', async () => {
    mockState = base;
    await show();
    expect(screen.getByText('Speaking transcripts')).toBeTruthy();
    expect(screen.queryByText('Writing feedback')).toBeNull();
  });

  it('lists feature switches once installed, hiding language-model ones on low-memory phones', async () => {
    mockState = { ...base, installedIds: ['llm'] };
    const { unmount } = await show();
    expect(screen.getByText('Writing feedback')).toBeTruthy();
    await fireEvent(screen.getByTestId('ai-feature-generatedPractice'), 'valueChange', true);
    await waitFor(() => expect(mockUpdateSetting).toHaveBeenCalledWith('aiFeatures', expect.objectContaining({ generatedPractice: true, writing: true })));
    await unmount();
    mockState = { ...base, plan: { tier: 'low', llm: null, models: [] } };
    await show();
    expect(screen.getByText('Speaking transcripts')).toBeTruthy();
    expect(screen.queryByText('Writing feedback')).toBeNull();
    expect(screen.queryByTestId('ai-llm-check')).toBeNull();
  });

  it('tests the language model and shows its reply', async () => {
    mockState = { ...base, installedIds: ['llm'] };
    mockAsk.mockResolvedValue('Bonjour et bon courage pour le TCF !');
    await show();
    await fireEvent.press(screen.getByTestId('ai-llm-check'));
    await waitFor(() => expect(screen.getByTestId('ai-llm-check-result')).toBeTruthy());
    expect(screen.getByText(/Bonjour et bon courage/)).toBeTruthy();
    expect(mockAsk).toHaveBeenCalledWith(expect.objectContaining({ model: llm }), { language: 'fr', maxChars: 300 });
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { SpeakingFeedbackInput } from '../../domain/ai/speaking-feedback';
import { generate } from '../../services/ai/llm';
import { SpeakingAiFeedback } from '../ai/SpeakingAiFeedback';
import { ThemeProvider } from '../theme/ThemeProvider';

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('../ui/PressableScale', () => ({ PressableScale: jest.requireActual('react-native').Pressable }));
jest.mock('../ui/Progress', () => ({ ProgressRing: () => null, ProgressBar: () => null, BarChart: () => null }));
const mockFeature = { ready: true, llm: { id: 'llm' } as unknown };
jest.mock('../../features/ai/useAiFeature', () => ({ useAiFeature: () => mockFeature }));
jest.mock('../../services/ai/llm', () => ({ generate: jest.fn(), warmLlm: jest.fn() }));

const gen = generate as jest.Mock;
const input: SpeakingFeedbackInput = {
  taskType: 'opinion',
  level: 'B1',
  promptFr: 'Faut-il interdire les voitures en ville ?',
  transcript: 'Je pense que il faut interdire les voitures parce que la pollution est un problème.',
  durationMs: 30_000,
};
const show = (i = input) => render(<ThemeProvider preference="light"><SpeakingAiFeedback input={i} /></ThemeProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  Object.assign(mockFeature, { ready: true, llm: { id: 'llm' } });
});

describe('AI speaking coaching', () => {
  it('needs a language model and enough words', async () => {
    Object.assign(mockFeature, { ready: true, llm: null });
    const { unmount } = await show();
    expect(screen.queryByTestId('ai-speaking-card')).toBeNull();
    await unmount();
    Object.assign(mockFeature, { ready: true, llm: { id: 'llm' } });
    await show({ ...input, transcript: 'Oui, je pense.' });
    expect(screen.queryByTestId('ai-speaking-card')).toBeNull();
  });

  it('shows task fit, checked corrections, phrases and a next step', async () => {
    gen.mockResolvedValueOnce(
      JSON.stringify({
        task_in_english: 'You give an opinion with one reason.',
        corrections: [{ original: 'que il', corrected: 'qu’il', why_in_english: '"Que" elides before a vowel.' }],
        phrases: [{ fr: 'De plus', en: 'Moreover' }],
        next_step_in_english: 'Add a second argument.',
      }),
    );
    await show();
    await fireEvent.press(screen.getByTestId('ai-speaking-ask'));
    await waitFor(() => expect(screen.getByText('You give an opinion with one reason.')).toBeTruthy());
    expect(screen.getByText('qu’il')).toBeTruthy();
    expect(screen.getByText('De plus')).toBeTruthy();
    expect(screen.getByText('Next take: Add a second argument.')).toBeTruthy();
  });

  it('shows a fix without its reason when the reason failed the checks', async () => {
    gen.mockResolvedValueOnce(
      JSON.stringify({
        task_in_english: 'You give an opinion with one reason.',
        corrections: [{ original: 'que il', corrected: 'qu’il', why_in_english: "Le mot 'que' devient 'qu' devant une voyelle, comme dans la phrase." }],
        phrases: [],
        next_step_in_english: 'Add a second argument.',
      }),
    );
    await show();
    await fireEvent.press(screen.getByTestId('ai-speaking-ask'));
    await waitFor(() => expect(screen.getByText('qu’il')).toBeTruthy());
    expect(screen.queryByText(/devient/)).toBeNull();
    // No empty reason line is left behind either.
    expect(screen.queryByText('')).toBeNull();
  });
});

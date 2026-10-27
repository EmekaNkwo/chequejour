import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { WritingFeedbackInput } from '../../domain/ai/writing-feedback';
import { generate, warmLlm } from '../../services/ai/llm';
import { WritingAiFeedback } from '../ai/WritingAiFeedback';
import { ThemeProvider } from '../theme/ThemeProvider';

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('../ui/PressableScale', () => ({ PressableScale: jest.requireActual('react-native').Pressable }));
jest.mock('../ui/Progress', () => ({ ProgressRing: () => null, ProgressBar: () => null, BarChart: () => null }));
const mockFeature = { ready: true, llm: { id: 'llm' } as unknown };
jest.mock('../../features/ai/useAiFeature', () => ({ useAiFeature: () => mockFeature }));
jest.mock('../../services/ai/llm', () => ({ generate: jest.fn(), warmLlm: jest.fn() }));

const gen = generate as jest.Mock;
const input: WritingFeedbackInput = { taskType: 'message', level: 'A2', promptFr: 'Invitez un ami.', minWords: 60, maxWords: 120, text: "Je t'invite a mon anniversaire samedi." };
const show = (i = input) => render(<ThemeProvider preference="light"><WritingAiFeedback input={i} /></ThemeProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  Object.assign(mockFeature, { ready: true, llm: { id: 'llm' } });
});

describe('AI writing feedback', () => {
  it('is hidden when not ready or when there is no text', async () => {
    Object.assign(mockFeature, { ready: false, llm: null });
    const { unmount } = await show();
    expect(screen.queryByTestId('ai-writing-card')).toBeNull();
    await unmount();
    Object.assign(mockFeature, { ready: true, llm: { id: 'llm' } });
    await show({ ...input, text: '  ' });
    expect(screen.queryByTestId('ai-writing-card')).toBeNull();
    // Nothing to read yet: the model stays unloaded.
    expect(warmLlm).not.toHaveBeenCalledWith({ id: 'llm' }, expect.anything());
  });

  it('shows each fix from the corrected copy with the app’s explanation', async () => {
    gen.mockResolvedValueOnce("Je t'invite à mon anniversaire samedi.");
    await show();
    await fireEvent.press(screen.getByTestId('ai-writing-ask'));
    await waitFor(() => expect(screen.getByText('à mon')).toBeTruthy());
    expect(screen.getByText('a mon')).toBeTruthy();
    expect(screen.getByText(/^Accent:/)).toBeTruthy();
    expect(screen.getByText(/^Next time: Reread for accents/)).toBeTruthy();
  });

  it('never claims the text has no mistakes when the AI changed nothing', async () => {
    gen.mockResolvedValueOnce(input.text);
    await show();
    await fireEvent.press(screen.getByTestId('ai-writing-ask'));
    await waitFor(() => expect(screen.getByText(/didn’t point out any mistakes/)).toBeTruthy());
  });

  it('says when it held back changes it could not explain', async () => {
    gen.mockResolvedValueOnce("Je t'invite a ma fête samedi.");
    await show();
    await fireEvent.press(screen.getByTestId('ai-writing-ask'));
    await waitFor(() => expect(screen.getByText(/not in a way the app could explain/)).toBeTruthy());
  });

  it('refuses a rewritten text, and lets the learner retry', async () => {
    gen.mockResolvedValue('Salut ! Viens fêter mes trente ans ce week-end chez moi.');
    await show();
    await fireEvent.press(screen.getByTestId('ai-writing-ask'));
    await waitFor(() => expect(screen.getByText(/did not pass the app’s checks/)).toBeTruthy());
    expect(screen.getByText('Try again')).toBeTruthy();
    // It asked twice on its own before giving up.
    expect(gen).toHaveBeenCalledTimes(2);
  });
});

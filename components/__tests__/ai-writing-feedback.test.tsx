import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { WritingFeedbackInput } from '../../domain/ai/writing-feedback';
import { generate } from '../../services/ai/llm';
import { WritingAiFeedback } from '../ai/WritingAiFeedback';
import { ThemeProvider } from '../theme/ThemeProvider';

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('../ui/PressableScale', () => ({ PressableScale: jest.requireActual('react-native').Pressable }));
jest.mock('../ui/Progress', () => ({ ProgressRing: () => null, ProgressBar: () => null, BarChart: () => null }));
const mockFeature = { ready: true, llm: { id: 'llm' } as unknown };
jest.mock('../../features/ai/useAiFeature', () => ({ useAiFeature: () => mockFeature }));
jest.mock('../../services/ai/llm', () => ({ generate: jest.fn() }));

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
  });

  it('shows only the corrections that pass the checks', async () => {
    gen.mockResolvedValueOnce(
      JSON.stringify({
        corrections: [
          { original: "t'invite a mon", corrected: "t'invite à mon", why: 'The preposition needs its accent.' },
          { original: 'je suis allée', corrected: 'je suis allé', why: 'Agreement with the subject.' },
        ],
        strengths: ['Clear invitation with a day.'],
        nextStep: 'Say where the party is and at what time.',
      }),
    );
    await show();
    await fireEvent.press(screen.getByTestId('ai-writing-ask'));
    await waitFor(() => expect(screen.getByText("t'invite à mon")).toBeTruthy());
    expect(screen.queryByText('je suis allé')).toBeNull();
    expect(screen.getByText('Clear invitation with a day.')).toBeTruthy();
    expect(screen.getByText('Next time: Say where the party is and at what time.')).toBeTruthy();
  });

  it('never claims the text has no mistakes when the AI pointed out none', async () => {
    gen.mockResolvedValueOnce(JSON.stringify({ corrections: [], strengths: [], nextStep: 'Add a sign-off with your name.' }));
    await show();
    await fireEvent.press(screen.getByTestId('ai-writing-ask'));
    await waitFor(() => expect(screen.getByText(/didn’t point out any mistakes/)).toBeTruthy());
    expect(screen.queryByText(/No clear mistakes/)).toBeNull();
  });

  it('says when its corrections were held back by the checks', async () => {
    const unquoted = { original: 'nextStep', corrected: 'next step', why: 'Add a space.' };
    gen.mockResolvedValueOnce(JSON.stringify({ corrections: [unquoted], strengths: [], nextStep: 'Add a sign-off with your name.' }));
    await show();
    await fireEvent.press(screen.getByTestId('ai-writing-ask'));
    await waitFor(() => expect(screen.getByText(/didn’t pass the app’s checks/)).toBeTruthy());
  });

  it('refuses feedback that grades the text, and lets the learner retry', async () => {
    gen.mockResolvedValueOnce(JSON.stringify({ corrections: [], strengths: [], nextStep: 'Score: 12/20, add more detail.' }));
    await show();
    await fireEvent.press(screen.getByTestId('ai-writing-ask'));
    await waitFor(() => expect(screen.getByText(/did not pass the app’s checks/)).toBeTruthy());
    expect(screen.getByText('Try again')).toBeTruthy();
  });
});

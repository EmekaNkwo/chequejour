import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AiError } from '../../domain/ai/errors';
import type { ExplainInput } from '../../domain/ai/explain';
import { explainMistake } from '../../features/ai/explain-mistake';
import { generate } from '../../services/ai/llm';
import { ExplainMistake } from '../ai/ExplainMistake';
import { ThemeProvider } from '../theme/ThemeProvider';

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('../ui/PressableScale', () => ({ PressableScale: jest.requireActual('react-native').Pressable }));
jest.mock('../ui/Progress', () => ({ ProgressRing: () => null, ProgressBar: () => null, BarChart: () => null }));
const mockFeature = { ready: true, llm: { id: 'llm' } as unknown };
jest.mock('../../features/ai/useAiFeature', () => ({ useAiFeature: () => mockFeature }));
jest.mock('../../services/ai/llm', () => ({ generate: jest.fn() }));

const gen = generate as jest.Mock;
const mistake: ExplainInput = { prompt: 'Je vais ___ Montréal.', userAnswer: 'en', correctAnswer: 'à', explanation: 'Use à before a city.', grammarTag: 'prepositions' };
const show = () => render(<ThemeProvider preference="light"><ExplainMistake mistake={mistake} /></ThemeProvider>);
const reply = (o: object) => gen.mockResolvedValueOnce(JSON.stringify(o));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  Object.assign(mockFeature, { ready: true, llm: { id: 'llm' } });
});

describe('Explain my mistake', () => {
  it('is hidden when the feature is not ready', async () => {
    Object.assign(mockFeature, { ready: false, llm: null });
    await show();
    expect(screen.queryByText('Explain with AI')).toBeNull();
  });

  it('shows the explanation and an example, labelled as an AI suggestion', async () => {
    reply({ explanation: 'Before a city French uses "à", not "en".', example: 'Elle habite à Québec.' });
    await show();
    await fireEvent.press(screen.getByText('Explain with AI'));
    await waitFor(() => expect(screen.getByText(/Before a city French uses/)).toBeTruthy());
    expect(screen.getByText('Example: Elle habite à Québec.')).toBeTruthy();
    expect(screen.getByText(/AI SUGGESTION/)).toBeTruthy();
    expect(gen).toHaveBeenCalledWith(expect.objectContaining({ temperature: 0.2, jsonSchema: expect.any(Object) }));
  });

  it('drops an explanation that contradicts the answer key and offers to retry', async () => {
    reply({ explanation: 'Your answer is also correct in Quebec French.', example: 'Je vais à Laval.' });
    await show();
    await fireEvent.press(screen.getByText('Explain with AI'));
    await waitFor(() => expect(screen.getByText(/did not pass the app’s checks/)).toBeTruthy());
    expect(screen.queryByText(/also correct/)).toBeNull();
    expect(screen.getByText('Try the AI explanation again')).toBeTruthy();
  });

  it('explains a model failure calmly', async () => {
    gen.mockRejectedValueOnce(new AiError('load-failed', 'oom'));
    await show();
    await fireEvent.press(screen.getByText('Explain with AI'));
    await waitFor(() => expect(screen.getByText(/could not start/)).toBeTruthy());
  });
});

describe('explainMistake', () => {
  it('rejects malformed replies', async () => {
    gen.mockResolvedValueOnce('Sure, here you go!');
    await expect(explainMistake({ id: 'llm' } as never, mistake)).rejects.toMatchObject({ failure: 'rejected' });
  });
});

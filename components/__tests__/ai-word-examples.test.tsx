import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ExampleWord } from '../../domain/ai/word-examples';
import { generate } from '../../services/ai/llm';
import { WordExamples } from '../ai/WordExamples';
import { ThemeProvider } from '../theme/ThemeProvider';

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('../ui/PressableScale', () => ({ PressableScale: jest.requireActual('react-native').Pressable }));
jest.mock('../ui/Progress', () => ({ ProgressRing: () => null, ProgressBar: () => null, BarChart: () => null }));
jest.mock('../audio/AudioControls', () => ({ PlayButton: () => null }));
const mockFeature = { ready: true, llm: { id: 'llm' } as unknown };
jest.mock('../../features/ai/useAiFeature', () => ({ useAiFeature: () => mockFeature }));
jest.mock('../../services/ai/llm', () => ({ generate: jest.fn(), warmLlm: jest.fn() }));

const gen = generate as jest.Mock;
const word: ExampleWord = { fr: 'se lever', en: 'to get up', pos: 'verb', level: 'A2', example: { fr: 'Je me lève à sept heures.', en: 'I get up at seven.' } };
const show = () => render(<ThemeProvider preference="light"><WordExamples word={word} wordId="u01-w001" /></ThemeProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  Object.assign(mockFeature, { ready: true, llm: { id: 'llm' } });
});

describe('AI word examples', () => {
  it('is hidden unless AI-made practice is switched on', async () => {
    Object.assign(mockFeature, { ready: false, llm: null });
    await show();
    expect(screen.queryByTestId('ai-word-examples')).toBeNull();
  });

  it('shows checked examples and turns them into gap practice', async () => {
    gen.mockResolvedValueOnce(
      JSON.stringify({
        examples: [
          { fr: 'Le dimanche, je me lève tard.', en: 'On Sundays I get up late.' },
          { fr: 'Je prends le bus.', en: 'I take the bus.' },
        ],
      }),
    );
    await show();
    await fireEvent.press(screen.getByText('Write new examples with AI'));
    await waitFor(() => expect(screen.getByText('Le dimanche, je me lève tard.')).toBeTruthy());
    expect(screen.queryByText('Je prends le bus.')).toBeNull();
    await fireEvent.press(screen.getByText('Practise'));
    expect(screen.getByText('Le dimanche, je me ____ tard.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Show the answer'));
    expect(screen.getByText('Le dimanche, je me lève tard.')).toBeTruthy();
  });

  it('offers a retry when nothing passes the checks', async () => {
    gen.mockResolvedValueOnce(JSON.stringify({ examples: [{ fr: 'Je prends le bus.', en: 'I take the bus.' }] }));
    await show();
    await fireEvent.press(screen.getByText('Write new examples with AI'));
    await waitFor(() => expect(screen.getByText('Try again')).toBeTruthy());
  });
});

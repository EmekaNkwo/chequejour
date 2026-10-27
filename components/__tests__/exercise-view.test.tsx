import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import type { CheckOutcome } from '../../domain/answers';
import type { Exercise } from '../../domain/content-types';
import { ExerciseView } from '../exercises/ExerciseView';
import { ThemeProvider } from '../theme/ThemeProvider';

jest.mock('../audio/AudioControls', () => ({ AudioControls: () => null }));
// Reanimated's native worklets don't load under Jest; these two are its only users here.
jest.mock('../ui/Progress', () => ({ ProgressRing: () => null, ProgressBar: () => null, BarChart: () => null }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('../ui/PressableScale', () => ({ PressableScale: jest.requireActual('react-native').Pressable }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

function Harness({ exercise, onAnswer }: { exercise: Exercise; onAnswer: (o: CheckOutcome) => void }) {
  const [answered, setAnswered] = useState<CheckOutcome | null>(null);
  return (
    <ThemeProvider preference="light">
      <ExerciseView
        exercise={exercise}
        answered={answered}
        onAnswer={(o) => {
          setAnswered(o);
          onAnswer(o);
        }}
      />
    </ThemeProvider>
  );
}

const base = { level: 'A2', skill: 'structures', grammarTag: 'passe-compose', explanation: 'e' } as const;

async function answer(text: string) {
  await fireEvent.changeText(screen.getByTestId('answer-input'), text);
  await fireEvent.press(screen.getByTestId('check-answer'));
}

describe('ExerciseView typed answers', () => {
  it('shows a word-by-word diff after a wrong dictation', async () => {
    const onAnswer = jest.fn();
    await render(<Harness exercise={{ ...base, id: 'd', type: 'dictation', text: 'Nous sommes allés au marché.', translation: 't' }} onAnswer={onAnswer} />);
    await answer('nous somme alles au marche');
    expect(onAnswer.mock.calls[0][0].result).toBe('wrong');
    expect(screen.getByTestId('dictation-diff').props.accessibilityLabel).toBe('Word by word: sommes, wrong; allés, accents; marché, accents');
  });

  it('hides the diff when the dictation is right', async () => {
    await render(<Harness exercise={{ ...base, id: 'd', type: 'dictation', text: 'Il fait beau.', translation: 't' }} onAnswer={jest.fn()} />);
    await answer('Il fait beau');
    expect(screen.queryByTestId('dictation-diff')).toBeNull();
  });

  it('accepts a conjugation typed with its pronoun and links to the tables', async () => {
    const onAnswer = jest.fn();
    await render(<Harness exercise={{ ...base, id: 'c', type: 'conjugation', verb: 'venir', tense: 'passé composé', person: 'ils', answers: ['sont venus'] }} onAnswer={onAnswer} />);
    await answer('ils sont venus');
    expect(onAnswer.mock.calls[0][0].result).toBe('correct');
    expect(screen.getByText('See all forms of venir')).toBeTruthy();
  });

  it('accepts an English contraction in a translation', async () => {
    const onAnswer = jest.fn();
    await render(<Harness exercise={{ ...base, id: 't', type: 'translate', direction: 'fr-en', source: 'Je ne sais pas.', answers: ['I do not know'] }} onAnswer={onAnswer} />);
    await answer("I don't know");
    expect(onAnswer.mock.calls[0][0].result).toBe('correct');
  });
});

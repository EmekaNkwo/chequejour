import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ExerciseView } from '../../components/exercises/ExerciseView';
import { spacing } from '../../components/theme/tokens';
import { Button } from '../../components/ui/Button';
import type { CheckOutcome } from '../../domain/answers';
import type { Exercise } from '../../domain/content-types';
import { useApp } from '../app/AppContext';
import { logError } from '../app/log';
import { recordExerciseResult } from '../exercises/record-result';
import { useAnswerToast } from '../exercises/useAnswerToast';

export interface DailyTestProps {
  exercise: Exercise;
  /** Called on the first answer, e.g. to reveal a meaning hidden during the test. */
  onAnswered?: () => void;
}

/** One quick check with toast feedback; the answer is recorded as daily practice. */
export function DailyTest({ exercise, onAnswered }: DailyTestProps) {
  const { progress, invalidate } = useApp();
  const feedback = useAnswerToast();
  const [answered, setAnswered] = useState<CheckOutcome | null>(null);
  const [attempt, setAttempt] = useState(0);

  const onAnswer = (outcome: CheckOutcome, userAnswer: string) => {
    setAnswered(outcome);
    feedback.show(outcome, exercise.explanation);
    onAnswered?.();
    recordExerciseResult(progress, { exercise, result: outcome.result, userAnswer, context: 'daily', unitId: null, now: Date.now() })
      .then(invalidate)
      .catch((e: unknown) => logError('daily test', e));
  };

  const wrong = answered?.result === 'wrong';
  return (
    <View style={styles.gap} testID="daily-test">
      <ExerciseView key={`${exercise.id}-${attempt}`} exercise={exercise} answered={answered} onAnswer={onAnswer} />
      {wrong ? (
        <Button
          label="Try again"
          variant="secondary"
          icon="rotate-ccw"
          onPress={() => {
            feedback.clear();
            setAnswered(null);
            setAttempt((n) => n + 1);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.lg },
});

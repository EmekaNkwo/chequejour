/**
 * Runs a list of exercises one per screen: answer → feedback toast → continue.
 * Every answer is recorded (attempts, mistakes notebook).
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AttemptInput } from '../../data/progress-repo';
import type { CheckOutcome } from '../../domain/answers';
import type { Exercise } from '../../domain/content-types';
import { useApp } from '../../features/app/AppContext';
import { logError } from '../../features/app/log';
import { recordExerciseResult } from '../../features/exercises/record-result';
import { useAnswerToast } from '../../features/exercises/useAnswerToast';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { Button, IconButton } from '../ui/Button';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/Progress';
import { ExerciseView, TYPE_INSTRUCTION } from './ExerciseView';

export interface QuizScore {
  correct: number;
  total: number;
  results: { exerciseId: string; correct: boolean }[];
}

export interface QuizRunnerProps {
  title: string;
  exercises: readonly Exercise[];
  context: AttemptInput['context'];
  unitId: string | null;
  onFinish: (score: QuizScore) => void;
  onClose: () => void;
  /** Record answers (off for previews). */
  record?: boolean;
  /** Hide the explanation panel until the end (timed tests). */
  showFeedback?: boolean;
}

export function QuizRunner({ title, exercises, context, unitId, onFinish, onClose, record = true, showFeedback = true }: QuizRunnerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { progress } = useApp();
  const feedback = useAnswerToast();
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<CheckOutcome | null>(null);
  const [results, setResults] = useState<QuizScore['results']>([]);
  const exercise = exercises[index];

  if (!exercise) return null;

  const finishOrNext = (nextResults: QuizScore['results']) => {
    feedback.clear();
    if (index + 1 >= exercises.length) {
      onFinish({ correct: nextResults.filter((r) => r.correct).length, total: exercises.length, results: nextResults });
      return;
    }
    setAnswered(null);
    setIndex(index + 1);
  };

  const translation = 'translation' in exercise && exercise.type !== 'dictation' ? exercise.translation : undefined;

  const handleAnswer = (outcome: CheckOutcome, userAnswer: string) => {
    const nextResults = [...results, { exerciseId: exercise.id, correct: outcome.result !== 'wrong' }];
    setResults(nextResults);
    if (record) {
      recordExerciseResult(progress, { exercise, result: outcome.result, userAnswer, context, unitId, now: Date.now() }).catch((e: unknown) =>
        logError('record answer', e),
      );
    }
    if (showFeedback) {
      setAnswered(outcome);
      feedback.show(outcome, translation ? `${exercise.explanation}\n${translation}` : exercise.explanation);
    } else finishOrNext(nextResults);
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon="x" label="Close" onPress={onClose} testID="quiz-close" />
        <View style={styles.flex}>
          <AppText variant="meta" tone="muted" numberOfLines={1}>
            {`${title} · ${index + 1} of ${exercises.length}`}
          </AppText>
          <ProgressBar value={(index + (answered ? 1 : 0)) / exercises.length} accessibilityLabel={`Question ${index + 1} of ${exercises.length}`} />
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <AppText variant="label" tone="muted">
          {TYPE_INSTRUCTION[exercise.type].toUpperCase()}
        </AppText>
        <Card>
          <ExerciseView key={exercise.id} exercise={exercise} answered={answered} onAnswer={handleAnswer} />
        </Card>
      </ScrollView>
      {answered ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg, backgroundColor: colors.background }]}>
          <Button label={index + 1 >= exercises.length ? 'Finish' : 'Continue'} onPress={() => finishOrNext(results)} testID="feedback-continue" />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  flex: { flex: 1, gap: spacing.xs },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
});

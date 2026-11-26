import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { QuizRunner, type QuizScore } from '../components/exercises/QuizRunner';
import { QuizResult } from '../components/lesson/QuizResult';
import { spacing } from '../components/theme/tokens';
import { AppText } from '../components/ui/AppText';
import { Button } from '../components/ui/Button';
import { ErrorState, Loading } from '../components/ui/Screen';
import type { Exercise } from '../domain/content-types';
import { useApp } from '../features/app/AppContext';
import { logError } from '../features/app/log';
import { useLoad } from '../features/app/useLoad';
import { loadTrainer, saveTrainerAnswer, type TrainerSession } from '../features/conjugation/trainer-service';
import { useStudyTimer } from '../features/progress/useStudyTimer';

/** Conjugation trainer: ten forms per round; with ?verb=…, only that verb. */
export default function VerbTrainerScreen() {
  const app = useApp();
  const { verb } = useLocalSearchParams<{ verb?: string }>();
  const [round, setRound] = useState(0);
  const { data, error, reload } = useLoad('conjugation trainer', () => loadTrainer(app, { now: Date.now(), seed: `${app.today}:${round}`, verb }), [verb, round]);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (data.exercises.length === 0) return <ErrorState message="There's nothing to practise for this verb." />;
  return <Trainer key={round} session={data} verb={verb} onAgain={() => setRound((r) => r + 1)} />;
}

interface TrainerProps {
  session: TrainerSession;
  verb: string | undefined;
  onAgain: () => void;
}

function Trainer({ session, verb, onAgain }: TrainerProps) {
  useStudyTimer();
  const app = useApp();
  const [score, setScore] = useState<QuizScore | null>(null);

  const onAnswer = (exercise: Exercise, outcome: { result: 'correct' | 'almost' | 'wrong' }) => {
    const item = session.items[session.exercises.findIndex((e) => e.id === exercise.id)];
    if (!item) return;
    saveTrainerAnswer(app, item, outcome.result, Date.now()).catch((e: unknown) => logError('save conjugation answer', e));
  };

  if (score) {
    const missed = score.results.filter((r) => !r.correct).map((r) => session.exercises.find((e) => e.id === r.exerciseId)?.explanation ?? '');
    return (
      <QuizResult
        title={verb ? `${verb}: round done` : 'Round done'}
        score={score}
        good={score.correct / Math.max(1, score.total) >= 0.7}
        message={missed.length > 0 ? 'The forms you missed come back first next time.' : 'All right! These forms come back later, spaced out so they stick.'}
        primaryLabel="Done"
        onPrimary={() => {
          app.invalidate();
          router.back();
        }}
        secondary={
          <View style={styles.gap}>
            {missed.length > 0 ? (
              <AppText variant="label" tone="muted">
                TO REVIEW
              </AppText>
            ) : null}
            {missed.map((m) => (
              <AppText key={m} variant="body" french>
                {m}
              </AppText>
            ))}
            <Button
              label="Another round"
              icon="repeat"
              variant="secondary"
              onPress={() => {
                app.invalidate();
                onAgain();
              }}
              testID="trainer-again"
            />
          </View>
        }
        testID="trainer-result"
      />
    );
  }
  return (
    <QuizRunner
      title={verb ? `Practise ${verb}` : 'Conjugation trainer'}
      exercises={session.exercises}
      context="practice"
      unitId={null}
      record={false}
      onAnswer={onAnswer}
      onClose={() => {
        app.invalidate();
        router.back();
      }}
      onFinish={setScore}
    />
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.sm },
});

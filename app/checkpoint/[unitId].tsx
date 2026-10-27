import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { QuizRunner, type QuizScore } from '../../components/exercises/QuizRunner';
import { QuizResult } from '../../components/lesson/QuizResult';
import { Button } from '../../components/ui/Button';
import { ErrorState, Loading } from '../../components/ui/Screen';
import type { Unit } from '../../domain/content-types';
import { CHECKPOINT_PASS, isPassed } from '../../domain/unit-path';
import { useApp } from '../../features/app/AppContext';
import { logError } from '../../features/app/log';
import { useLoad } from '../../features/app/useLoad';
import { useStudyTimer } from '../../features/progress/useStudyTimer';

export default function CheckpointScreen() {
  const { unitId } = useLocalSearchParams<{ unitId: string }>();
  const { content } = useApp();
  const { data, error, loading, reload } = useLoad('checkpoint', () => content.unit(unitId ?? ''), [unitId]);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return loading ? <Loading /> : <ErrorState message="This checkpoint couldn't be found." />;
  if (data.checkpoint.length === 0) return <ErrorState message="This unit has no checkpoint questions yet." />;
  return <Checkpoint unit={data} />;
}

function Checkpoint({ unit }: { unit: Unit }) {
  useStudyTimer();
  const { content, progress, invalidate } = useApp();
  const [score, setScore] = useState<QuizScore | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [nextUnitId, setNextUnitId] = useState<string | null>(null);

  const finish = async (s: QuizScore) => {
    setScore(s);
    const value = s.total > 0 ? s.correct / s.total : 0;
    try {
      await progress.saveCheckpoint(unit.id, value, isPassed(value), Date.now());
      const units = await content.units();
      setNextUnitId(units.find((u) => u.order === unit.order + 1)?.id ?? null);
    } catch (e: unknown) {
      logError('save checkpoint', e);
    }
    invalidate();
  };

  if (score) {
    const value = score.total > 0 ? score.correct / score.total : 0;
    const passed = isPassed(value);
    const message = passed
      ? nextUnitId
        ? `You passed the ${unit.theme} checkpoint. The next unit is now open.`
        : `You passed the final checkpoint. Félicitations — try a mock test next.`
      : `You need ${Math.round(CHECKPOINT_PASS * 100)}% to pass. Your mistakes are in the notebook — review them, then try again.`;
    return (
      <QuizResult
        title={passed ? 'Réussi !' : 'Pas encore'}
        score={score}
        good={passed}
        message={message}
        primaryLabel={passed && nextUnitId ? 'Go to the next unit' : 'Back to the unit'}
        onPrimary={() => (passed && nextUnitId ? router.replace(`/unit/${nextUnitId}`) : router.back())}
        secondary={
          passed ? null : (
            <Button
              label="Try again"
              variant="secondary"
              icon="rotate-ccw"
              onPress={() => {
                setScore(null);
                setAttempt((a) => a + 1);
              }}
              testID="checkpoint-retry"
            />
          )
        }
        testID="checkpoint-result"
      />
    );
  }

  return (
    <QuizRunner
      key={attempt}
      title={`Checkpoint · ${unit.theme}`}
      exercises={unit.checkpoint}
      context="checkpoint"
      unitId={unit.id}
      onClose={() => router.back()}
      onFinish={(s) => void finish(s)}
    />
  );
}

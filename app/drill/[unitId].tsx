import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { QuizRunner, type QuizScore } from '../../components/exercises/QuizRunner';
import { QuizResult } from '../../components/lesson/QuizResult';
import { ErrorState, Loading } from '../../components/ui/Screen';
import type { Exercise, Unit } from '../../domain/content-types';
import { seededShuffle } from '../../domain/shuffle';
import { useApp } from '../../features/app/AppContext';
import { logError } from '../../features/app/log';
import { useLoad } from '../../features/app/useLoad';
import { useStudyTimer } from '../../features/progress/useStudyTimer';

const DRILL_SIZE = 8;

export default function DrillScreen() {
  const { unitId } = useLocalSearchParams<{ unitId: string }>();
  const { content, today } = useApp();
  const { data, error, loading, reload } = useLoad(
    'drill',
    async () => {
      const unit = await content.unit(unitId ?? '');
      return unit ? { unit, exercises: seededShuffle(unit.exercises, `${unit.id}:${today}`).slice(0, DRILL_SIZE) } : null;
    },
    [unitId, today],
  );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return loading ? <Loading /> : <ErrorState message="This drill couldn't be found." />;
  if (data.exercises.length === 0) return <ErrorState message="This unit has no exercises yet." />;
  return <Drill unit={data.unit} exercises={data.exercises} />;
}

function Drill({ unit, exercises }: { unit: Unit; exercises: readonly Exercise[] }) {
  useStudyTimer();
  const { progress, invalidate } = useApp();
  const [score, setScore] = useState<QuizScore | null>(null);

  const finish = async (s: QuizScore) => {
    setScore(s);
    try {
      await progress.completeSkillItem(`structures:${unit.id}`, 'structures', unit.id, s.total > 0 ? s.correct / s.total : 0, Date.now());
    } catch (e: unknown) {
      logError('save drill', e);
    }
    invalidate();
  };

  if (score) {
    return (
      <QuizResult
        title="Drill done"
        score={score}
        good={score.correct / Math.max(1, score.total) >= 0.7}
        message="Mistakes go to your notebook and come back in later sessions."
        onPrimary={() => router.back()}
        testID="drill-result"
      />
    );
  }

  return (
    <QuizRunner
      title={`Grammar drill · ${unit.theme}`}
      exercises={exercises}
      context="practice"
      unitId={unit.id}
      onClose={() => router.back()}
      onFinish={(s) => void finish(s)}
    />
  );
}

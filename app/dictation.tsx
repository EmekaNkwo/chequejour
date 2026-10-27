import { router } from 'expo-router';
import { useState } from 'react';
import { QuizRunner, type QuizScore } from '../components/exercises/QuizRunner';
import { QuizResult } from '../components/lesson/QuizResult';
import { ErrorState, Loading } from '../components/ui/Screen';
import type { Exercise } from '../domain/content-types';
import { useApp } from '../features/app/AppContext';
import { useLoad } from '../features/app/useLoad';
import { dictationSet } from '../features/practice/dictation-practice';
import { useStudyTimer } from '../features/progress/useStudyTimer';

/** Dictation practice: listen, type, then see a word-by-word comparison. */
export default function DictationScreen() {
  const { content, progress, settings, today } = useApp();
  const { data, error, reload } = useLoad('dictation practice', () => dictationSet(content, progress, settings.placementLevel, `dictation:${today}`), [today]);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (data.length === 0) return <ErrorState message="No dictations are open yet. Start your first unit to unlock them." />;
  return <Dictation exercises={data} />;
}

function Dictation({ exercises }: { exercises: readonly Exercise[] }) {
  useStudyTimer();
  const { invalidate } = useApp();
  const [score, setScore] = useState<QuizScore | null>(null);
  if (score) {
    return (
      <QuizResult
        title="Dictation done"
        score={score}
        good={score.correct / Math.max(1, score.total) >= 0.7}
        message="Words you missed go to your mistakes notebook and come back for review."
        onPrimary={() => {
          invalidate();
          router.back();
        }}
        testID="dictation-result"
      />
    );
  }
  return <QuizRunner title="Dictation" exercises={exercises} context="practice" unitId={null} onClose={() => router.back()} onFinish={setScore} />;
}

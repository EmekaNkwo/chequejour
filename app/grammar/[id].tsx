import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { QuizRunner, type QuizScore } from '../../components/exercises/QuizRunner';
import { GrammarLessonView } from '../../components/lesson/GrammarLessonView';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState, Loading, Screen } from '../../components/ui/Screen';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useApp } from '../../features/app/AppContext';
import { useLoad } from '../../features/app/useLoad';
import { useStudyTimer } from '../../features/progress/useStudyTimer';

/** Most exercises to practise one grammar point in a row. */
const PRACTICE_LIMIT = 10;

export default function GrammarLessonScreen() {
  const { content, invalidate } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [mode, setMode] = useState<'read' | 'practice' | QuizScore>('read');
  useStudyTimer();
  const { data, error, reload } = useLoad(
    'grammar lesson',
    async () => {
      const lesson = await content.item('grammar', id);
      if (!lesson) return { lesson: null, exercises: [] };
      const unitId = lesson.id.split('-')[0];
      const exercises = (await content.listKind('exercise', unitId)).filter((e) => e.grammarTag === lesson.grammarTag).slice(0, PRACTICE_LIMIT);
      return { lesson, unitId, exercises };
    },
    [id],
  );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (!data.lesson) return <ErrorState message="This grammar lesson couldn't be found." />;
  const { lesson, exercises } = data;

  if (mode === 'practice') {
    return (
      <QuizRunner
        title={lesson.title}
        exercises={exercises}
        context="practice"
        unitId={data.unitId ?? null}
        onFinish={(score) => {
          invalidate();
          setMode(score);
        }}
        onClose={() => setMode('read')}
      />
    );
  }

  return (
    <Screen testID="grammar-lesson-screen">
      <ScreenHeader title={lesson.title} back />
      {typeof mode === 'object' ? (
        <Card accessibilityLabel={`Practice finished: ${mode.correct} of ${mode.total} correct.`}>
          <AppText variant="cardTitle">{`${mode.correct}/${mode.total} correct`}</AppText>
          <AppText variant="meta" tone="muted">
            Wrong answers are saved in your mistakes notebook.
          </AppText>
        </Card>
      ) : null}
      <GrammarLessonView lesson={lesson} />
      {exercises.length > 0 ? (
        <Button label={typeof mode === 'object' ? 'Practise again' : `Practise this (${exercises.length})`} icon="edit-3" onPress={() => setMode('practice')} testID="practise-grammar" />
      ) : (
        <AppText variant="meta" tone="muted">
          Practice for this point is part of the unit&apos;s lessons and checkpoint.
        </AppText>
      )}
    </Screen>
  );
}

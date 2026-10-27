import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { QuizRunner, type QuizScore } from '../../components/exercises/QuizRunner';
import { GrammarLessonView } from '../../components/lesson/GrammarLessonView';
import { QuizResult } from '../../components/lesson/QuizResult';
import { WordCard } from '../../components/lesson/WordCard';
import { spacing } from '../../components/theme/tokens';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/Progress';
import { ErrorState, Loading, Screen } from '../../components/ui/Screen';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import type { Exercise, GrammarLesson, VocabItem } from '../../domain/content-types';
import { unitSegments, type Segment } from '../../domain/unit-path';
import { useApp } from '../../features/app/AppContext';
import { logError } from '../../features/app/log';
import { useLoad } from '../../features/app/useLoad';
import { useStudyTimer } from '../../features/progress/useStudyTimer';
import { learnWords } from '../../features/session/session-service';

interface LessonData {
  segment: Segment;
  words: VocabItem[];
  grammar: GrammarLesson | null;
  exercises: Exercise[];
}

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const segmentId = decodeURIComponent(id ?? '');
  const unitId = segmentId.split(':')[0] ?? '';
  const { content } = useApp();
  const { data, error, loading, reload } = useLoad(
    'lesson',
    async (): Promise<LessonData | null> => {
      const unit = await content.unit(unitId);
      const segment = unit ? unitSegments(unit).find((s) => s.id === segmentId) : undefined;
      if (!unit || !segment) return null;
      const ids = new Set(segment.itemIds);
      return {
        segment,
        words: unit.vocab.filter((v) => ids.has(v.id)),
        grammar: unit.grammar.find((g) => ids.has(g.id)) ?? null,
        exercises: unit.exercises.filter((e) => ids.has(e.id)),
      };
    },
    [segmentId],
  );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return loading ? <Loading /> : <ErrorState message="This lesson couldn't be found." />;
  return <Lesson data={data} unitId={unitId} />;
}

function Lesson({ data, unitId }: { data: LessonData; unitId: string }) {
  useStudyTimer();
  const { progress, invalidate } = useApp();
  const [score, setScore] = useState<QuizScore | null>(null);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const { segment } = data;

  const leave = () => {
    invalidate();
    router.back();
  };

  /** Words and grammar go straight back; practice shows its score first. */
  const complete = async (wordIds: readonly string[] = []) => {
    setSaving(true);
    const now = Date.now();
    try {
      if (wordIds.length > 0) await learnWords(progress, wordIds, now);
      await progress.completeSegment(segment.id, unitId, now);
    } catch (e: unknown) {
      logError('complete lesson', e);
    } finally {
      setSaving(false);
    }
    if (segment.kind === 'exercises') setFinished(true);
    else leave();
  };

  if (finished) {
    return (
      <QuizResult
        title="Bien joué !"
        score={score ?? undefined}
        message="Practice done. Any mistakes are saved in your notebook for review."
        onPrimary={leave}
        testID="lesson-screen"
        primaryTestID="lesson-complete"
      />
    );
  }

  switch (segment.kind) {
    case 'words':
      return <WordsLesson title={segment.title} words={data.words} saving={saving} onDone={() => void complete(data.words.map((w) => w.id))} />;
    case 'grammar':
      return data.grammar ? (
        <Screen testID="lesson-screen" footer={<Button label="I've read this" icon="check" onPress={() => void complete()} loading={saving} testID="lesson-complete" />}>
          <ScreenHeader title={segment.title} back />
          <GrammarLessonView lesson={data.grammar} />
        </Screen>
      ) : (
        <ErrorState message="This grammar lesson couldn't be found." />
      );
    case 'exercises':
      return (
        <QuizRunner
          title={segment.title}
          exercises={data.exercises}
          context="lesson"
          unitId={unitId}
          onClose={() => router.back()}
          onFinish={(s) => {
            setScore(s);
            void complete();
          }}
        />
      );
  }
}

interface WordsLessonProps {
  title: string;
  words: readonly VocabItem[];
  saving: boolean;
  onDone: () => void;
}

/** New words, one per screen. */
function WordsLesson({ title, words, saving, onDone }: WordsLessonProps) {
  const [index, setIndex] = useState(0);
  const word = words[index];
  const last = index >= words.length - 1;
  if (!word) return <ErrorState message="This lesson has no words." />;
  return (
    <Screen
      testID="lesson-screen"
      footer={
        <View style={styles.footer}>
          {index > 0 ? <Button label="Back" variant="secondary" onPress={() => setIndex(index - 1)} style={styles.flex} /> : null}
          <Button
            label={last ? 'Finish' : 'Next word'}
            icon={last ? 'check' : 'arrow-right'}
            onPress={last ? onDone : () => setIndex(index + 1)}
            loading={saving}
            style={styles.flex}
            testID={last ? 'lesson-complete' : 'lesson-next'}
          />
        </View>
      }
    >
      <ScreenHeader title={title} back />
      <View style={styles.progress}>
        <AppText variant="meta" tone="muted">{`Word ${index + 1} of ${words.length}`}</AppText>
        <ProgressBar value={(index + 1) / words.length} accessibilityLabel={`Word ${index + 1} of ${words.length}`} />
      </View>
      <Card>
        <WordCard key={word.id} word={word} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  progress: { gap: spacing.xs },
});

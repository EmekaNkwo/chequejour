import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { QuizRunner, type QuizScore } from '../components/exercises/QuizRunner';
import { QuizResult } from '../components/lesson/QuizResult';
import { spacing } from '../components/theme/tokens';
import { AppText } from '../components/ui/AppText';
import { Pill, Row, SegmentedTabs, SKILL_LABEL } from '../components/ui/Bits';
import { Button, IconButton } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorState, Loading, Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import type { Mistake } from '../data/progress-repo';
import { GRAMMAR_TAG_LABELS, type Exercise } from '../domain/content-types';
import { useApp } from '../features/app/AppContext';
import { logError } from '../features/app/log';
import { useLoad } from '../features/app/useLoad';
import { useStudyTimer } from '../features/progress/useStudyTimer';
import { mistakeExercise } from '../features/session/session-service';

type Filter = 'open' | 'all';

const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: 'open', label: 'To review' },
  { value: 'all', label: 'All, incl. cleared' },
];

export default function MistakesScreen() {
  const params = useLocalSearchParams<{ review?: string }>();
  const [reviewing, setReviewing] = useState(params.review === '1');
  if (reviewing) return <MistakeReview onExit={() => (params.review === '1' ? router.back() : setReviewing(false))} />;
  return <Notebook onReview={() => setReviewing(true)} />;
}

function Notebook({ onReview }: { onReview: () => void }) {
  const { progress, invalidate } = useApp();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('open');
  const { data, error, reload } = useLoad(
    'mistakes',
    async () => {
      const [list, due] = await Promise.all([progress.mistakes(filter === 'all'), progress.dueMistakes(Date.now())]);
      return { list, dueCount: due.length };
    },
    [filter],
  );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const remove = async (m: Mistake) => {
    const ok = await toast.confirm({
      title: 'Delete this mistake?',
      message: 'It will be removed from your notebook and won’t come back for review.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await progress.deleteMistake(m.id);
      invalidate();
      toast.show({ tone: 'success', title: 'Mistake deleted' });
    } catch (e: unknown) {
      logError('delete mistake', e);
      toast.show({ tone: 'error', title: 'Mistake not deleted', message: 'Please try again.' });
    }
  };

  return (
    <Screen testID="mistakes-screen">
      <ScreenHeader title="Mistakes notebook" back />
      <Card>
        <AppText variant="cardTitle">{data.dueCount > 0 ? `${data.dueCount} due for review` : 'Nothing due right now'}</AppText>
        <AppText variant="meta" tone="muted">
          Each mistake comes back after 1, 3 and 7 days. Two correct answers in a row clear it.
        </AppText>
        <Button label="Review due mistakes" icon="repeat" onPress={onReview} disabled={data.dueCount === 0} style={styles.mt} testID="review-mistakes" />
      </Card>
      <SegmentedTabs options={FILTERS} value={filter} onChange={setFilter} />
      {data.list.length === 0 ? (
        <AppText variant="body" tone="muted">
          {filter === 'open' ? 'No open mistakes. Errors you make are saved here and come back for review.' : 'No mistakes saved yet.'}
        </AppText>
      ) : (
        data.list.map((m) => <MistakeCard key={m.id} mistake={m} onDelete={() => void remove(m)} />)
      )}
    </Screen>
  );
}

function MistakeCard({ mistake: m, onDelete }: { mistake: Mistake; onDelete: () => void }) {
  const topic = m.grammarTag && m.grammarTag !== 'vocabulary' ? GRAMMAR_TAG_LABELS[m.grammarTag] : SKILL_LABEL[m.skill];
  return (
    <Card accessibilityLabel={`Mistake: ${m.prompt}. You answered ${m.userAnswer}. Correct answer: ${m.correctAnswer}. ${m.explanation}`}>
      <Row style={styles.between}>
        <Row gap={spacing.sm} style={styles.flex}>
          <Pill label={topic.toUpperCase()} />
          {m.resolved ? <Pill label="CLEARED" /> : null}
        </Row>
        <IconButton icon="trash-2" label="Delete this mistake" onPress={onDelete} size={40} />
      </Row>
      <AppText variant="meta" tone="muted" style={styles.mt}>
        {m.prompt}
      </AppText>
      <AppText variant="bodyStrong" tone="danger" style={styles.strike}>
        {m.userAnswer}
      </AppText>
      <AppText variant="french" french>
        {m.correctAnswer}
      </AppText>
      <AppText variant="body" tone="secondary" style={styles.mt}>
        {m.explanation}
      </AppText>
      <AppText variant="meta" tone="muted" style={styles.mt}>
        {`Wrong ${m.timesWrong} time${m.timesWrong === 1 ? '' : 's'}`}
      </AppText>
    </Card>
  );
}

function MistakeReview({ onExit }: { onExit: () => void }) {
  const { content, progress } = useApp();
  const { data, error, reload } = useLoad(
    'mistake review',
    async () => {
      const due = await progress.dueMistakes(Date.now());
      const exercises = await Promise.all(due.map((m) => mistakeExercise(content, m)));
      // A mistake whose exercise can't be rebuilt (removed content, older app versions)
      // would otherwise stay due forever and keep the daily session from completing.
      await Promise.all(due.filter((_, i) => exercises[i] === null).map((m) => progress.resolveMistake(m.id)));
      return exercises.filter((e): e is Exercise => e !== null);
    },
    [],
  );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (data.length === 0) {
    return <QuizResult title="All clear" message="No mistakes are due for review right now." onPrimary={onExit} testID="mistakes-empty" />;
  }
  return <MistakeQuiz exercises={data} onExit={onExit} />;
}

function MistakeQuiz({ exercises, onExit }: { exercises: readonly Exercise[]; onExit: () => void }) {
  useStudyTimer();
  const { invalidate } = useApp();
  // Fixed for the session so answering doesn't reshuffle the list.
  const [items] = useState(exercises);
  const [score, setScore] = useState<QuizScore | null>(null);
  if (score) {
    return (
      <QuizResult
        title="Mistakes reviewed"
        score={score}
        message="Correct answers push a mistake further out; wrong ones bring it back tomorrow."
        onPrimary={() => {
          invalidate();
          onExit();
        }}
        testID="mistakes-result"
      />
    );
  }
  return <QuizRunner title="Mistakes" exercises={items} context="mistakes" unitId={null} onClose={onExit} onFinish={setScore} />;
}

const styles = StyleSheet.create({
  mt: { marginTop: spacing.sm },
  flex: { flex: 1, flexWrap: 'wrap' },
  between: { justifyContent: 'space-between' },
  strike: { textDecorationLine: 'line-through' },
});

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { QuizRunner, type QuizScore } from '../components/exercises/QuizRunner';
import { QuizResult } from '../components/lesson/QuizResult';
import { spacing } from '../components/theme/tokens';
import { AppText } from '../components/ui/AppText';
import { LinkText, Pill, Row, SectionTitle, SegmentedTabs, SKILL_LABEL } from '../components/ui/Bits';
import { Button, IconButton } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorState, Loading, Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import type { Mistake } from '../data/progress-repo';
import { GRAMMAR_TAG_LABELS, type Exercise, type GrammarTag } from '../domain/content-types';
import { toDayKey } from '../domain/dates';
import { groupMistakes } from '../domain/mistakes';
import { useApp } from '../features/app/AppContext';
import { logError } from '../features/app/log';
import { useLoad } from '../features/app/useLoad';
import { useStudyTimer } from '../features/progress/useStudyTimer';
import { buildDrill } from '../features/mistakes/drill-service';
import { mistakeExercise } from '../features/session/session-service';

type Filter = 'open' | 'topics' | 'all';

const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: 'open', label: 'To review' },
  { value: 'topics', label: 'By topic' },
  { value: 'all', label: 'All, incl. cleared' },
];

type Mode = { kind: 'notebook' } | { kind: 'review' } | { kind: 'drill'; tag: GrammarTag };

const isGrammarTag = (tag: string | undefined): tag is GrammarTag => tag !== undefined && tag in GRAMMAR_TAG_LABELS;

export default function MistakesScreen() {
  const params = useLocalSearchParams<{ review?: string; drill?: string }>();
  const opened: Mode = params.review === '1' ? { kind: 'review' } : isGrammarTag(params.drill) ? { kind: 'drill', tag: params.drill } : { kind: 'notebook' };
  const [mode, setMode] = useState<Mode>(opened);
  // Opened straight into a review or drill from elsewhere: leaving goes back there.
  const exit = () => (opened.kind !== 'notebook' ? router.back() : setMode({ kind: 'notebook' }));
  if (mode.kind === 'review') return <MistakeReview onExit={exit} />;
  if (mode.kind === 'drill') return <Drill tag={mode.tag} onExit={exit} />;
  return <Notebook onReview={() => setMode({ kind: 'review' })} onDrill={(tag) => setMode({ kind: 'drill', tag })} />;
}

function Notebook({ onReview, onDrill }: { onReview: () => void; onDrill: (tag: GrammarTag) => void }) {
  const { progress, invalidate } = useApp();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('open');
  const { data, error, reload } = useLoad(
    'mistakes',
    async () => {
      const [list, due, open] = await Promise.all([progress.mistakes(filter === 'all'), progress.dueMistakes(Date.now()), progress.mistakes()]);
      return { list, dueCount: due.length, groups: groupMistakes(open) };
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

  const weakest = data.groups.byGrammar[0] ?? null;

  return (
    <Screen testID="mistakes-screen">
      <ScreenHeader title="Mistakes notebook" back />
      <Card>
        <AppText variant="cardTitle">{data.dueCount > 0 ? `${data.dueCount} due for review` : 'Nothing due right now'}</AppText>
        <AppText variant="meta" tone="muted">
          Each mistake comes back after 1, 3 and 7 days. Three correct answers in a row clear it.
        </AppText>
        <Button label="Review due mistakes" icon="repeat" onPress={onReview} disabled={data.dueCount === 0} style={styles.mt} testID="review-mistakes" />
        {weakest ? (
          <Button
            label={`Drill my weakest point: ${weakest.label}`}
            icon="target"
            variant="secondary"
            onPress={() => onDrill(weakest.tag)}
            style={styles.mt}
            testID="drill-weakest"
          />
        ) : null}
      </Card>
      <SegmentedTabs options={FILTERS} value={filter} onChange={setFilter} />
      {filter === 'topics' ? (
        <Topics groups={data.groups} onDrill={onDrill} />
      ) : data.list.length === 0 ? (
        <AppText variant="body" tone="muted">
          {filter === 'open' ? 'No open mistakes. Errors you make are saved here and come back for review.' : 'No mistakes saved yet.'}
        </AppText>
      ) : (
        data.list.map((m) => <MistakeCard key={m.id} mistake={m} onDelete={() => void remove(m)} />)
      )}
    </Screen>
  );
}

function Topics({ groups, onDrill }: { groups: ReturnType<typeof groupMistakes>; onDrill: (tag: GrammarTag) => void }) {
  if (groups.bySkill.length === 0) {
    return (
      <AppText variant="body" tone="muted">
        No open mistakes, so nothing to group yet.
      </AppText>
    );
  }
  return (
    <>
      <SectionTitle title="By grammar point" />
      {groups.byGrammar.length === 0 ? (
        <AppText variant="body" tone="muted">
          Your open mistakes are about words and comprehension, not a grammar point.
        </AppText>
      ) : (
        groups.byGrammar.map((g) => (
          <Card key={g.tag} accessibilityLabel={`${g.label}: ${g.count} open mistake${g.count === 1 ? '' : 's'}`} testID={`topic-${g.tag}`}>
            <Row style={styles.between}>
              <View style={styles.flex}>
                <AppText variant="cardTitle">{g.label}</AppText>
                <AppText variant="meta" tone="muted">{`${g.count} open · wrong ${g.timesWrong} time${g.timesWrong === 1 ? '' : 's'} in all`}</AppText>
              </View>
              <LinkText label="Drill" icon="target" onPress={() => onDrill(g.tag)} />
            </Row>
          </Card>
        ))
      )}
      <SectionTitle title="By skill" />
      <Card>
        {groups.bySkill.map((g) => (
          <Row key={g.skill} style={[styles.between, styles.mtXs]}>
            <AppText variant="body">{SKILL_LABEL[g.skill]}</AppText>
            <AppText variant="bodyStrong">{String(g.count)}</AppText>
          </Row>
        ))}
      </Card>
    </>
  );
}

function Drill({ tag, onExit }: { tag: GrammarTag; onExit: () => void }) {
  const { content, progress } = useApp();
  const { data, error, reload } = useLoad(`drill ${tag}`, () => buildDrill(content, progress, tag, toDayKey(new Date())), [tag]);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (data.length === 0) {
    return <QuizResult title="Nothing to drill" message={`There are no exercises on ${GRAMMAR_TAG_LABELS[tag]} yet.`} onPrimary={onExit} testID="drill-empty" />;
  }
  return <MistakeQuiz title={`Drill · ${GRAMMAR_TAG_LABELS[tag]}`} exercises={data} onExit={onExit} />;
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

function MistakeQuiz({ exercises, onExit, title = 'Mistakes' }: { exercises: readonly Exercise[]; onExit: () => void; title?: string }) {
  useStudyTimer();
  const { invalidate } = useApp();
  // Fixed for the session so answering doesn't reshuffle the list.
  const [items] = useState(exercises);
  const [score, setScore] = useState<QuizScore | null>(null);
  if (score) {
    return (
      <QuizResult
        title={title === 'Mistakes' ? 'Mistakes reviewed' : 'Drill done'}
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
  return <QuizRunner title={title} exercises={items} context="mistakes" unitId={null} onClose={onExit} onFinish={setScore} />;
}

const styles = StyleSheet.create({
  mt: { marginTop: spacing.sm },
  mtXs: { marginTop: spacing.xs },
  flex: { flex: 1, flexWrap: 'wrap' },
  between: { justifyContent: 'space-between' },
  strike: { textDecorationLine: 'line-through' },
});

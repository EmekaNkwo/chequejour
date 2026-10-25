import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AudioControls } from '../../components/audio/AudioControls';
import { McqView } from '../../components/exercises/ExerciseView';
import { ComprehensionQuiz } from '../../components/skills/ComprehensionQuiz';
import { useTheme } from '../../components/theme/ThemeProvider';
import { spacing } from '../../components/theme/tokens';
import { AppText } from '../../components/ui/AppText';
import { ListRow, Pill, Row, SectionTitle, SKILL_ICON } from '../../components/ui/Bits';
import { Button, IconButton } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ProgressBar, ProgressRing } from '../../components/ui/Progress';
import { ErrorState, Loading, Screen } from '../../components/ui/Screen';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useToast } from '../../components/ui/Toast';
import { audioKey, listeningScript } from '../../domain/audio-keys';
import type { ListeningItem, MockTest, MockTestSection, ReadingItem } from '../../domain/content-types';
import { labelFor } from '../../domain/level';
import { useApp } from '../../features/app/AppContext';
import { logError } from '../../features/app/log';
import { useLoad } from '../../features/app/useLoad';
import { recordExerciseResult } from '../../features/exercises/record-result';
import { loadPath } from '../../features/path/path-service';
import { levelOverview } from '../../features/progress/stats-service';
import { useStudyTimer } from '../../features/progress/useStudyTimer';
import { masteredIds } from '../../features/session/session-service';
import { mockTotals, scoreSection, sectionQuestions, totalMinutes, type MockAnswer, type MockSectionResult } from '../../features/skills/mock-scoring';
import { formatClock } from '../../features/skills/skill-items';
import { useCountdown } from '../../features/skills/useCountdown';

const ESTIMATE_NOTE = 'This is a practice estimate from an unofficial mock test. It is not an official TCF score and does not predict one.';

type Stage = { kind: 'intro' } | { kind: 'section'; index: number } | { kind: 'results' };

export default function MockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { content, progress, settings } = useApp();
  const { data, error, reload } = useLoad(
    `mock ${id}`,
    async () => {
      const mastered = await masteredIds(progress);
      const path = await loadPath(content, progress, settings.placementLevel, mastered);
      const [mock, level, results] = await Promise.all([
        content.item('mock', id),
        levelOverview(progress, path, settings.placementLevel, mastered.size),
        progress.mockResults(),
      ]);
      return { mock, unlocked: level.mockUnlocked, previous: results.filter((r) => r.mockId === id) };
    },
    [id, settings.placementLevel],
  );
  // Once opened, stay open: the test's own answers feed the estimate, so a reload mid-test
  // could otherwise flip it back to locked and discard the run.
  const [wasUnlocked, setWasUnlocked] = useState(false);
  if (data?.unlocked && !wasUnlocked) setWasUnlocked(true);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (!data.mock) return <ErrorState message="This mock test couldn't be found." />;
  if (!data.unlocked && !wasUnlocked) return <Locked title={data.mock.title} />;
  return <MockRun mock={data.mock} previousBest={data.previous.reduce<number | null>((best, r) => Math.max(best ?? 0, r.total), null)} />;
}

function Locked({ title }: { title: string }) {
  return (
    <Screen testID="mock-locked">
      <ScreenHeader title={title} back />
      <Card>
        <AppText variant="cardTitle">Not unlocked yet</AppText>
        <AppText variant="body" tone="secondary" style={styles.mt}>
          The timed mock test opens once your practice estimate gets close to B1, or when you have completed every A2 and A2+ unit. Keep going with your daily sessions — it will appear in Practice when you are ready.
        </AppText>
      </Card>
    </Screen>
  );
}

function MockRun({ mock, previousBest }: { mock: MockTest; previousBest: number | null }) {
  const { progress, invalidate } = useApp();
  const toast = useToast();
  const [stage, setStage] = useState<Stage>({ kind: 'intro' });
  const [results, setResults] = useState<MockSectionResult[]>([]);

  const finishSection = (result: MockSectionResult) => {
    const next = [...results, result];
    setResults(next);
    if (stage.kind === 'section' && stage.index + 1 < mock.sections.length) {
      setStage({ kind: 'section', index: stage.index + 1 });
      return;
    }
    const totals = mockTotals(next);
    progress
      .saveMockResult(mock.id, totals.sectionScores, totals.total, Date.now())
      .then(invalidate)
      .catch((e: unknown) => logError('save mock result', e));
    setStage({ kind: 'results' });
  };

  const quit = async () => {
    const leave = await toast.confirm({
      title: 'Leave the mock test?',
      message: 'Your answers so far will not be scored.',
      confirmLabel: 'Leave',
      cancelLabel: 'Keep going',
      destructive: true,
    });
    if (!leave) return;
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (stage.kind === 'intro') {
    return (
      <Intro
        mock={mock}
        previousBest={previousBest}
        onStart={() => {
          setResults([]);
          setStage({ kind: 'section', index: 0 });
        }}
      />
    );
  }
  if (stage.kind === 'results') return <Results mock={mock} results={results} />;
  const section = mock.sections[stage.index];
  if (!section) return null;
  return <SectionRun key={stage.index} section={section} index={stage.index} count={mock.sections.length} onFinish={finishSection} onQuit={() => void quit()} />;
}

function Intro({ mock, previousBest, onStart }: { mock: MockTest; previousBest: number | null; onStart: () => void }) {
  const { colors } = useTheme();
  return (
    <Screen testID="mock-intro" footer={<Button label="Start the test" icon="play" onPress={onStart} testID="mock-start" />}>
      <ScreenHeader title={mock.title} back subtitle={`TCF-style mock · ${totalMinutes(mock)} minutes`} />
      <Card>
        <AppText variant="cardTitle">How it works</AppText>
        <AppText variant="body" tone="secondary" style={styles.mt}>
          Each section has its own timer and moves on by itself when time runs out. You see your answers and explanations only at the end, as in the real exam. Unanswered questions count as wrong.
        </AppText>
      </Card>
      {mock.sections.map((s, i) => (
        <Card key={s.title} accessibilityLabel={`Section ${i + 1}: ${s.title}, ${s.minutes} minutes, ${sectionQuestions(s).length} questions`}>
          <Row>
            <Pill label={`${i + 1}`} color={colors.skills[s.skill].tint} textColor={colors.skills[s.skill].onTint} icon={SKILL_ICON[s.skill]} />
            <View style={styles.flex}>
              <AppText variant="cardTitle">{s.title}</AppText>
              <AppText variant="meta" tone="muted">
                {`${sectionQuestions(s).length} questions`}
              </AppText>
            </View>
            <AppText variant="bodyStrong">{`${s.minutes} min`}</AppText>
          </Row>
        </Card>
      ))}
      <AppText variant="meta" tone="muted">
        {`Writing and speaking tasks are listed after the test for self-assessed practice. ${ESTIMATE_NOTE}`}
      </AppText>
      {previousBest !== null ? (
        <AppText variant="meta" tone="muted">
          {`Your best so far: ${Math.round(previousBest * 100)}%`}
        </AppText>
      ) : null}
    </Screen>
  );
}

interface SectionRunProps {
  section: MockTestSection;
  index: number;
  count: number;
  onFinish: (result: MockSectionResult) => void;
  onQuit: () => void;
}

/** One timed section. Answers are kept in a ref so a timeout can score what was answered. */
function SectionRun({ section, index, count, onFinish, onQuit }: SectionRunProps) {
  useStudyTimer();
  const { colors } = useTheme();
  const { progress } = useApp();
  const answers = useRef<MockAnswer[]>([]);
  const finished = useRef(false);
  const [step, setStep] = useState(0);

  const timer = useCountdown(() => finish());
  function finish() {
    if (finished.current) return;
    finished.current = true;
    timer.stop();
    onFinish(scoreSection(section, answers.current));
  }
  const { start } = timer;
  // Starts once per section; SectionRun is keyed by section index.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => start(section.minutes * 60), []);

  const addAnswer = (a: MockAnswer) => {
    answers.current = [...answers.current, a];
  };

  const texts: (ListeningItem | ReadingItem)[] = [...(section.listening ?? []), ...(section.reading ?? [])];
  const questions = section.questions ?? [];
  const steps = texts.length + questions.length;
  const next = () => (step + 1 >= steps ? finish() : setStep(step + 1));
  const lowTime = timer.remaining <= 60;

  return (
    <Screen testID={`mock-section-${section.skill}`}>
      <Row>
        <IconButton icon="x" label="Leave the mock test" onPress={onQuit} testID="mock-quit" />
        <View style={styles.flex}>
          <AppText variant="meta" tone="muted" numberOfLines={1}>
            {`Section ${index + 1} of ${count} · ${section.title}`}
          </AppText>
          <ProgressBar value={steps > 0 ? step / steps : 0} color={colors.skills.tests.base} track={colors.skills.tests.tint} accessibilityLabel={`Part ${step + 1} of ${steps}`} />
        </View>
        <View
          style={[styles.clock, { backgroundColor: lowTime ? colors.dangerTint : colors.skills.tests.tint }]}
          accessible
          accessibilityLabel={`${formatClock(timer.remaining)} left in this section`}
        >
          <AppText variant="bodyStrong" color={lowTime ? colors.danger : colors.skills.tests.onTint}>
            {formatClock(timer.remaining)}
          </AppText>
        </View>
      </Row>

      {step < texts.length ? (
        <TextStep key={texts[step].id} item={texts[step]} onAnswer={addAnswer} onDone={next} />
      ) : questions[step - texts.length] ? (
        <Card>
          <McqView
            key={questions[step - texts.length].id}
            exercise={questions[step - texts.length]}
            answered={null}
            onAnswer={(outcome, userAnswer) => {
              const exercise = questions[step - texts.length];
              const picked = exercise.options.indexOf(userAnswer);
              addAnswer({ questionId: exercise.id, picked, correct: outcome.result !== 'wrong' });
              recordExerciseResult(progress, { exercise, result: outcome.result, userAnswer, context: 'mock', unitId: null, now: Date.now() }).catch(
                (e: unknown) => logError('record mock answer', e),
              );
              next();
            }}
          />
        </Card>
      ) : null}

      <Button label="End this section now" variant="ghost" onPress={finish} />
    </Screen>
  );
}

function TextStep({ item, onAnswer, onDone }: { item: ListeningItem | ReadingItem; onAnswer: (a: MockAnswer) => void; onDone: () => void }) {
  const isListening = 'lines' in item;
  return (
    <>
      <Card>
        <AppText variant="label" tone="muted">
          {isListening ? 'LISTEN' : 'READ'}
        </AppText>
        <AppText variant="cardTitle">{item.title}</AppText>
        {isListening ? (
          <>
            <AppText variant="body" tone="secondary" style={styles.mt}>
              {item.context}
            </AppText>
            <View style={styles.audio}>
              <AudioControls audioKey={audioKey.listening(item.id)} text={listeningScript(item.lines)} />
            </View>
          </>
        ) : (
          <AppText variant="french" french style={styles.mt}>
            {item.text}
          </AppText>
        )}
      </Card>
      <Card>
        <ComprehensionQuiz
          questions={item.questions}
          skill={isListening ? 'listening' : 'reading'}
          level={item.level}
          unitId={null}
          context="mock"
          showFeedback={false}
          onAnswer={(a) => onAnswer({ questionId: a.question.id, picked: a.picked, correct: a.correct })}
          onFinish={onDone}
        />
      </Card>
    </>
  );
}

function Results({ mock, results }: { mock: MockTest; results: readonly MockSectionResult[] }) {
  const { colors } = useTheme();
  const totals = mockTotals(results);
  const pct = Math.round(totals.total * 100);
  const review = results.flatMap((r) => r.review.map((item) => ({ ...item, section: r.title })));
  return (
    <Screen testID="mock-results">
      <ScreenHeader title="Results" back subtitle={mock.title} />
      <Card accessibilityLabel={`Total ${pct} percent. Estimated level ${labelFor(totals.total)}, practice estimate.`}>
        <Row gap={spacing.lg}>
          <ProgressRing value={totals.total} size={92} color={colors.skills.tests.base} track={colors.skills.tests.tint} accessibilityLabel={`Total score ${pct} percent`} />
          <View style={styles.flex}>
            <AppText variant="cardTitle">{`Estimated level: ${labelFor(totals.total)}`}</AppText>
            <AppText variant="meta" tone="muted">
              {ESTIMATE_NOTE}
            </AppText>
          </View>
        </Row>
      </Card>

      <Card>
        {results.map((r) => {
          const p = r.total > 0 ? r.correct / r.total : 0;
          return (
            <View key={r.title} style={styles.section} accessible accessibilityLabel={`${r.title}: ${r.correct} of ${r.total}, ${Math.round(p * 100)} percent`}>
              <Row style={styles.between}>
                <AppText variant="bodyStrong">{r.title}</AppText>
                <AppText variant="meta" tone="muted">{`${r.correct}/${r.total} · ${Math.round(p * 100)}%`}</AppText>
              </Row>
              <ProgressBar value={p} color={colors.skills[r.skill].base} track={colors.skills[r.skill].tint} height={10} />
            </View>
          );
        })}
      </Card>

      {review.length > 0 ? <SectionTitle title={`To review (${review.length})`} /> : null}
      {review.map((item) => (
        <Card key={item.questionId} accessibilityLabel={`${item.question}. Your answer: ${item.userAnswer ?? 'none'}. Correct answer: ${item.correctAnswer}. ${item.explanation}`}>
          <AppText variant="label" tone="muted">
            {item.section.toUpperCase()}
          </AppText>
          <AppText variant="bodyStrong">{item.question}</AppText>
          <AppText variant="body" tone="danger" style={item.userAnswer ? styles.strike : undefined}>
            {item.userAnswer ?? 'No answer — time ran out'}
          </AppText>
          <AppText variant="bodyStrong" tone="success">
            {item.correctAnswer}
          </AppText>
          <AppText variant="meta" tone="muted">
            {item.explanation}
          </AppText>
        </Card>
      ))}

      {mock.writing.length + mock.speaking.length > 0 ? (
        <>
          <SectionTitle title="Writing and speaking" />
          <AppText variant="meta" tone="muted">
            Self-assessed: compare your work with the model answers and checklists.
          </AppText>
          {mock.writing.map((w) => (
            <ListRow key={w.id} skill="writing" category={`Writing · ${w.minWords}–${w.maxWords} words`} title={w.title} icon="edit-3" onPress={() => router.push(`/writing/${w.id}?mock=${mock.id}`)} />
          ))}
          {mock.speaking.map((s) => (
            <ListRow key={s.id} skill="speaking" category={`Speaking · ${formatClock(s.speakSeconds)}`} title={s.title} icon="mic" onPress={() => router.push(`/speaking/${s.id}?mock=${mock.id}`)} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  mt: { marginTop: spacing.sm },
  between: { justifyContent: 'space-between' },
  clock: { minWidth: 72, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  audio: { marginVertical: spacing.xl },
  section: { gap: spacing.sm, marginBottom: spacing.md },
  strike: { textDecorationLine: 'line-through' },
});

import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { AnswerInput } from '../../components/exercises/inputs';
import { useTheme } from '../../components/theme/ThemeProvider';
import { spacing } from '../../components/theme/tokens';
import { AppText } from '../../components/ui/AppText';
import { LevelPill, LinkText, Pill, Row } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { WritingAiFeedback, useWarmWritingFeedback } from '../../components/ai/WritingAiFeedback';
import { Card } from '../../components/ui/Card';
import { PressableScale } from '../../components/ui/PressableScale';
import { ErrorState, Loading, Screen } from '../../components/ui/Screen';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { TestClock } from '../../components/mock/TestClock';
import { useToast } from '../../components/ui/Toast';
import { WordCounter } from '../../components/writing/WordCounter';
import { HintList, PastSubmissions, SideBySide, useNounGenders } from '../../components/writing/WritingFeedback';
import type { WritingSubmission } from '../../data/progress-repo';
import type { WritingTask } from '../../domain/content-types';
import { writingTaskMinutes } from '../../domain/tcf/exam-format';
import type { WritingHint } from '../../domain/writing/hints';
import { useApp } from '../../features/app/AppContext';
import { logError } from '../../features/app/log';
import { useLoad } from '../../features/app/useLoad';
import { useStudyTimer } from '../../features/progress/useStudyTimer';
import { countWords, findWriting, unitIdOf } from '../../features/skills/skill-items';
import { useCountdown } from '../../features/skills/useCountdown';
import { submitWriting } from '../../features/writing/writing-service';

const TASK_LABEL: Readonly<Record<WritingTask['taskType'], string>> = {
  message: 'Short message',
  description: 'Description',
  opinion: 'Opinion',
};

const AUTOSAVE_MS = 800;

export default function WritingScreen() {
  const { id, mock } = useLocalSearchParams<{ id: string; mock?: string }>();
  const { content, progress } = useApp();
  const { data, error, reload } = useLoad(
    `writing ${id}`,
    async () => {
      const [task, draft, submissions] = await Promise.all([findWriting(content, id, mock), progress.draft(id), progress.submissions(id)]);
      return { task, draft, submissions };
    },
    [id, mock],
  );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (!data.task) return <ErrorState message="This writing task couldn't be found." />;
  return <Writing task={data.task} draft={data.draft} submissions={data.submissions} />;
}

interface WritingProps {
  task: WritingTask;
  draft: { text: string; checklist: boolean[] } | null;
  submissions: WritingSubmission[];
}

function Writing({ task, draft, submissions: initialSubmissions }: WritingProps) {
  useStudyTimer();
  const { colors } = useTheme();
  const { progress, invalidate } = useApp();
  const [text, setText] = useState(draft?.text ?? '');
  const aiInput = { taskType: task.taskType, level: task.level, promptFr: task.promptFr, minWords: task.minWords, maxWords: task.maxWords, text };
  useWarmWritingFeedback(aiInput);
  const [checked, setChecked] = useState<boolean[]>(() => task.checklist.map((_, i) => draft?.checklist[i] ?? false));
  const [showModel, setShowModel] = useState(false);
  const [done, setDone] = useState(false);
  const [hints, setHints] = useState<WritingHint[] | null>(null);
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const genders = useNounGenders();
  const toast = useToast();
  const minutes = writingTaskMinutes(task.taskType);
  const timer = useCountdown(() => {
    toast.show({ tone: 'info', title: "Time's up", message: `${minutes} minutes is this task's share of the exam's hour. Finish your sentence and hand in.` });
  });
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      progress.saveDraft(task.id, text, checked, Date.now()).catch((e: unknown) => logError('save draft', e));
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [text, checked, task.id, progress]);

  // Saves whatever is pending when the learner leaves before the autosave fires.
  const initial = useRef(JSON.stringify({ text, checked }));
  const latest = useRef({ text, checked, dirty: false });
  useEffect(() => {
    latest.current = {
      text,
      checked,
      dirty: JSON.stringify({ text, checked }) !== initial.current,
    };
  }, [text, checked]);
  useEffect(
    () => () => {
      const { text: t, checked: c, dirty } = latest.current;
      if (dirty) progress.saveDraft(task.id, t, c, Date.now()).catch((e: unknown) => logError('save draft on leave', e));
    },
    [task.id, progress],
  );

  const words = countWords(text);

  const handIn = () => {
    if (!genders) return;
    timer.stop();
    const now = Date.now();
    const earlier = submissions;
    progress
      .saveDraft(task.id, text, checked, now)
      .then(() => submitWriting(progress, genders, task, text, now))
      .then((found) => {
        setHints(found);
        // The new hand-in is shown above, so the list keeps only the earlier ones.
        setSubmissions(earlier);
        return progress.completeSkillItem(task.id, 'writing', unitIdOf(task.id), null, now);
      })
      .then(() => {
        setDone(true);
        setShowModel(false);
        invalidate();
      })
      .catch((e: unknown) => logError('hand in writing', e));
  };

  const handInAgain = () => {
    progress
      .submissions(task.id)
      .then((all) => {
        setSubmissions(all);
        setHints(null);
        setDone(false);
      })
      .catch((e: unknown) => logError('load submissions', e));
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen testID="writing-screen">
        <ScreenHeader title={task.title} back />
        <Row gap={spacing.sm}>
          <Pill label={TASK_LABEL[task.taskType].toUpperCase()} color={colors.skills.writing.tint} textColor={colors.skills.writing.onTint} icon="edit-3" />
          <LevelPill level={task.level} />
        </Row>

        <Card>
          <AppText variant="body" tone="secondary">
            {task.instructions}
          </AppText>
          <AppText variant="french" french style={styles.mt}>
            {task.promptFr}
          </AppText>
          <AppText variant="meta" tone="muted" style={styles.mt}>
            {`${task.minWords}–${task.maxWords} words`}
          </AppText>
        </Card>

        <Card>
          <AnswerInput
            value={text}
            onChange={setText}
            onSubmit={() => undefined}
            multiline
            placeholder="Écrivez votre texte ici…"
            accessibilityLabel="Your text"
            testID="writing-input"
          />
          <WordCounter text={text} minWords={task.minWords} maxWords={task.maxWords} />
          <Row style={[styles.between, styles.mt]}>
            {timer.running ? (
              <TestClock seconds={timer.remaining} label="for this task" />
            ) : (
              <LinkText label={`Time me (${minutes} min, as in the exam)`} icon="clock" onPress={() => timer.start(minutes * 60)} />
            )}
            {timer.running ? <LinkText label="Stop" onPress={timer.stop} /> : null}
          </Row>
          <AppText variant="meta" tone="muted" style={styles.mt}>
            Draft saved on this device
          </AppText>
        </Card>

        <Card>
          <AppText variant="cardTitle">Check your own work</AppText>
          <AppText variant="meta" tone="muted">
            Nothing is sent anywhere and there is no score. Tick each point once your text does it; after you hand in, the phone adds a few possible tips.
          </AppText>
          {task.checklist.map((item, i) => (
            <PressableScale
              key={item}
              onPress={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: checked[i] }}
              accessibilityLabel={item}
              style={styles.check}
            >
              <Feather name={checked[i] ? 'check-square' : 'square'} size={22} color={checked[i] ? colors.success : colors.textMuted} />
              <AppText variant="body" style={styles.flex}>
                {item}
              </AppText>
            </PressableScale>
          ))}
        </Card>

        {done && hints ? (
          <>
            <Card color={colors.successTint} accessibilityLabel="Handed in">
              <AppText variant="cardTitle" tone="success">
                Handed in. Bon travail !
              </AppText>
              <AppText variant="meta" tone="secondary">
                Saved with your earlier versions. Edit your text and hand it in again whenever you like.
              </AppText>
            </Card>
            <Card>
              <HintList hints={hints} />
            </Card>
            <WritingAiFeedback input={aiInput} />
            <Card>
              <AppText variant="cardTitle">Compare with the model</AppText>
              <AppText variant="meta" tone="muted">
                One good answer among many: compare structure and linking words, not wording.
              </AppText>
              <SideBySide yours={text} model={task.modelAnswer} />
            </Card>
          </>
        ) : null}

        <PastSubmissions submissions={submissions} />

        {done ? null : (
          <Card>
            <Row style={styles.between}>
              <AppText variant="cardTitle">Model answer</AppText>
              <LinkText label={showModel ? 'Hide' : 'Show'} onPress={() => setShowModel((v) => !v)} />
            </Row>
            {showModel ? (
              <View style={styles.mt}>
                <AppText variant="french" french>
                  {task.modelAnswer}
                </AppText>
                <AppText variant="meta" tone="muted" style={styles.mt}>
                  {`${countWords(task.modelAnswer)} words. One good answer among many — compare structure and connectors, not wording.`}
                </AppText>
              </View>
            ) : (
              <AppText variant="meta" tone="muted">
                Write your own version first, then compare.
              </AppText>
            )}
          </Card>
        )}

        {done ? (
          <Row>
            <Button label="Write again" variant="secondary" icon="edit-3" onPress={handInAgain} style={styles.flex} testID="writing-again" />
            <Button label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.flex} />
          </Row>
        ) : (
          <Button label="Hand in" icon="check" onPress={handIn} disabled={words === 0 || !genders} testID="writing-done" />
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt: { marginTop: spacing.sm },
  between: { justifyContent: 'space-between' },
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    marginTop: spacing.sm,
  },
});

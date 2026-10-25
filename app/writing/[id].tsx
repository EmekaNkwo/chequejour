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
import { Card } from '../../components/ui/Card';
import { PressableScale } from '../../components/ui/PressableScale';
import { ErrorState, Loading, Screen } from '../../components/ui/Screen';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import type { WritingTask } from '../../domain/content-types';
import { useApp } from '../../features/app/AppContext';
import { logError } from '../../features/app/log';
import { useLoad } from '../../features/app/useLoad';
import { useStudyTimer } from '../../features/progress/useStudyTimer';
import { countWords, findWriting, unitIdOf } from '../../features/skills/skill-items';

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
      const [task, draft] = await Promise.all([findWriting(content, id, mock), progress.draft(id)]);
      return { task, draft };
    },
    [id, mock],
  );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (!data.task) return <ErrorState message="This writing task couldn't be found." />;
  return <Writing task={data.task} draft={data.draft} />;
}

function Writing({ task, draft }: { task: WritingTask; draft: { text: string; checklist: boolean[] } | null }) {
  useStudyTimer();
  const { colors } = useTheme();
  const { progress, invalidate } = useApp();
  const [text, setText] = useState(draft?.text ?? '');
  const [checked, setChecked] = useState<boolean[]>(() => task.checklist.map((_, i) => draft?.checklist[i] ?? false));
  const [showModel, setShowModel] = useState(false);
  const [done, setDone] = useState(false);
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
    latest.current = { text, checked, dirty: JSON.stringify({ text, checked }) !== initial.current };
  }, [text, checked]);
  useEffect(
    () => () => {
      const { text: t, checked: c, dirty } = latest.current;
      if (dirty) progress.saveDraft(task.id, t, c, Date.now()).catch((e: unknown) => logError('save draft on leave', e));
    },
    [task.id, progress],
  );

  const words = countWords(text);
  const range =
    words === 0
      ? { tone: 'muted' as const, text: `Aim for ${task.minWords}–${task.maxWords} words.` }
      : words < task.minWords
        ? { tone: 'muted' as const, text: `${task.minWords - words} more word${task.minWords - words === 1 ? '' : 's'} to reach the minimum.` }
        : words > task.maxWords
          ? { tone: 'danger' as const, text: `${words - task.maxWords} over the limit — the TCF penalises answers that are too long.` }
          : { tone: 'success' as const, text: 'Within the word range.' };

  const markDone = () => {
    const now = Date.now();
    progress
      .saveDraft(task.id, text, checked, now)
      .then(() => progress.completeSkillItem(task.id, 'writing', unitIdOf(task.id), null, now))
      .then(() => {
        setDone(true);
        invalidate();
      })
      .catch((e: unknown) => logError('complete writing', e));
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
          <AnswerInput value={text} onChange={setText} onSubmit={() => undefined} multiline placeholder="Écrivez votre texte ici…" accessibilityLabel="Your text" testID="writing-input" />
          <Row style={[styles.between, styles.mt]}>
            <AppText variant="bodyStrong" accessibilityLabel={`${words} words`}>{`${words} words`}</AppText>
            <AppText variant="meta" tone="muted">
              Saved on this device
            </AppText>
          </Row>
          <AppText variant="meta" tone={range.tone} accessibilityLiveRegion="polite">
            {range.text}
          </AppText>
        </Card>

        <Card>
          <AppText variant="cardTitle">Check your own work</AppText>
          <AppText variant="meta" tone="muted">
            This task is self-assessed: nothing is sent anywhere and there is no automatic grading. Tick each point once your text does it.
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

        {done ? (
          <Card color={colors.successTint} accessibilityLabel="Marked as done">
            <AppText variant="cardTitle" tone="success">
              Marked as done. Bon travail !
            </AppText>
            <Button label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.mt} />
          </Card>
        ) : (
          <Button label="Mark as done" icon="check" onPress={markDone} disabled={words === 0} testID="writing-done" />
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt: { marginTop: spacing.sm },
  between: { justifyContent: 'space-between' },
  check: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44, marginTop: spacing.sm },
});

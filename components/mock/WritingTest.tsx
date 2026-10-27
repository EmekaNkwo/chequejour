/**
 * The writing test: three tasks under one countdown, as on TCF Canada. The learner can
 * move between tasks freely; texts are saved on the phone as they type.
 */
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import type { WritingTask } from '../../domain/content-types';
import { writingTaskFormat } from '../../domain/tcf/exam-format';
import { handInWarning } from '../../domain/writing/word-count';
import { useApp } from '../../features/app/AppContext';
import { loadNounGenders, submitWriting } from '../../features/writing/writing-service';
import { logError } from '../../features/app/log';
import { useStudyTimer } from '../../features/progress/useStudyTimer';
import { useCountdown } from '../../features/skills/useCountdown';
import { AnswerInput } from '../exercises/inputs';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { Row, SegmentedTabs } from '../ui/Bits';
import { Button, IconButton } from '../ui/Button';
import { Card } from '../ui/Card';
import { Screen } from '../ui/Screen';
import { useToast } from '../ui/Toast';
import { TaskDocuments } from '../writing/TaskDocuments';
import { WordCounter } from '../writing/WordCounter';
import { TestClock } from './TestClock';

const AUTOSAVE_MS = 800;

export interface WritingTestProps {
  title: string;
  tasks: readonly WritingTask[];
  minutes: number;
  onFinish: (texts: string[]) => void;
  onQuit: () => void;
}

export function WritingTest({ title, tasks, minutes, onFinish, onQuit }: WritingTestProps) {
  useStudyTimer();
  const { content, progress } = useApp();
  const toast = useToast();
  const [texts, setTexts] = useState<string[]>(() => tasks.map(() => ''));
  const [current, setCurrent] = useState('0');
  const latest = useRef(texts);
  const finished = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      tasks.forEach((task, i) => {
        if (texts[i]) progress.saveDraft(task.id, texts[i], [], Date.now()).catch((e: unknown) => logError('save mock writing', e));
      });
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [texts, tasks, progress]);

  const timer = useCountdown(() => finish());
  function finish() {
    if (finished.current) return;
    finished.current = true;
    timer.stop();
    // The debounced autosave is cancelled on unmount, so save the final texts now.
    tasks.forEach((task, i) => {
      const text = latest.current[i];
      if (text) progress.saveDraft(task.id, text, [], Date.now()).catch((e: unknown) => logError('save mock writing on finish', e));
    });
    loadNounGenders(content)
      .then((genders) => Promise.all(tasks.map((task, i) => submitWriting(progress, genders, task, latest.current[i] ?? '', Date.now()))))
      .catch((e: unknown) => logError('save mock submissions', e));
    onFinish(latest.current);
  }
  const { start } = timer;
  // One countdown covers all three tasks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => start(minutes * 60), []);

  const submit = async () => {
    const warning = handInWarning(latest.current, tasks.map((t) => writingTaskFormat(t.taskType)));
    const ok = await toast.confirm({
      title: 'Hand in the writing test?',
      message: warning ? `${warning} You can’t change your texts afterwards.` : 'You can’t change your texts afterwards.',
      confirmLabel: 'Hand in',
      cancelLabel: 'Keep writing',
    });
    if (ok) finish();
  };

  const index = Number(current);
  const task = tasks[index];
  const format = task ? writingTaskFormat(task.taskType) : null;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen testID="mock-test-writing">
        <Row>
          <IconButton icon="x" label="Leave the test" onPress={onQuit} testID="mock-quit" />
          <View style={styles.title}>
            <AppText variant="meta" tone="muted" numberOfLines={1}>
              {title}
            </AppText>
          </View>
          <TestClock seconds={timer.remaining} label="for all three tasks" />
        </Row>
        {tasks.length > 1 ? (
          <SegmentedTabs options={tasks.map((t, i) => ({ value: String(i), label: `Task ${writingTaskFormat(t.taskType).task}` }))} value={current} onChange={setCurrent} />
        ) : null}
        {task && format ? (
          <View key={task.id} style={styles.gap}>
            <Card>
              <AppText variant="label" tone="muted">
                {`TASK ${format.task} · ${format.minWords}–${format.maxWords} WORDS`}
              </AppText>
              <AppText variant="french" french style={styles.mt}>
                {task.promptFr}
              </AppText>
              {task.documents ? <TaskDocuments documents={task.documents} /> : null}
            </Card>
            <Card>
              <AnswerInput
                value={texts[index] ?? ''}
                onChange={(value) => {
                  const next = latest.current.map((t, i) => (i === index ? value : t));
                  latest.current = next;
                  setTexts(next);
                }}
                onSubmit={() => undefined}
                multiline
                placeholder="Écrivez votre texte ici…"
                accessibilityLabel={`Your text for task ${format.task}`}
                testID={`mock-writing-input-${format.task}`}
              />
              <WordCounter text={texts[index] ?? ''} minWords={format.minWords} maxWords={format.maxWords} />
            </Card>
          </View>
        ) : null}
        <Button label="Hand in the writing test" icon="check" onPress={() => void submit()} testID="mock-writing-submit" />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { flex: 1 },
  gap: { gap: spacing.lg },
  mt: { marginTop: spacing.sm },
});

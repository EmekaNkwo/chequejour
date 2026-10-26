/**
 * The speaking test: three tasks in a row, each with its own preparation and speaking
 * countdown, recorded on the phone for self-assessment afterwards.
 */
import { Feather } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SpeakingTask } from '../../domain/content-types';
import { useApp } from '../../features/app/AppContext';
import { logError } from '../../features/app/log';
import { useStudyTimer } from '../../features/progress/useStudyTimer';
import { formatClock } from '../../features/skills/skill-items';
import { useCountdown } from '../../features/skills/useCountdown';
import { useRecorder } from '../../features/speaking/useRecorder';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { Row } from '../ui/Bits';
import { Button, IconButton } from '../ui/Button';
import { Card } from '../ui/Card';
import { Screen } from '../ui/Screen';
import { useToast } from '../ui/Toast';

type Phase = 'ready' | 'prep' | 'speaking';

export interface SpeakingTestProps {
  title: string;
  tasks: readonly SpeakingTask[];
  /** Recording file names, null where nothing was recorded. */
  onFinish: (recordings: (string | null)[]) => void;
  onQuit: () => void;
}

export function SpeakingTest({ title, tasks, onFinish, onQuit }: SpeakingTestProps) {
  useStudyTimer();
  const { colors } = useTheme();
  const { progress } = useApp();
  const toast = useToast();
  const recorder = useRecorder();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [recording, setRecording] = useState(false);
  const files = useRef<(string | null)[]>(tasks.map(() => null));
  // A tap and the countdown can both end a phase in the same tick; only the first counts.
  const speakingStarted = useRef(false);
  const ending = useRef(false);
  const task = tasks[index];

  const prep = useCountdown(() => void speak());
  const talk = useCountdown(() => void endTask());

  async function speak() {
    prep.stop();
    if (!task || speakingStarted.current) return;
    speakingStarted.current = true;
    setPhase('speaking');
    talk.start(task.speakSeconds);
    const started = await recorder.start();
    setRecording(started);
    if (!started) toast.show({ tone: 'warning', title: 'Not recording', message: 'The microphone is unavailable. Speak anyway and keep to the time.' });
  }

  async function endTask() {
    talk.stop();
    if (!task || ending.current) return;
    ending.current = true;
    try {
      const saved = await recorder.stopAndSave(progress, task.id);
      files.current = files.current.map((f, i) => (i === index ? (saved?.fileName ?? f) : f));
    } catch (e: unknown) {
      logError('save mock speaking', e);
      toast.show({ tone: 'error', title: 'Recording not saved', message: 'Carry on with the next task.' });
    }
    setRecording(false);
    if (index + 1 >= tasks.length) {
      onFinish(files.current);
      return;
    }
    speakingStarted.current = false;
    ending.current = false;
    setIndex(index + 1);
    setPhase('ready');
  }

  const begin = async () => {
    if (!task) return;
    if (recorder.micAllowed === null) await recorder.askPermission();
    if (task.prepSeconds > 0) {
      setPhase('prep');
      prep.start(task.prepSeconds);
    } else await speak();
  };

  if (!task) return null;
  const palette = colors.skills.speaking;
  const seconds = phase === 'prep' ? prep.remaining : phase === 'speaking' ? talk.remaining : task.prepSeconds || task.speakSeconds;
  const label = phase === 'prep' ? 'Preparation' : phase === 'speaking' ? (recording ? 'Recording' : 'Speak now') : task.prepSeconds > 0 ? 'Preparation time' : 'Speaking time';

  return (
    <Screen testID="mock-test-speaking">
      <Row>
        <IconButton icon="x" label="Leave the test" onPress={onQuit} testID="mock-quit" />
        <View style={styles.flex}>
          <AppText variant="meta" tone="muted" numberOfLines={1}>
            {`${title} · task ${index + 1} of ${tasks.length}`}
          </AppText>
        </View>
      </Row>
      <Card>
        <AppText variant="label" tone="muted">{`TASK ${index + 1}`}</AppText>
        <AppText variant="body" tone="secondary" style={styles.mt}>
          {task.instructions}
        </AppText>
        <AppText variant="french" french style={styles.mt}>
          {task.promptFr}
        </AppText>
      </Card>
      <Card accessibilityLabel={`${label}: ${formatClock(seconds)}`}>
        <View style={styles.timerWrap}>
          <View style={[styles.timer, { backgroundColor: phase === 'speaking' ? palette.base : palette.tint }]}>
            {phase === 'speaking' && recording ? <Feather name="mic" size={22} color={palette.onBase} /> : null}
            <AppText variant="screenTitle" color={phase === 'speaking' ? palette.onBase : palette.onTint}>
              {formatClock(seconds)}
            </AppText>
          </View>
          <AppText variant="label" tone="muted">
            {label.toUpperCase()}
          </AppText>
        </View>
        {phase === 'ready' ? (
          <Button label={task.prepSeconds > 0 ? 'Start preparing' : 'Start speaking'} icon="play" onPress={() => void begin()} testID="mock-speaking-start" />
        ) : phase === 'prep' ? (
          <Button label="I'm ready — start speaking" icon="mic" onPress={() => void speak()} testID="mock-speaking-skip-prep" />
        ) : (
          <Button label={index + 1 >= tasks.length ? 'Finish the test' : 'Finish this task'} icon="square" onPress={() => void endTask()} loading={recorder.busy} testID="mock-speaking-stop" />
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt: { marginTop: spacing.sm },
  timerWrap: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  timer: { minWidth: 180, minHeight: 96, borderRadius: radii.xl, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl },
});

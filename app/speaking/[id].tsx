import { Feather } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SpeakingAiFeedback } from '../../components/ai/SpeakingAiFeedback';
import { TranscriptCard } from '../../components/ai/TranscriptCard';
import { PlayButton } from '../../components/audio/AudioControls';
import { useTheme } from '../../components/theme/ThemeProvider';
import { radii, spacing } from '../../components/theme/tokens';
import { AppText } from '../../components/ui/AppText';
import { LevelPill, LinkText, Pill, Row } from '../../components/ui/Bits';
import { Button, IconButton } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState, Loading, Screen } from '../../components/ui/Screen';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useToast } from '../../components/ui/Toast';
import type { Recording } from '../../data/progress-repo';
import { audioKey } from '../../domain/audio-keys';
import type { SpeakingTask } from '../../domain/content-types';
import { useSpeechAi, type Transcript } from '../../features/ai/useSpeechAi';
import { useApp } from '../../features/app/AppContext';
import { logError } from '../../features/app/log';
import { useLoad } from '../../features/app/useLoad';
import { stop as stopSharedAudio } from '../../features/audio/audio-controller';
import { useStudyTimer } from '../../features/progress/useStudyTimer';
import { deleteRecording, recordingUri } from '../../features/skills/recordings';
import { formatClock, findSpeaking, unitIdOf } from '../../features/skills/skill-items';
import { useCountdown } from '../../features/skills/useCountdown';
import { useRecorder } from '../../features/speaking/useRecorder';

const TASK_LABEL: Readonly<Record<SpeakingTask['taskType'], string>> = {
  entretien: 'Guided interview',
  interaction: 'Role-play',
  opinion: 'Opinion',
};

type Phase = 'idle' | 'prep' | 'speaking';

export default function SpeakingScreen() {
  const { id, mock } = useLocalSearchParams<{ id: string; mock?: string }>();
  const { content } = useApp();
  const { data, error, reload } = useLoad(`speaking ${id}`, async () => ({ task: await findSpeaking(content, id, mock) }), [id, mock]);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (!data.task) return <ErrorState message="This speaking task couldn't be found." />;
  return <Speaking task={data.task} />;
}

function Speaking({ task }: { task: SpeakingTask }) {
  useStudyTimer();
  const { colors } = useTheme();
  const { progress, invalidate } = useApp();
  const toast = useToast();
  const speechAi = useSpeechAi();
  const recorder = useRecorder({ wav: speechAi.ready });
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);
  const [phase, setPhase] = useState<Phase>('idle');
  const micAllowed = recorder.micAllowed;
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [showModel, setShowModel] = useState(false);
  const [done, setDone] = useState(false);

  const refresh = useCallback(() => {
    progress
      .recordings(task.id)
      .then(setRecordings)
      .catch((e: unknown) => logError('load recordings', e));
  }, [progress, task.id]);

  useEffect(refresh, [refresh]);

  const prepTimer = useCountdown(() => void startSpeaking());
  const starting = useRef<Promise<boolean>>(Promise.resolve(false));
  const speakingTimer = useCountdown(() => void finishSpeaking());
  /** The recording being played right now, if any. */
  const activeId = playerStatus.playing ? playingId : null;

  async function finishSpeaking() {
    speakingTimer.stop();
    setPhase('idle');
    // Stop can be tapped while the recorder is still starting; wait so it isn't left running.
    await starting.current;
    try {
      const saved = await recorder.stopAndSave(progress, task.id);
      if (!saved) return;
      refresh();
      speechAi.request(saved);
      toast.show({ tone: 'success', title: 'Recording saved', message: 'Listen back below and compare it with the model answer.' });
    } catch (error: unknown) {
      logError('stop recording', error);
      toast.show({ tone: 'error', title: 'Recording not saved', message: 'Something went wrong while saving your recording. Please try again.' });
    }
  }

  async function startSpeaking() {
    prepTimer.stop();
    setPhase('speaking');
    speakingTimer.start(task.speakSeconds);
    if (!micAllowed) return;
    player.pause();
    setPlayingId(null);
    starting.current = recorder.start();
    if (!(await starting.current)) {
      toast.show({ tone: 'warning', title: 'Microphone unavailable', message: 'Recording could not start. You can still practise with the timer.' });
    }
  }

  const begin = async () => {
    await recorder.askPermission();
    setPhase('prep');
    prepTimer.start(task.prepSeconds);
  };

  const playRecording = (r: Recording) => {
    if (activeId === r.id) {
      player.pause();
      setPlayingId(null);
      return;
    }
    stopSharedAudio()
      .then(() => {
        player.replace({ uri: recordingUri(r.uri) });
        return player.seekTo(0);
      })
      .then(() => {
        player.play();
        setPlayingId(r.id);
      })
      .catch((e: unknown) => logError('play recording', e));
  };

  const confirmDelete = async (r: Recording) => {
    const ok = await toast.confirm({
      title: 'Delete recording?',
      message: 'This removes the recording from your phone. It cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    if (activeId === r.id) {
      player.pause();
      setPlayingId(null);
    }
    try {
      await deleteRecording(progress, r.id, r.uri);
      refresh();
      toast.show({ tone: 'success', title: 'Recording deleted' });
    } catch (e: unknown) {
      logError('delete recording', e);
      toast.show({ tone: 'error', title: 'Recording not deleted', message: 'Please try again.' });
    }
  };

  const markDone = () => {
    progress
      .completeSkillItem(task.id, 'speaking', unitIdOf(task.id), null, Date.now())
      .then(() => {
        setDone(true);
        invalidate();
      })
      .catch((e: unknown) => logError('complete speaking', e));
  };

  const palette = colors.skills.speaking;
  const timerValue = phase === 'prep' ? prepTimer.remaining : phase === 'speaking' ? speakingTimer.remaining : task.speakSeconds;
  const timerLabel = phase === 'prep' ? 'Preparation' : phase === 'speaking' ? (micAllowed ? 'Recording' : 'Speak now (not recording)') : 'Speaking time';

  return (
    <Screen testID="speaking-screen">
      <ScreenHeader title={task.title} back />
      <Row gap={spacing.sm}>
        <Pill label={TASK_LABEL[task.taskType].toUpperCase()} color={palette.tint} textColor={palette.onTint} icon="mic" />
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
          {`${formatClock(task.prepSeconds)} to prepare · ${formatClock(task.speakSeconds)} to speak`}
        </AppText>
        {task.taskType === 'interaction' ? (
          <View style={styles.mt}>
            <LinkText label="Warm up: asking questions drill" icon="help-circle" onPress={() => router.push('/questions')} />
          </View>
        ) : null}
      </Card>

      <Card accessibilityLabel={`${timerLabel}: ${formatClock(timerValue)}`}>
        <View style={styles.timerWrap} accessibilityLiveRegion={phase === 'idle' ? 'none' : 'polite'}>
          <View style={[styles.timer, { backgroundColor: phase === 'speaking' ? palette.base : palette.tint }]}>
            {phase === 'speaking' && micAllowed ? <Feather name="mic" size={22} color={palette.onBase} /> : null}
            <AppText variant="screenTitle" color={phase === 'speaking' ? palette.onBase : palette.onTint}>
              {formatClock(timerValue)}
            </AppText>
          </View>
          <AppText variant="label" tone="muted">
            {timerLabel.toUpperCase()}
          </AppText>
        </View>
        {phase === 'idle' ? (
          <Button label="Start" icon="play" onPress={() => void begin()} loading={recorder.busy} testID="speaking-start" />
        ) : phase === 'prep' ? (
          <Button label="I'm ready — start speaking" icon="mic" onPress={() => void startSpeaking()} testID="speaking-skip-prep" />
        ) : (
          <Button label="Stop" icon="square" onPress={() => void finishSpeaking()} testID="speaking-stop" />
        )}
        {micAllowed === false ? (
          <AppText variant="meta" tone="muted" style={styles.mt}>
            Microphone access is off, so nothing is recorded. You can allow it in your phone&apos;s settings to record and listen back.
          </AppText>
        ) : null}
      </Card>

      <Card>
        <AppText variant="cardTitle">Your recordings</AppText>
        <AppText variant="meta" tone="muted">
          Recordings stay on this phone. They are never uploaded or shared.
        </AppText>
        {recordings.length === 0 ? (
          <AppText variant="body" tone="muted" style={styles.mt}>
            No recordings yet.
          </AppText>
        ) : (
          recordings.map((r, i) => (
            <Row key={r.id} style={styles.recording}>
              <IconButton
                icon={activeId === r.id ? 'pause' : 'play'}
                label={activeId === r.id ? 'Pause recording' : `Play recording ${recordings.length - i}`}
                background={palette.tint}
                color={palette.onTint}
                onPress={() => playRecording(r)}
              />
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{`Take ${recordings.length - i}`}</AppText>
                <AppText variant="meta" tone="muted">
                  {`${formatClock(r.durationMs / 1000)} · ${new Date(r.createdAt).toLocaleDateString()}`}
                </AppText>
              </View>
              <IconButton icon="trash-2" label={`Delete recording ${recordings.length - i}`} onPress={() => void confirmDelete(r)} />
            </Row>
          ))
        )}
      </Card>

      {recordings[0] && speechAi.transcripts[recordings[0].uri] ? (
        <TranscriptCard transcript={speechAi.transcripts[recordings[0].uri]} durationMs={recordings[0].durationMs}>
          <TakeCoaching key={recordings[0].uri} task={task} transcript={speechAi.transcripts[recordings[0].uri]} durationMs={recordings[0].durationMs} />
        </TranscriptCard>
      ) : null}

      <Card>
        <Row style={styles.between}>
          <AppText variant="cardTitle">Model answer</AppText>
          <LinkText label={showModel ? 'Hide' : 'Show'} onPress={() => setShowModel((v) => !v)} />
        </Row>
        {showModel ? (
          <Row style={[styles.model, { backgroundColor: colors.surfaceRaised }]}>
            <AppText variant="french" french style={styles.flex}>
              {task.modelAnswer}
            </AppText>
            <PlayButton audioKey={audioKey.model(task.id)} text={task.modelAnswer} size={44} label="Play model answer" />
          </Row>
        ) : (
          <AppText variant="meta" tone="muted">
            Record yourself first, then listen to the model and compare.
          </AppText>
        )}
      </Card>

      {task.tips.length > 0 ? (
        <Card>
          <AppText variant="cardTitle">Tips</AppText>
          {task.tips.map((tip) => (
            <Row key={tip} gap={spacing.sm} style={styles.tip}>
              <Feather name="check" size={16} color={colors.success} />
              <AppText variant="body" tone="secondary" style={styles.flex}>
                {tip}
              </AppText>
            </Row>
          ))}
        </Card>
      ) : null}

      {done ? (
        <Card color={colors.successTint} accessibilityLabel="Marked as done">
          <AppText variant="cardTitle" tone="success">
            Marked as done. Bravo !
          </AppText>
          <Button label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.mt} />
        </Card>
      ) : (
        <Button label="Mark as done" icon="check" onPress={markDone} disabled={phase !== 'idle'} testID="speaking-done" />
      )}
    </Screen>
  );
}

/** AI coaching for a finished transcript; keyed by take so a new take starts fresh. */
function TakeCoaching({ task, transcript, durationMs }: { task: SpeakingTask; transcript: Transcript; durationMs: number }) {
  if (transcript.status !== 'done') return null;
  return (
    <SpeakingAiFeedback
      input={{ taskType: task.taskType, level: task.level, promptFr: task.promptFr, transcript: transcript.text, durationMs }}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  mt: { marginTop: spacing.sm },
  between: { justifyContent: 'space-between' },
  timerWrap: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  timer: { minWidth: 180, minHeight: 96, borderRadius: radii.xl, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl },
  recording: { marginTop: spacing.md },
  model: { borderRadius: radii.md, padding: spacing.lg, marginTop: spacing.sm, alignItems: 'flex-start' },
  tip: { marginTop: spacing.sm, alignItems: 'flex-start' },
});

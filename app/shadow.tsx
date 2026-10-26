import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PlayButton } from '../components/audio/AudioControls';
import { useTheme } from '../components/theme/ThemeProvider';
import { spacing } from '../components/theme/tokens';
import { AppText } from '../components/ui/AppText';
import { Row } from '../components/ui/Bits';
import { Button, IconButton } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorState, Loading, Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import type { Recording } from '../data/progress-repo';
import { shadowLines, shadowTaskId, type ShadowLine, type ShadowSource } from '../domain/shadowing';
import { useApp } from '../features/app/AppContext';
import { logError } from '../features/app/log';
import { useLoad } from '../features/app/useLoad';
import { useSpeaker } from '../features/audio/useAudio';
import { useStudyTimer } from '../features/progress/useStudyTimer';
import { deleteRecording } from '../features/skills/recordings';
import { useRecorder, useRecordingPlayer } from '../features/speaking/useRecorder';

type Kind = ShadowSource['kind'];
const KINDS: readonly Kind[] = ['word', 'sentence', 'listening'];

/** Shadowing a word, the sentence of the day or a listening text: listen, repeat, compare. */
export default function ShadowScreen() {
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  const { content } = useApp();
  const { data, error, reload } = useLoad(
    `shadow ${kind} ${id}`,
    async (): Promise<{ title: string; lines: ShadowLine[] } | null> => {
      if (kind === 'word') {
        const word = await content.item('word', id);
        return word && { title: word.fr, lines: shadowLines({ kind: 'word', word }) };
      }
      if (kind === 'sentence') {
        const sentence = await content.item('sentence', id);
        return sentence && { title: 'Sentence of the day', lines: shadowLines({ kind: 'sentence', sentence }) };
      }
      if (kind === 'listening') {
        const item = await content.item('listening', id);
        return item && { title: item.title, lines: shadowLines({ kind: 'listening', item }) };
      }
      return null;
    },
    [kind, id],
  );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data && KINDS.includes(kind as Kind)) return <Loading />;
  if (!data) return <ErrorState message="There's nothing to shadow here." />;
  return <Shadowing title={data.title} lines={data.lines} />;
}

function Shadowing({ title, lines }: { title: string; lines: readonly ShadowLine[] }) {
  useStudyTimer();
  const { colors } = useTheme();
  const { progress } = useApp();
  const toast = useToast();
  const speaker = useSpeaker();
  const recorder = useRecorder();
  const player = useRecordingPlayer();
  const [index, setIndex] = useState(0);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [comparing, setComparing] = useState(false);
  const line = lines[index];
  const taskId = shadowTaskId(line.key);

  const loadRecordings = useCallback(() => {
    progress
      .recordings(taskId)
      .then(setRecordings)
      .catch((e: unknown) => logError('load shadow recordings', e));
  }, [progress, taskId]);
  useEffect(loadRecordings, [loadRecordings]);

  const toggleRecording = async () => {
    if (recorder.isRecording) {
      const saved = await recorder.stopAndSave(progress, taskId).catch((e: unknown) => {
        logError('save shadow recording', e);
        return null;
      });
      if (!saved) toast.show({ tone: 'error', title: 'Recording not saved', message: 'Please try again.' });
      loadRecordings();
      return;
    }
    speaker.stop();
    player.stop();
    const started = await recorder.start();
    if (!started && recorder.micAllowed !== false) {
      toast.show({ tone: 'warning', title: 'Microphone unavailable', message: 'Recording could not start. You can still listen and repeat aloud.' });
    }
  };

  /** The original, then the learner's latest try, back to back. */
  const compare = (r: Recording) => {
    setComparing(true);
    player.stop();
    speaker.speak(line.key, line.fr, {
      onFinish: () => {
        player.playToEnd(`rec-${r.id}`, r.uri).finally(() => setComparing(false));
      },
    });
  };

  const remove = async (r: Recording) => {
    try {
      player.stop();
      await deleteRecording(progress, r.id, r.uri);
      loadRecordings();
      toast.show({ tone: 'success', title: 'Recording deleted' });
    } catch (e: unknown) {
      logError('delete shadow recording', e);
      toast.show({ tone: 'error', title: 'Recording not deleted', message: 'Please try again.' });
    }
  };

  const latest = recordings[0];
  const go = (to: number) => {
    speaker.stop();
    player.stop();
    setIndex(to);
  };

  return (
    <Screen testID="shadow-screen">
      <ScreenHeader title="Shadowing" subtitle={title} back />
      <AppText variant="body" tone="secondary">
        Listen, then say it straight away in the same rhythm. Record yourself and compare: the original plays first, then you.
      </AppText>

      <Card>
        <AppText variant="meta" tone="muted">{`Line ${index + 1} of ${lines.length}${line.speaker ? ` · ${line.speaker}` : ''}`}</AppText>
        <AppText variant="frenchLarge" french style={styles.mt}>
          {line.fr}
        </AppText>
        {line.en ? (
          <AppText variant="body" tone="secondary">
            {line.en}
          </AppText>
        ) : null}
        <Row style={[styles.mt, styles.actions]}>
          <View style={styles.action}>
            <PlayButton audioKey={line.key} text={line.fr} size={56} label="Play the original" />
            <AppText variant="label" tone="muted">
              1. Listen
            </AppText>
          </View>
          <View style={styles.action}>
            <IconButton
              icon={recorder.isRecording ? 'square' : 'mic'}
              label={recorder.isRecording ? 'Stop recording' : 'Record yourself'}
              onPress={() => void toggleRecording()}
              size={56}
              color={recorder.isRecording ? colors.danger : undefined}
              testID="shadow-record"
            />
            <AppText variant="label" tone={recorder.isRecording ? 'danger' : 'muted'}>
              {recorder.isRecording ? 'Recording…' : '2. Repeat'}
            </AppText>
          </View>
          <View style={styles.action}>
            <IconButton icon="repeat" label="Play the original, then your recording" onPress={() => latest && compare(latest)} disabled={!latest || comparing} size={56} testID="shadow-compare" />
            <AppText variant="label" tone="muted">
              3. Compare
            </AppText>
          </View>
        </Row>
        {recorder.micAllowed === false ? (
          <AppText variant="meta" tone="muted" style={styles.mt}>
            Microphone access is off, so nothing is recorded. You can still listen and repeat aloud, or allow it in your phone&apos;s settings.
          </AppText>
        ) : null}
      </Card>

      {recordings.length > 0 ? (
        <Card>
          <AppText variant="cardTitle">Your tries for this line</AppText>
          <AppText variant="meta" tone="muted">
            Kept on this phone only. Delete any you don&apos;t need.
          </AppText>
          {recordings.map((r, i) => (
            <Row key={r.id} style={[styles.between, styles.mt]}>
              <IconButton
                icon={player.playingKey === `rec-${r.id}` ? 'pause' : 'play'}
                label={`Play try ${recordings.length - i}`}
                onPress={() => player.toggle(`rec-${r.id}`, r.uri)}
                size={40}
              />
              <AppText variant="body" style={styles.flex}>{`Try ${recordings.length - i} · ${Math.max(1, Math.round(r.durationMs / 1000))} s`}</AppText>
              <IconButton icon="trash-2" label={`Delete try ${recordings.length - i}`} onPress={() => void remove(r)} size={40} />
            </Row>
          ))}
        </Card>
      ) : null}

      {lines.length > 1 ? (
        <Row>
          <Button label="Previous" variant="secondary" icon="chevron-left" onPress={() => go(index - 1)} disabled={index === 0} style={styles.flex} />
          <Button label="Next line" icon="chevron-right" onPress={() => go(index + 1)} disabled={index === lines.length - 1} style={styles.flex} testID="shadow-next" />
        </Row>
      ) : null}
      <Row gap={spacing.sm}>
        <Feather name="lock" size={14} color={colors.textMuted} />
        <AppText variant="meta" tone="muted" style={styles.flex}>
          Nothing is uploaded. Delete all recordings at any time in Settings.
        </AppText>
      </Row>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt: { marginTop: spacing.md },
  between: { justifyContent: 'space-between' },
  actions: { justifyContent: 'space-around' },
  action: { alignItems: 'center', gap: spacing.xs },
});

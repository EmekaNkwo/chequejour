/**
 * A listening document as on the exam: it plays once, at normal speed, with no pause
 * or replay.
 */
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { play } from '../../features/audio/audio-controller';
import { usePlayback } from '../../features/audio/useAudio';
import { logError } from '../../features/app/log';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/Progress';

const EXAM_RATE = 1;

export function PlayOnce({ audioKey, text }: { audioKey: string; text: string }) {
  const { colors } = useTheme();
  const playback = usePlayback();
  const [stage, setStage] = useState<'ready' | 'playing' | 'played'>('ready');
  const mine = playback.key === audioKey;

  const start = () => {
    setStage('playing');
    play(audioKey, text, { rate: EXAM_RATE, onFinish: () => setStage('played') }).catch((e: unknown) => {
      logError('play mock listening', e);
      setStage('played');
    });
  };

  if (stage === 'ready') {
    return <Button label="Play the recording (once)" icon="play" onPress={start} accessibilityHint="As in the exam, it plays only once" testID="play-once" />;
  }
  if (stage === 'playing') {
    return (
      <View style={styles.gap} accessible accessibilityLabel="The recording is playing">
        <View style={styles.row}>
          <Feather name="volume-2" size={20} color={colors.skills.listening.base} />
          <AppText variant="bodyStrong">Listening…</AppText>
        </View>
        <ProgressBar value={mine ? playback.progress : 0} color={colors.skills.listening.base} track={colors.skills.listening.tint} />
      </View>
    );
  }
  return (
    <View style={styles.row} accessible accessibilityLabel="The recording has been played. It can't be replayed.">
      <Feather name="check" size={20} color={colors.textMuted} />
      <AppText variant="meta" tone="muted">
        Played. As in the exam, there is no replay.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
});

import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { formatRate, PLAYBACK_RATES, type PlaybackRate } from '../../domain/playback';
import { useSpeaker } from '../../features/audio/useAudio';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { PressableScale } from '../ui/PressableScale';

export interface PlayButtonProps {
  audioKey: string;
  text: string;
  size?: number;
  label?: string;
  color?: string;
  iconColor?: string;
}

/** Round play button; tapping again stops playback. */
export function PlayButton({ audioKey, text, size = 52, label = 'Play audio', color, iconColor }: PlayButtonProps) {
  const { colors } = useTheme();
  const speaker = useSpeaker();
  const playing = speaker.isPlaying(audioKey);
  return (
    <PressableScale
      onPress={() => (playing ? speaker.stop() : speaker.speak(audioKey, text))}
      accessibilityLabel={playing ? 'Stop audio' : label}
      style={[styles.round, { width: size, height: size, borderRadius: size / 2, backgroundColor: color ?? colors.primary }]}
    >
      <Feather name={playing ? 'square' : 'volume-2'} size={Math.round(size * 0.42)} color={iconColor ?? colors.onPrimary} />
    </PressableScale>
  );
}

/** Large play / replay controls with a speed selector, used on lesson and exercise screens. */
export function AudioControls({ audioKey, text }: { audioKey: string; text: string }) {
  const { colors } = useTheme();
  const speaker = useSpeaker();
  const playing = speaker.isPlaying(audioKey);
  const buttons = [
    { icon: playing ? 'pause' : 'play', label: playing ? 'Pause' : 'Play', onPress: () => (playing ? speaker.stop() : speaker.speak(audioKey, text)), primary: true },
    { icon: 'rotate-ccw', label: 'Replay', onPress: () => speaker.speak(audioKey, text), primary: false },
  ] as const;
  return (
    <View style={styles.wrap}>
      <View style={styles.controls}>
        {buttons.map((b) => (
          <View key={b.label} style={styles.control}>
            <PressableScale
              onPress={b.onPress}
              accessibilityLabel={b.label}
              style={[styles.round, { width: b.primary ? 68 : 56, height: b.primary ? 68 : 56, borderRadius: 34, backgroundColor: b.primary ? colors.primary : colors.primaryTint }]}
            >
              <Feather name={b.icon} size={b.primary ? 28 : 22} color={b.primary ? colors.onPrimary : colors.primary} />
            </PressableScale>
            <AppText variant="label" tone="muted">
              {b.label}
            </AppText>
          </View>
        ))}
      </View>
      <SpeedSelector value={speaker.rate} onChange={speaker.changeRate} />
    </View>
  );
}

export interface SpeedSelectorProps {
  value: PlaybackRate;
  onChange: (rate: PlaybackRate) => void;
}

/** Row of speed chips; the chosen speed applies to all audio in the app. */
export function SpeedSelector({ value, onChange }: SpeedSelectorProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.speedRow} accessibilityRole="radiogroup" accessibilityLabel="Playback speed">
      <Feather name="fast-forward" size={14} color={colors.textMuted} />
      {PLAYBACK_RATES.map((rate) => {
        const active = rate === value;
        return (
          <PressableScale
            key={rate}
            onPress={() => onChange(rate)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Speed ${formatRate(rate)}`}
            style={[styles.speed, { backgroundColor: active ? colors.primary : colors.primaryTint }]}
            testID={`speed-${rate}`}
          >
            <AppText variant="meta" color={active ? colors.onPrimary : colors.primary}>
              {formatRate(rate)}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  round: { alignItems: 'center', justifyContent: 'center' },
  wrap: { gap: spacing.md, alignItems: 'center' },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: spacing.xxl },
  speedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  speed: { minWidth: 48, minHeight: 36, paddingHorizontal: spacing.sm, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  control: { alignItems: 'center', gap: spacing.xs },
});

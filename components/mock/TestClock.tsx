import { StyleSheet, View } from 'react-native';
import { formatClock } from '../../features/skills/skill-items';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';

/** Countdown pill; turns red in the last minute. */
export function TestClock({ seconds, label }: { seconds: number; label: string }) {
  const { colors } = useTheme();
  const low = seconds <= 60;
  return (
    <View
      style={[styles.clock, { backgroundColor: low ? colors.dangerTint : colors.skills.tests.tint }]}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={`${formatClock(seconds)} left ${label}`}
      testID="test-clock"
    >
      <AppText variant="bodyStrong" color={low ? colors.danger : colors.skills.tests.onTint}>
        {formatClock(seconds)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  clock: { minWidth: 72, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
});

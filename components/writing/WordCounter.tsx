import { StyleSheet, View } from 'react-native';
import { countWords, wordRangeStatus } from '../../domain/writing/word-count';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';

/** Live word count against the task's range: green inside it, amber below or above. */
export function WordCounter({ text, minWords, maxWords }: { text: string; minWords: number; maxWords: number }) {
  const { colors } = useTheme();
  const words = countWords(text);
  const status = wordRangeStatus(words, minWords, maxWords);
  const amber = { fg: colors.skills.vocabulary.onTint, bg: colors.skills.vocabulary.tint };
  const look =
    status === 'within'
      ? { fg: colors.success, bg: colors.successTint, hint: 'Within the range' }
      : status === 'under'
        ? { ...amber, hint: `${minWords - words} more to reach ${minWords}` }
        : status === 'over'
          ? { ...amber, hint: `${words - maxWords} over ${maxWords}: too long loses marks` }
          : { fg: colors.textMuted, bg: colors.surfaceRaised, hint: `Aim for ${minWords}–${maxWords} words` };
  return (
    <View style={styles.row} accessibilityLiveRegion="polite" accessible accessibilityLabel={`${words} words. ${look.hint}`} testID={`word-counter-${status}`}>
      <View style={[styles.pill, { backgroundColor: look.bg }]}>
        <AppText variant="bodyStrong" color={look.fg}>{`${words} / ${minWords}–${maxWords}`}</AppText>
      </View>
      <AppText variant="meta" color={status === 'empty' ? colors.textMuted : look.fg} style={styles.flex}>
        {look.hint}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  pill: { borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, minHeight: 32, justifyContent: 'center' },
  flex: { flex: 1 },
});

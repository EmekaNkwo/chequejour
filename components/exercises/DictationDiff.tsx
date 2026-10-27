/**
 * The dictation sentence after checking, word by word: right words plain, accent slips
 * amber, wrong or missing words red, extra typed words struck through.
 */
import { StyleSheet, View } from 'react-native';
import { diffWords, type DiffToken } from '../../domain/exercises/dictation-diff';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';

const LABEL: Readonly<Record<DiffToken['status'], string>> = {
  ok: 'right',
  accent: 'accents',
  wrong: 'wrong',
  missing: 'missing',
  extra: 'extra',
};

export function DictationDiff({ expected, typed }: { expected: string; typed: string }) {
  const { colors } = useTheme();
  const tokens = diffWords(expected, typed);
  const amber = { fg: colors.skills.vocabulary.onTint, bg: colors.skills.vocabulary.tint };
  const look = (s: DiffToken['status']) =>
    s === 'ok' ? { fg: colors.text, bg: 'transparent' } : s === 'accent' ? amber : { fg: colors.danger, bg: colors.dangerTint };
  const slips = tokens.filter((t) => t.status !== 'ok');
  return (
    <View testID="dictation-diff" accessible accessibilityLabel={`Word by word: ${slips.length === 0 ? 'every word right' : slips.map((t) => `${t.word}, ${LABEL[t.status]}`).join('; ')}`}>
      <AppText variant="meta" tone="muted">
        Word by word
      </AppText>
      <View style={styles.words}>
        {tokens.map((t, i) => {
          const c = look(t.status);
          return (
            <View key={`${i}-${t.word}`} style={[styles.word, { backgroundColor: c.bg }]}>
              <AppText variant="french" french color={c.fg} style={t.status === 'extra' ? styles.strike : t.status === 'missing' ? styles.underline : undefined}>
                {t.word}
              </AppText>
              {t.typed ? <AppText variant="meta" tone="muted">{`you: ${t.typed}`}</AppText> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  words: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  word: { borderRadius: radii.sm, paddingHorizontal: spacing.xs, alignItems: 'center' },
  strike: { textDecorationLine: 'line-through' },
  underline: { textDecorationLine: 'underline' },
});

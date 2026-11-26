import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import type { TenseStat } from '../../domain/conjugation-trainer';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { LinkText, Row } from '../ui/Bits';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/Progress';

/** Conjugation trainer accuracy per tense, so the weakest tense is easy to spot. */
export function TenseAccuracy({ stats }: { stats: readonly TenseStat[] }) {
  const practised = stats.some((s) => s.attempts > 0);
  return (
    <Card testID="tense-accuracy">
      {practised ? (
        <View style={styles.list}>
          {stats.map((s) => {
            const pct = s.accuracy === null ? null : Math.round(s.accuracy * 100);
            const detail = pct === null ? 'not practised yet' : `${pct}% · ${s.forms} form${s.forms === 1 ? '' : 's'}`;
            return (
              <View key={s.tense} accessible accessibilityLabel={`${s.tense}: ${detail}`} style={styles.row}>
                <Row style={styles.between}>
                  <AppText variant="bodyStrong">{s.tense}</AppText>
                  <AppText variant="meta" tone="muted">
                    {detail}
                  </AppText>
                </Row>
                <ProgressBar value={s.accuracy ?? 0} />
              </View>
            );
          })}
        </View>
      ) : (
        <AppText variant="body" tone="muted">
          Practise with the conjugation trainer to see how you do in each tense.
        </AppText>
      )}
      <LinkText label="Open the conjugation trainer" icon="arrow-right" onPress={() => router.push('/verb-trainer')} />
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  row: { gap: spacing.xs },
  between: { justifyContent: 'space-between' },
});

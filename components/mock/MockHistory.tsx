import { StyleSheet, View } from 'react-native';
import { TCF_SKILLS, TCF_CANADA } from '../../domain/tcf/exam-format';
import type { MockRunRecord } from '../../domain/tcf/mock-scoring';
import { nclcForScore } from '../../domain/tcf/nclc';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { Row } from '../ui/Bits';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/Progress';

/** Past mock runs, newest first, with each test's score and NCLC practice estimate. */
export function MockHistory({ runs, titles }: { runs: readonly MockRunRecord[]; titles: ReadonlyMap<string, string> }) {
  const { colors } = useTheme();
  if (runs.length === 0) {
    return (
      <Card>
        <AppText variant="body" tone="muted">
          No mock results yet. Your scores will appear here so you can see your progress.
        </AppText>
      </Card>
    );
  }
  return (
    <>
      {runs.map((run) => (
        <Card key={`${run.mockId}-${run.takenAt}`} testID="mock-history-run">
          <Row style={styles.between}>
            <AppText variant="bodyStrong">{titles.get(run.mockId) ?? run.mockId}</AppText>
            <AppText variant="meta" tone="muted">
              {new Date(run.takenAt).toLocaleDateString()}
            </AppText>
          </Row>
          {TCF_SKILLS.filter((s) => run.scores[s] !== undefined).map((skill) => {
            const score = run.scores[skill] ?? 0;
            return (
              <View key={skill} style={styles.skill} accessible accessibilityLabel={`${TCF_CANADA[skill].title}: ${Math.round(score * 100)} percent, about NCLC ${nclcForScore(score)}`}>
                <Row style={styles.between}>
                  <AppText variant="meta">{TCF_CANADA[skill].title}</AppText>
                  <AppText variant="meta" tone="muted">{`${Math.round(score * 100)}% · ≈ NCLC ${nclcForScore(score)}`}</AppText>
                </Row>
                <ProgressBar value={score} color={colors.skills[skill].base} track={colors.skills[skill].tint} />
              </View>
            );
          })}
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between' },
  skill: { gap: spacing.xs, marginTop: spacing.sm },
});

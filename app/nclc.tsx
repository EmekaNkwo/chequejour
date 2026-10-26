import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../components/theme/ThemeProvider';
import { radii, spacing } from '../components/theme/tokens';
import { AppText } from '../components/ui/AppText';
import { Row, SectionTitle } from '../components/ui/Bits';
import { Card } from '../components/ui/Card';
import { Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { cefrForNclc, NCLC_DISCLAIMER, NCLC_THRESHOLDS } from '../domain/tcf/nclc';

export default function NclcInfoScreen() {
  const { colors } = useTheme();
  return (
    <Screen testID="nclc-screen">
      <ScreenHeader title="About NCLC" back />
      <View style={[styles.disclaimer, { backgroundColor: colors.skills.vocabulary.tint }]} accessible accessibilityRole="text">
        <Feather name="info" size={20} color={colors.skills.vocabulary.onTint} />
        <AppText variant="bodyStrong" color={colors.skills.vocabulary.onTint} style={styles.flex}>
          {NCLC_DISCLAIMER}
        </AppText>
      </View>

      <Card>
        <AppText variant="cardTitle">What is NCLC?</AppText>
        <AppText variant="body" tone="secondary" style={styles.mt}>
          The Niveaux de compétence linguistique canadiens (NCLC) are Canada&apos;s scale for French ability, from 1 to 12. Canadian immigration converts TCF Canada results into an NCLC level for each of the four skills separately: listening, reading, writing and speaking.
        </AppText>
        <AppText variant="body" tone="secondary" style={styles.mt}>
          Because each skill is scored on its own, your weakest skill usually decides whether you reach a requirement. That&apos;s why the app shows each skill separately and points out the weakest one.
        </AppText>
      </Card>

      <Card>
        <AppText variant="cardTitle">Check the official requirements</AppText>
        <AppText variant="body" tone="secondary" style={styles.mt}>
          Score requirements depend on the immigration program and change over time. Always check the current requirements with IRCC (Immigration, Refugees and Citizenship Canada) on its official website before you plan around a target.
        </AppText>
      </Card>

      <SectionTitle title="How the app estimates it" />
      <Card>
        <AppText variant="body" tone="secondary">
          Each skill gets a practice score from 0 to 100%: your latest mock test in that skill (harder questions earn more points), blended with your recent practice. Writing and speaking use your own self-assessment against the model answers. The score is then placed on this approximate scale:
        </AppText>
        {NCLC_THRESHOLDS.map((t) => (
          <Row key={t.nclc} style={[styles.tableRow, { borderColor: colors.border }]}>
            <AppText variant="bodyStrong" style={styles.col}>{`${t.nclc === 3 ? '3 or below' : `NCLC ${t.nclc}`}`}</AppText>
            <AppText variant="meta" tone="muted" style={styles.col}>{`from ${Math.round(t.minScore * 100)}%`}</AppText>
            <AppText variant="meta" tone="muted" style={styles.col}>{`≈ ${cefrForNclc(t.nclc)}`}</AppText>
          </Row>
        ))}
        <AppText variant="meta" tone="muted" style={styles.mt}>
          This course goes from A2 to B1, so practice alone can show about NCLC 6. The mock tests include a few harder questions, which is how an estimate of NCLC 7 or 8 can appear.
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  disclaimer: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, alignItems: 'flex-start' },
  flex: { flex: 1 },
  mt: { marginTop: spacing.sm },
  tableRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.sm, marginTop: spacing.xs },
  col: { flex: 1 },
});

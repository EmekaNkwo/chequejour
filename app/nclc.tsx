import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../components/theme/ThemeProvider';
import { radii, spacing } from '../components/theme/tokens';
import { AppText } from '../components/ui/AppText';
import { Row, SectionTitle } from '../components/ui/Bits';
import { Card } from '../components/ui/Card';
import { Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { cefrForNclc, IRCC_TCF_TABLE, NCLC_DISCLAIMER, NCLC_THRESHOLDS, type ScoreRange } from '../domain/tcf/nclc';

const range = (r: ScoreRange): string => (r.min === r.max ? String(r.min) : `${r.min}–${r.max}`);

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

      <SectionTitle title="Real TCF Canada scores for each NCLC" />
      <Card testID="ircc-table">
        <AppText variant="body" tone="secondary">
          IRCC converts your real TCF Canada results like this. Listening and reading are scored out of 699, writing and speaking out of 20.
        </AppText>
        <Row style={[styles.tableRow, { borderColor: colors.border }]}>
          {['NCLC', 'Listen', 'Read', 'Write', 'Speak'].map((h) => (
            <AppText key={h} variant="label" tone="muted" style={styles.col}>
              {h}
            </AppText>
          ))}
        </Row>
        {IRCC_TCF_TABLE.map((r) => (
          <View
            key={r.nclc}
            style={[styles.line, styles.tableRow, { borderColor: colors.border }]}
            accessible
            accessibilityLabel={`NCLC ${r.nclc === 10 ? '10 and above' : r.nclc}: listening ${range(r.listening)}, reading ${range(r.reading)}, writing ${range(r.writing)}, speaking ${range(r.speaking)}`}
          >
            <AppText variant="bodyStrong" style={styles.col}>{r.nclc === 10 ? '10+' : String(r.nclc)}</AppText>
            <AppText variant="meta" style={styles.col}>{range(r.listening)}</AppText>
            <AppText variant="meta" style={styles.col}>{range(r.reading)}</AppText>
            <AppText variant="meta" style={styles.col}>{range(r.writing)}</AppText>
            <AppText variant="meta" style={styles.col}>{range(r.speaking)}</AppText>
          </View>
        ))}
        <AppText variant="meta" tone="muted" style={styles.mt}>
          From IRCC&apos;s Express Entry language test page on canada.ca, checked October 2026. Tables can change, so check the current one for your program. The app&apos;s practice scores are not TCF scores and can&apos;t be read against this table.
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
            <AppText variant="meta" tone="muted" style={styles.col}>{t.nclc >= 7 ? '≈ B2' : `≈ ${cefrForNclc(t.nclc)}`}</AppText>
          </Row>
        ))}
        <AppText variant="meta" tone="muted" style={styles.mt}>
          This course goes from A2 to B1, so practice alone can show about NCLC 6. NCLC 7 and 8 are usually placed around B2; the mock tests include a few harder questions, which is how an estimate of NCLC 7 or 8 can appear.
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
  line: { flexDirection: 'row', alignItems: 'center' },
});

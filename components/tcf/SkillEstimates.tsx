/**
 * The four TCF Canada skills, each with a CEFR and NCLC practice estimate, the gap to
 * the learner's target, and the weakest skill picked out.
 */
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { TCF_CANADA } from '../../domain/tcf/exam-format';
import { gapToTarget, isEstimate, type NclcOverview, type SkillEstimate } from '../../domain/tcf/nclc';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { LevelPill, LinkText, Pill, Row, SKILL_ICON } from '../ui/Bits';
import { Card } from '../ui/Card';

const SOURCE_LABEL: Readonly<Record<SkillEstimate['source'], string>> = {
  'mock+practice': 'From your latest mock and recent practice',
  mock: 'From your latest mock',
  practice: 'From recent practice (take a mock for a better estimate)',
};

export function SkillEstimates({ overview }: { overview: NclcOverview }) {
  const { colors } = useTheme();
  return (
    <View style={styles.gap} testID="skill-estimates">
      {overview.skills.map((result) => {
        const f = TCF_CANADA[result.skill];
        const palette = colors.skills[result.skill];
        if (!isEstimate(result)) {
          return (
            <Card key={result.skill} accessibilityLabel={`${f.title}: not enough data yet.`} testID={`estimate-${result.skill}`}>
              <Row>
                <Feather name={SKILL_ICON[result.skill]} size={20} color={palette.base} />
                <AppText variant="cardTitle" style={styles.flex}>
                  {f.title}
                </AppText>
              </Row>
              <AppText variant="meta" tone="muted" style={styles.mt}>
                Not enough data yet. Take this test in a mock, or keep practising this skill.
              </AppText>
            </Card>
          );
        }
        const weakest = overview.weakest === result.skill;
        const gap = gapToTarget(result, overview.target);
        return (
          <Card
            key={result.skill}
            style={weakest ? [styles.weakest, { borderColor: colors.danger }] : undefined}
            accessibilityLabel={`${f.title}: about NCLC ${result.nclc}, ${result.nclc >= 7 ? 'around B2' : result.cefr}. ${gap > 0 ? `${gap} below your target of NCLC ${overview.target}` : 'Target reached'}.${weakest ? ' Your weakest skill.' : ''}${result.selfAssessed ? ' Self-assessed.' : ''} Practice estimate.`}
            testID={`estimate-${result.skill}`}
          >
            <Row>
              <Feather name={SKILL_ICON[result.skill]} size={20} color={palette.base} />
              <AppText variant="cardTitle" style={styles.flex}>
                {f.title}
              </AppText>
              {weakest ? <Pill label="WEAKEST" color={colors.dangerTint} textColor={colors.danger} icon="alert-triangle" /> : null}
            </Row>
            <Row style={styles.mt}>
              <View style={[styles.nclc, { backgroundColor: palette.tint }]}>
                <AppText variant="label" color={palette.onTint}>
                  NCLC ≈
                </AppText>
                <AppText variant="screenTitle" color={palette.onTint}>
                  {String(result.nclc)}
                </AppText>
              </View>
              <View style={styles.flex}>
                <Row gap={spacing.sm}>
                  {result.nclc >= 7 ? <Pill label="≈ B2" color={colors.skills.tests.tint} textColor={colors.skills.tests.onTint} /> : <LevelPill level={result.cefr} />}
                  <AppText variant="bodyStrong" color={gap > 0 ? colors.text : colors.success}>
                    {gap > 0 ? `${gap} below target (${overview.target})` : 'Target reached'}
                  </AppText>
                </Row>
                <AppText variant="meta" tone="muted">
                  {`${SOURCE_LABEL[result.source]}${result.selfAssessed ? ' · self-assessed' : ''}`}
                </AppText>
              </View>
            </Row>
          </Card>
        );
      })}
      <Row style={styles.between}>
        <AppText variant="meta" tone="muted">{`Your target: NCLC ${overview.target} in every skill`}</AppText>
        <LinkText label="What is NCLC?" icon="info" onPress={() => router.push('/nclc')} />
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  mt: { marginTop: spacing.sm },
  between: { justifyContent: 'space-between', flexWrap: 'wrap' },
  weakest: { borderWidth: 2 },
  nclc: { width: 72, minHeight: 72, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
});

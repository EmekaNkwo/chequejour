import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { TCF_CANADA, type TcfSkill } from '../../domain/tcf/exam-format';
import { countdownLabel, examPhase } from '../../domain/tcf/exam-plan';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { Row } from '../ui/Bits';
import { Card } from '../ui/Card';

function focusText(days: number, weakest: TcfSkill | null): string {
  const phase = examPhase(days);
  const skill = weakest ? TCF_CANADA[weakest].title.toLowerCase() : null;
  if (phase === 'final') return skill ? `Final stretch: daily mock-style practice, with extra ${skill}.` : 'Final stretch: daily mock-style practice.';
  if (phase === 'focus') return skill ? `Sessions now include extra ${skill}, your weakest skill.` : 'Sessions will focus on your weakest skill as the date nears.';
  if (phase === 'past') return 'Update the date in Settings if you are taking it again.';
  return 'Take a mock test to see where you stand in each skill.';
}

/** Home card: days left until the learner's TCF Canada and what the sessions focus on. */
export function ExamCountdown({ days, weakest }: { days: number; weakest: TcfSkill | null }) {
  const { colors } = useTheme();
  const label = countdownLabel(days) ?? '';
  const detail = focusText(days, weakest);
  return (
    <Card onPress={() => router.push('/level')} color={colors.skills.tests.tint} accessibilityLabel={`${label}. ${detail} Opens your level by skill.`} testID="exam-countdown">
      <Row gap={spacing.lg}>
        <View style={[styles.badge, { backgroundColor: colors.skills.tests.base }]}>
          {days > 0 ? (
            <AppText variant="screenTitle" color={colors.skills.tests.onBase}>
              {String(days)}
            </AppText>
          ) : (
            <Feather name="flag" size={24} color={colors.skills.tests.onBase} />
          )}
        </View>
        <View style={styles.flex}>
          <AppText variant="cardTitle" color={colors.skills.tests.onTint}>
            {label}
          </AppText>
          <AppText variant="meta" color={colors.skills.tests.onTint}>
            {detail}
          </AppText>
        </View>
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  badge: { minWidth: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
});

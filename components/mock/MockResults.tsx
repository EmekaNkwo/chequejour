import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { TCF_CANADA, TCF_SKILLS } from '../../domain/tcf/exam-format';
import type { MockSkillScores, ReviewItem } from '../../domain/tcf/mock-scoring';
import { cefrForNclc, NCLC_DISCLAIMER, nclcForScore, nclcLabel } from '../../domain/tcf/nclc';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { Row, SectionTitle } from '../ui/Bits';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/Progress';
import { Screen } from '../ui/Screen';
import { ScreenHeader } from '../ui/ScreenHeader';

export interface MockResultsProps {
  title: string;
  scores: MockSkillScores;
  /** Questions to review, by test. */
  review: Partial<Record<'listening' | 'reading', ReviewItem[]>>;
}

export function MockResults({ title, scores, review }: MockResultsProps) {
  const { colors } = useTheme();
  const taken = TCF_SKILLS.filter((s) => scores[s] !== undefined);
  return (
    <Screen testID="mock-results" footer={<Button label="See my level by skill" icon="bar-chart-2" variant="secondary" onPress={() => router.replace('/level')} testID="mock-to-level" />}>
      <ScreenHeader title="Results" back subtitle={title} />
      <Card>
        {taken.map((skill) => {
          const score = scores[skill] ?? 0;
          const nclc = nclcForScore(score);
          const self = skill === 'writing' || skill === 'speaking';
          return (
            <View
              key={skill}
              style={styles.skill}
              accessible
              accessibilityLabel={`${TCF_CANADA[skill].title}: ${Math.round(score * 100)} percent. Practice estimate ${nclcLabel(nclc)}, ${cefrForNclc(nclc)}${self ? ', self-assessed' : ''}.`}
              testID={`mock-result-${skill}`}
            >
              <Row style={styles.between}>
                <AppText variant="bodyStrong">{TCF_CANADA[skill].titleFr}</AppText>
                <AppText variant="bodyStrong">{`≈ ${nclcLabel(nclc)} · ${cefrForNclc(nclc)}`}</AppText>
              </Row>
              <ProgressBar value={score} color={colors.skills[skill].base} track={colors.skills[skill].tint} height={10} />
              <AppText variant="meta" tone="muted">
                {`${Math.round(score * 100)}% of points${self ? ' · self-assessed' : ' · harder questions count more'}`}
              </AppText>
            </View>
          );
        })}
      </Card>
      <AppText variant="meta" tone="muted">
        {NCLC_DISCLAIMER}
      </AppText>

      {(['listening', 'reading'] as const).map((skill) => {
        const items = review[skill] ?? [];
        if (items.length === 0) return null;
        return (
          <View key={skill} style={styles.gap}>
            <SectionTitle title={`${TCF_CANADA[skill].title}: to review (${items.length})`} />
            {items.map((item) => (
              <Card key={item.questionId} accessibilityLabel={`${item.question}. Your answer: ${item.yours ?? 'none'}. Correct answer: ${item.correct}. ${item.explanation}`}>
                <AppText variant="label" tone="muted">{`LEVEL ${item.band}`}</AppText>
                <AppText variant="bodyStrong" french>
                  {item.question}
                </AppText>
                <AppText variant="body" tone="danger" style={item.yours ? styles.strike : undefined}>
                  {item.yours ?? 'Not answered'}
                </AppText>
                <AppText variant="bodyStrong" tone="success" french>
                  {item.correct}
                </AppText>
                <AppText variant="meta" tone="muted">
                  {item.explanation}
                </AppText>
              </Card>
            ))}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between' },
  skill: { gap: spacing.xs, marginBottom: spacing.lg },
  gap: { gap: spacing.md },
  strike: { textDecorationLine: 'line-through' },
});

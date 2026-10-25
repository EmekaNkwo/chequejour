import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ProgressRing } from '../ui/Progress';
import { Row } from '../ui/Bits';
import type { ComprehensionAnswer } from './ComprehensionQuiz';

/** Score card shown after the comprehension questions of a listening or reading item. */
export function SkillResult({ answers, onRetry }: { answers: readonly ComprehensionAnswer[]; onRetry: () => void }) {
  const correct = answers.filter((a) => a.correct).length;
  const score = answers.length > 0 ? correct / answers.length : 0;
  const pct = Math.round(score * 100);
  return (
    <Card accessibilityLabel={`${correct} of ${answers.length} correct, ${pct} percent`} testID="skill-result">
      <Row gap={spacing.lg}>
        <ProgressRing value={score} accessibilityLabel={`${pct} percent correct`} />
        <AppText variant="cardTitle" style={styles.flex}>
          {`${correct} of ${answers.length} correct`}
        </AppText>
      </Row>
      <AppText variant="meta" tone="muted" style={styles.mt}>
        {correct < answers.length ? 'Questions you missed are saved in your mistakes notebook.' : 'Parfait ! Everything right.'}
      </AppText>
      <Button label="Done" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.mt} testID="skill-done" />
      <Button label="Try again" variant="ghost" onPress={onRetry} />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt: { marginTop: spacing.md },
});

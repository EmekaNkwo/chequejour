import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ProgressRing } from '../ui/Progress';
import { Screen } from '../ui/Screen';

export interface QuizResultProps {
  title: string;
  /** Leave out for screens without a score (e.g. a finished review). */
  score?: { correct: number; total: number };
  message: string;
  good?: boolean;
  primaryLabel?: string;
  onPrimary: () => void;
  secondary?: ReactNode;
  testID?: string;
  /** testID of the primary button. */
  primaryTestID?: string;
}

/** Calm end-of-activity screen: score ring, a short message and what to do next. */
export function QuizResult({ title, score, message, good = true, primaryLabel = 'Done', onPrimary, secondary, testID, primaryTestID = 'result-done' }: QuizResultProps) {
  const { colors } = useTheme();
  const pct = score && score.total > 0 ? score.correct / score.total : 1;
  return (
    <Screen testID={testID}>
      <AppText variant="screenTitle" accessibilityRole="header">
        {title}
      </AppText>
      <Card>
        <View style={styles.center}>
          {score ? (
            <ProgressRing
              value={pct}
              size={120}
              stroke={12}
              color={good ? colors.success : colors.primary}
              accessibilityLabel={`${score.correct} of ${score.total} correct, ${Math.round(pct * 100)} percent`}
            />
          ) : (
            <Feather name="check-circle" size={56} color={colors.success} />
          )}
          {score ? <AppText variant="title">{`${score.correct} / ${score.total}`}</AppText> : null}
          <AppText variant="body" tone="secondary" center>
            {message}
          </AppText>
        </View>
      </Card>
      <Button label={primaryLabel} onPress={onPrimary} testID={primaryTestID} />
      {secondary}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.md },
});

/**
 * After the writing or speaking test: for each task the learner compares their work
 * with the model answer and ticks the criteria they met. The ticks become the task's
 * self-assessed score; nothing is graded automatically.
 */
import { Feather } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { checklistScore } from '../../domain/tcf/mock-scoring';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { PressableScale } from '../ui/PressableScale';
import { Screen } from '../ui/Screen';
import { ScreenHeader } from '../ui/ScreenHeader';

export interface AssessedTask {
  key: string;
  title: string;
  /** The learner's text, or controls to play back their recording. */
  yours: ReactNode;
  model: ReactNode;
  criteria: readonly string[];
}

export interface SelfAssessmentProps {
  title: string;
  tasks: readonly AssessedTask[];
  onDone: (scores: number[]) => void;
}

export function SelfAssessment({ title, tasks, onDone }: SelfAssessmentProps) {
  const { colors } = useTheme();
  const [checked, setChecked] = useState<boolean[][]>(() => tasks.map((t) => t.criteria.map(() => false)));
  const toggle = (task: number, item: number) => setChecked((all) => all.map((row, i) => (i === task ? row.map((v, j) => (j === item ? !v : v)) : row)));

  return (
    <Screen testID="mock-self-assessment" footer={<Button label="See my results" icon="bar-chart-2" onPress={() => onDone(checked.map(checklistScore))} testID="mock-assessment-done" />}>
      <ScreenHeader title={title} subtitle="Self-assessment" />
      <AppText variant="body" tone="secondary">
        Compare each task with the model answer, then tick what your answer did. Be honest: this is for you, and it shapes your practice estimate.
      </AppText>
      {tasks.map((task, t) => (
        <Card key={task.key}>
          <AppText variant="label" tone="muted">{`TASK ${t + 1}`}</AppText>
          <AppText variant="cardTitle">{task.title}</AppText>
          <View style={[styles.block, { backgroundColor: colors.surfaceRaised }]}>
            <AppText variant="label" tone="muted">
              YOURS
            </AppText>
            {task.yours}
          </View>
          <View style={[styles.block, { backgroundColor: colors.skills.tests.tint }]}>
            <AppText variant="label" color={colors.skills.tests.onTint}>
              MODEL ANSWER
            </AppText>
            {task.model}
          </View>
          {task.criteria.map((c, i) => (
            <PressableScale
              key={c}
              onPress={() => toggle(t, i)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: checked[t]?.[i] ?? false }}
              accessibilityLabel={c}
              style={styles.check}
              testID={`assess-${t}-${i}`}
            >
              <Feather name={checked[t]?.[i] ? 'check-square' : 'square'} size={22} color={checked[t]?.[i] ? colors.success : colors.textMuted} />
              <AppText variant="body" style={styles.flex}>
                {c}
              </AppText>
            </PressableScale>
          ))}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { borderRadius: radii.md, padding: spacing.lg, gap: spacing.xs, marginTop: spacing.md },
  check: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44, marginTop: spacing.sm },
});

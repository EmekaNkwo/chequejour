import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../components/theme/ThemeProvider';
import { spacing } from '../components/theme/tokens';
import { AppText } from '../components/ui/AppText';
import { Row, SkillThumb, SKILL_LABEL } from '../components/ui/Bits';
import { Card } from '../components/ui/Card';
import { ProgressRing } from '../components/ui/Progress';
import { ErrorState, Loading, Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import type { PaletteKey } from '../components/theme/tokens';
import type { SessionStep } from '../domain/session';
import { useApp } from '../features/app/AppContext';
import { useLoad } from '../features/app/useLoad';
import { loadPath } from '../features/path/path-service';
import { masteredIds, structuresUnitId } from '../features/session/session-service';
import { todayPlan } from '../features/session/today-plan';
import { isPracticeRun } from '../features/mock/mock-service';
import { loadExamContext } from '../features/tcf/nclc-service';

export function stepRoute(step: SessionStep): string {
  switch (step.kind) {
    case 'review':
      return '/review';
    case 'mistakes':
      return '/mistakes?review=1';
    case 'lesson':
      return `/lesson/${encodeURIComponent(step.segment.id)}`;
    case 'skill': {
      const unitId = structuresUnitId(step.task.itemId);
      return unitId ? `/drill/${unitId}` : `/${step.task.skill}/${step.task.itemId}`;
    }
    case 'exam':
      return isPracticeRun(step.practice.itemId) ? `/exam-practice/${step.practice.skill}` : `/exam-practice/${step.practice.skill}?task=${step.practice.itemId}`;
  }
}

function describe(step: SessionStep): { title: string; meta: string; skill: PaletteKey } {
  switch (step.kind) {
    case 'review':
      return { title: 'Reviews', meta: `${step.itemIds.length} words and sentences due`, skill: 'vocabulary' };
    case 'mistakes':
      return { title: 'Mistakes', meta: `${step.mistakeIds.length} to try again`, skill: 'structures' };
    case 'lesson':
      return { title: step.segment.title, meta: `New lesson · ${step.segment.kind === 'words' ? 'vocabulary' : step.segment.kind}`, skill: step.segment.kind === 'words' ? 'vocabulary' : 'structures' };
    case 'skill':
      return { title: step.task.title, meta: SKILL_LABEL[step.task.skill], skill: step.task.skill };
    case 'exam':
      return { title: step.practice.title, meta: 'Exam practice · final stretch', skill: 'tests' };
  }
}

export default function SessionScreen() {
  const { content, progress, settings, today } = useApp();
  const { colors } = useTheme();
  const { data, error, reload } = useLoad(
    'session',
    async () => {
      const path = await loadPath(content, progress, settings.placementLevel, await masteredIds(progress));
      const exam = await loadExamContext(content, progress, settings, Date.now());
      return todayPlan(content, progress, path, settings.dailyGoal, today, Date.now(), exam);
    },
    [settings.dailyGoal, settings.examDate, settings.targetNclc, today],
  );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const pct = Math.round(data.completion * 100);
  const next = data.steps.find((s) => !s.done);

  return (
    <Screen testID="session-screen">
      <ScreenHeader title="Today's session" back />
      <Card>
        <Row gap={spacing.lg}>
          <ProgressRing value={data.completion} size={92} accessibilityLabel={`Today's session, ${pct} percent complete`} />
          <View style={styles.flex}>
            <AppText variant="cardTitle">{next ? 'Next up' : 'All done'}</AppText>
            <AppText variant="body" tone="secondary">
              {next ? describe(next.step).title : 'Come back tomorrow, or practise anything from the Practice tab.'}
            </AppText>
          </View>
        </Row>
      </Card>
      {data.steps.length === 0 ? (
        <AppText variant="body" tone="muted">
          Nothing is due today. Explore the Learn or Practice tabs if you want more.
        </AppText>
      ) : null}
      {data.steps.map(({ step, done }, i) => {
        const d = describe(step);
        return (
          <Card
            key={`${step.kind}-${i}`}
            onPress={() => router.push(stepRoute(step))}
            accessibilityLabel={`Step ${i + 1}: ${d.title}. ${d.meta}. ${done ? 'Done' : 'Not done yet'}.`}
            testID={`session-step-${step.kind}`}
          >
            <Row>
              <SkillThumb skill={d.skill} />
              <View style={styles.flex}>
                <AppText variant="label" tone="muted">
                  {d.meta.toUpperCase()}
                </AppText>
                <AppText variant="cardTitle">{d.title}</AppText>
              </View>
              <Feather name={done ? 'check-circle' : 'chevron-right'} size={24} color={done ? colors.success : colors.textMuted} />
            </Row>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
});

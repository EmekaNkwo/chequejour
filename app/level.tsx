import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../components/theme/ThemeProvider';
import { radii, spacing } from '../components/theme/tokens';
import { AppText } from '../components/ui/AppText';
import { LevelPill, Row, SectionTitle } from '../components/ui/Bits';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/Progress';
import { ErrorState, Loading, Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { MASTERY_TARGET, MIN_ATTEMPTS, MOCK_TEST_THRESHOLD, RECENT_ATTEMPTS } from '../domain/level';
import { useApp } from '../features/app/AppContext';
import { useLoad } from '../features/app/useLoad';
import { loadPath } from '../features/path/path-service';
import { levelOverview } from '../features/progress/stats-service';
import { loadNclcOverview } from '../features/tcf/nclc-service';
import { SkillEstimates } from '../components/tcf/SkillEstimates';
import { masteredIds } from '../features/session/session-service';

const pct = (v: number): string => `${Math.round(v * 100)}%`;

export default function LevelScreen() {
  const { content, progress, settings } = useApp();
  const { colors } = useTheme();
  const { data, error, reload } = useLoad(
    'level',
    async () => {
      const mastered = await masteredIds(progress);
      const path = await loadPath(content, progress, settings.placementLevel, mastered);
      const [overview, nclc] = await Promise.all([
        levelOverview(progress, path, settings.placementLevel, mastered.size),
        loadNclcOverview(content, progress, settings.targetNclc, Date.now()),
      ]);
      return { ...overview, nclc };
    },
    [settings.placementLevel, settings.targetNclc],
  );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const { estimate } = data;
  const mockOpen = data.mockUnlocked || settings.examDate !== null;

  const parts = [
    {
      title: 'Path progress',
      weight: '45%',
      value: estimate.parts.progress,
      detail: `${data.completedUnits} of ${data.totalUnits} units completed (a unit counts once its checkpoint is passed).`,
    },
    {
      title: 'Vocabulary mastery',
      weight: '25%',
      value: estimate.parts.mastery,
      detail: `${data.mastered} words and sentences mastered, out of a target of ${MASTERY_TARGET}. An item is mastered once reviews show you'll remember it for three weeks or more.`,
    },
    {
      title: 'Demonstrated level',
      weight: '30%',
      value: estimate.parts.demonstrated,
      detail: `Your last ${RECENT_ATTEMPTS} answers. Correct B1 answers count most, A2 answers least. It counts fully after ${MIN_ATTEMPTS} answers.`,
    },
  ];

  return (
    <Screen testID="level-screen">
      <ScreenHeader title="Your level" back />

      <View style={[styles.disclaimer, { backgroundColor: colors.skills.vocabulary.tint }]} accessible accessibilityRole="text">
        <Feather name="info" size={20} color={colors.skills.vocabulary.onTint} />
        <AppText variant="bodyStrong" color={colors.skills.vocabulary.onTint} style={styles.flex}>
          This is a practice estimate from your work in the app. It is not an official TCF result and doesn&apos;t predict your exam score.
        </AppText>
      </View>

      <SectionTitle title="TCF Canada skills" />
      <SkillEstimates overview={data.nclc} />

      <SectionTitle title="Overall course level" />
      <Card accessibilityLabel={`Estimated level ${estimate.label}, ${pct(estimate.value)} of the way from A2 to B1. Practice estimate.`}>
        <Row style={styles.between}>
          <AppText variant="cardTitle">Estimated level</AppText>
          <LevelPill level={estimate.label} />
        </Row>
        <Row style={styles.mt}>
          <AppText variant="bodyStrong">A2</AppText>
          <View style={styles.flex}>
            <ProgressBar value={estimate.value} height={12} />
          </View>
          <AppText variant="bodyStrong">B1</AppText>
        </Row>
        <AppText variant="meta" tone="muted" style={styles.mt}>
          {`${pct(estimate.value)} of the way from A2 to B1 · A2+ from 35%, B1 from 75%`}
        </AppText>
      </Card>

      <SectionTitle title="How it's worked out" />
      {parts.map((p) => (
        <Card key={p.title} accessibilityLabel={`${p.title}, weight ${p.weight}: ${pct(p.value)}. ${p.detail}`}>
          <Row style={styles.between}>
            <AppText variant="cardTitle">{p.title}</AppText>
            <AppText variant="meta" tone="muted">
              {`${pct(p.value)} · weight ${p.weight}`}
            </AppText>
          </Row>
          <View style={styles.mt}>
            <ProgressBar value={p.value} />
          </View>
          <AppText variant="meta" tone="muted" style={styles.mt}>
            {p.detail}
          </AppText>
        </Card>
      ))}

      <Card>
        <AppText variant="body" tone="secondary">
          The estimate is 45% path progress + 25% vocabulary mastery + 30% demonstrated level. It never drops below the starting point set by your placement test.
        </AppText>
        <AppText variant="meta" tone="muted" style={styles.mt}>
          {`Placement result: ${settings.placementLevel ?? 'not taken (starting at A2)'}`}
        </AppText>
      </Card>

      <Card accessibilityLabel={mockOpen ? 'Mock tests are unlocked.' : 'Mock tests are locked.'}>
        <Row>
          <Feather name={mockOpen ? 'unlock' : 'lock'} size={20} color={colors.text} />
          <AppText variant="cardTitle">{mockOpen ? 'Mock tests unlocked' : 'Mock tests locked'}</AppText>
        </Row>
        <AppText variant="meta" tone="muted" style={styles.mt}>
          {`TCF Canada mock tests open when the estimate reaches ${pct(MOCK_TEST_THRESHOLD)}, once every A2 and A2+ unit is complete, or as soon as you set an exam date.`}
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  disclaimer: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, alignItems: 'flex-start' },
  flex: { flex: 1 },
  between: { justifyContent: 'space-between' },
  mt: { marginTop: spacing.sm },
});

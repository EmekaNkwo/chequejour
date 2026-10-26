import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../components/theme/ThemeProvider';
import { spacing } from '../../components/theme/tokens';
import { AppText } from '../../components/ui/AppText';
import { LinkText, Row, SectionTitle, SKILL_ICON, SKILL_LABEL } from '../../components/ui/Bits';
import { IconButton } from '../../components/ui/Button';
import { BackupStatus } from '../../components/settings/BackupReminder';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/Progress';
import { ErrorState, Loading, Screen } from '../../components/ui/Screen';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { lastNDays } from '../../domain/dates';
import { useApp } from '../../features/app/AppContext';
import { useLoad } from '../../features/app/useLoad';
import { loadPath } from '../../features/path/path-service';
import { levelOverview, skillBreakdown, streak, thisWeek } from '../../features/progress/stats-service';
import { masteredIds } from '../../features/session/session-service';


const DAYS_PER_WEEK = 7;
export default function ProgressScreen() {
  const { content, progress, settings, today } = useApp();
  const { colors } = useTheme();
  const { data, error, reload } = useLoad(
    'progress',
    async () => {
      const mastered = await masteredIds(progress);
      const path = await loadPath(content, progress, settings.placementLevel, mastered);
      const [skills, week, streakInfo, level, mistakes, active] = await Promise.all([
        skillBreakdown(content, progress, path),
        thisWeek(progress, today),
        streak(progress, today),
        levelOverview(progress, path, settings.placementLevel, mastered.size),
        progress.mistakes(),
        progress.activeDays(),
      ]);
      return { skills, week, streak: streakInfo, level, mistakes, active };
    },
    [settings.placementLevel, today],
  );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const { skills, week, level, mistakes } = data;
  const days = lastNDays(today, DAYS_PER_WEEK * 2);
  const rest = new Set(data.streak.restDays);

  return (
    <Screen tabs testID="progress-screen">
      <ScreenHeader title="Progrès" actions={<IconButton icon="settings" label="Settings" onPress={() => router.push('/settings')} testID="open-settings" />} />

      <Card onPress={() => router.push('/level')} accessibilityLabel={`Estimated level ${level.estimate.label}. ${level.completedUnits} of ${level.totalUnits} units complete. ${level.mastered} items mastered.`}>
        <AppText variant="cardTitle">A1 → B1</AppText>
        <View style={styles.mt}>
          <ProgressBar value={level.estimate.value} height={12} />
        </View>
        <AppText variant="meta" tone="muted" style={styles.mt}>
          {`${level.estimate.label} (practice estimate) · ${level.completedUnits}/${level.totalUnits} units · ${level.mastered} items mastered`}
        </AppText>
      </Card>

      <SectionTitle title="Skills" />
      <Card>
        <View style={styles.skills}>
          {skills.map((s) => {
            const palette = colors.skills[s.skill];
            const acc = s.accuracy === null ? 'no answers yet' : `${Math.round(s.accuracy * 100)}% accuracy`;
            return (
              <View key={s.skill} style={styles.skill} accessible accessibilityLabel={`${SKILL_LABEL[s.skill]}: ${Math.round(s.completion * 100)} percent complete, ${acc}`}>
                <Row gap={spacing.sm}>
                  <View style={[styles.icon, { backgroundColor: palette.tint }]}>
                    <Feather name={SKILL_ICON[s.skill]} size={16} color={palette.onTint} />
                  </View>
                  <AppText variant="bodyStrong" style={styles.flex}>
                    {SKILL_LABEL[s.skill]}
                  </AppText>
                  <AppText variant="meta" tone="muted">
                    {acc}
                  </AppText>
                </Row>
                <ProgressBar value={s.completion} color={palette.base} track={palette.tint} height={10} />
              </View>
            );
          })}
        </View>
      </Card>

      <SectionTitle title="This week" action={<LinkText label="Details" onPress={() => router.push('/weekly')} />} />
      <Card onPress={() => router.push('/weekly')} accessibilityLabel={`This week: ${week.wordsLearned} words learned, ${week.minutes} minutes, accuracy ${week.accuracy === null ? 'not available' : `${Math.round(week.accuracy * 100)} percent`}.`}>
        <Row style={styles.between}>
          <Stat value={String(week.wordsLearned)} label={week.wordsLearned === 1 ? 'word' : 'words'} />
          <Stat value={week.accuracy === null ? '—' : `${Math.round(week.accuracy * 100)}%`} label="accuracy" />
          <Stat value={`${week.minutes}`} label={week.minutes === 1 ? 'minute' : 'minutes'} />
          <Stat value={String(week.daysStudied)} label={week.daysStudied === 1 ? 'day' : 'days'} />
        </Row>
        {week.weakest.length > 0 ? (
          <AppText variant="meta" tone="muted" style={styles.mt}>
            {`Work on: ${week.weakest.map((w) => w.label).join(', ')}`}
          </AppText>
        ) : null}
      </Card>

      <SectionTitle title="Streak" />
      <Card accessibilityLabel={`${data.streak.current} day streak. ${data.streak.restDays.length} rest days used. ${data.streak.restAvailable ? 'A rest day is available.' : 'No rest day available this week.'}`}>
        <Row style={styles.between}>
          <AppText variant="title">{`${data.streak.current} day${data.streak.current === 1 ? '' : 's'}`}</AppText>
          <AppText variant="meta" tone="muted">
            {data.streak.restAvailable ? 'Rest day available' : 'Rest day used this week'}
          </AppText>
        </Row>
        <View style={styles.days} importantForAccessibility="no-hide-descendants">
          {[days.slice(0, DAYS_PER_WEEK), days.slice(DAYS_PER_WEEK)].map((week) => (
            <View key={week[0]} style={styles.week}>
              {week.map((d) => {
                const isActive = data.active.has(d);
                const isRest = rest.has(d);
                return (
                  <View key={d} style={[styles.day, { backgroundColor: isActive ? colors.skills.structures.base : isRest ? colors.skills.unit.tint : colors.surfaceRaised }]}>
                    {isRest ? <Feather name="moon" size={12} color={colors.skills.unit.onTint} /> : isActive ? <Feather name="check" size={12} color={colors.skills.structures.onBase} /> : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
        <AppText variant="meta" tone="muted">
          One missed day a week counts as a rest day and keeps your streak.
        </AppText>
      </Card>

      <SectionTitle title="Mistakes notebook" action={<LinkText label="See all" onPress={() => router.push('/mistakes')} />} />
      {mistakes.length === 0 ? (
        <AppText variant="body" tone="muted">
          No open mistakes. Errors you make are saved here and come back for review.
        </AppText>
      ) : (
        mistakes.slice(0, 3).map((m) => (
          <Card key={m.id} onPress={() => router.push('/mistakes')} accessibilityLabel={`Mistake: ${m.prompt}. Correct answer: ${m.correctAnswer}`}>
            <AppText variant="meta" tone="muted" numberOfLines={2}>
              {m.prompt}
            </AppText>
            <AppText variant="bodyStrong" tone="danger" style={styles.strike}>
              {m.userAnswer}
            </AppText>
            <AppText variant="french" french>
              {m.correctAnswer}
            </AppText>
          </Card>
        ))
      )}

      <SectionTitle title="Your data" />
      <BackupStatus />
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="title">{value}</AppText>
      <AppText variant="meta" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  mt: { marginTop: spacing.sm },
  flex: { flex: 1 },
  between: { justifyContent: 'space-between' },
  skills: { gap: spacing.lg },
  skill: { gap: spacing.sm },
  icon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stat: { alignItems: 'center', flex: 1 },
  days: { gap: 6, marginVertical: spacing.md },
  week: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, maxWidth: 40, aspectRatio: 1, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  strike: { textDecorationLine: 'line-through' },
});

import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../components/theme/tokens';
import { AppText } from '../components/ui/AppText';
import { LinkText, ListRow, Row, SectionTitle } from '../components/ui/Bits';
import { Card } from '../components/ui/Card';
import { BarChart, ProgressBar } from '../components/ui/Progress';
import { ErrorState, Loading, Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { fromDayKey, type DayKey } from '../domain/dates';
import { weakestPoint } from '../domain/mistakes';
import { useApp } from '../features/app/AppContext';
import { useLoad } from '../features/app/useLoad';
import { lastSevenDays, thisWeek } from '../features/progress/stats-service';

const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const shortDate = (day: DayKey): string => fromDayKey(day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export default function WeeklyScreen() {
  const { progress, today } = useApp();
  const { data, error, reload } = useLoad(
    'weekly',
    async () => {
      const [week, days, mistakes] = await Promise.all([thisWeek(progress, today), lastSevenDays(progress, today), progress.mistakes()]);
      return { week, days, openMistakes: mistakes.length, weakestMistake: weakestPoint(mistakes) };
    },
    [today],
  );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const { week, days } = data;
  const accuracy = week.accuracy === null ? '—' : `${Math.round(week.accuracy * 100)}%`;

  return (
    <Screen testID="weekly-screen">
      <ScreenHeader title="This week" subtitle={`${shortDate(week.from)} – ${shortDate(week.to)}`} back />

      <Card accessibilityLabel={`${week.wordsLearned} words learned, accuracy ${accuracy}, ${week.minutes} minutes, ${week.reviews} reviews, ${week.daysStudied} days studied.`}>
        <View style={styles.stats}>
          <Stat value={String(week.wordsLearned)} label="words learned" />
          <Stat value={accuracy} label="accuracy" />
          <Stat value={String(week.minutes)} label="minutes" />
          <Stat value={String(week.reviews)} label="reviews" />
          <Stat value={`${week.daysStudied}/7`} label="days studied" />
        </View>
      </Card>

      <Card>
        <AppText variant="cardTitle">Study minutes</AppText>
        <AppText variant="meta" tone="muted">
          Last 7 days
        </AppText>
        <View style={styles.mt}>
          <BarChart
            values={days.map((d) => d.minutes)}
            labels={days.map((d) => WEEKDAY[fromDayKey(d.day).getDay()])}
            accessibilityLabel={`Study minutes per day, oldest first: ${days.map((d) => d.minutes).join(', ')}`}
          />
        </View>
      </Card>

      {data.weakestMistake ? (
        <Card
          onPress={() => router.push({ pathname: '/mistakes', params: { drill: data.weakestMistake?.tag } })}
          accessibilityLabel={`Weakest point in your notebook: ${data.weakestMistake.label}, ${data.weakestMistake.count} open mistakes. Starts a short drill.`}
          testID="weekly-drill"
        >
          <AppText variant="meta" tone="muted">
            Weakest point in your notebook
          </AppText>
          <Row style={styles.between}>
            <AppText variant="cardTitle" style={styles.flex}>
              {data.weakestMistake.label}
            </AppText>
            <AppText variant="bodyStrong" tone="primary">
              Drill it
            </AppText>
          </Row>
          <AppText variant="meta" tone="muted">{`${data.weakestMistake.count} open mistake${data.weakestMistake.count === 1 ? '' : 's'}`}</AppText>
        </Card>
      ) : null}

      <SectionTitle title="Weakest grammar points" />
      {week.weakest.length === 0 ? (
        <AppText variant="body" tone="muted">
          Nothing stands out this week. Weak points appear after a few answers on the same grammar point.
        </AppText>
      ) : (
        week.weakest.map((w) => (
          <Card
            key={w.tag}
            onPress={() => router.push(`/grammar?tag=${w.tag}`)}
            accessibilityLabel={`${w.label}: ${Math.round(w.accuracy * 100)} percent correct over ${w.attempts} answers. Opens the grammar lessons.`}
          >
            <Row style={styles.between}>
              <AppText variant="cardTitle" style={styles.flex}>
                {w.label}
              </AppText>
              <AppText variant="meta" tone="muted">
                {`${Math.round(w.accuracy * 100)}% · ${w.attempts} answers`}
              </AppText>
            </Row>
            <View style={styles.mt}>
              <ProgressBar value={w.accuracy} />
            </View>
            <View style={styles.mt}>
              <LinkText label="Drill this point" icon="target" onPress={() => router.push({ pathname: '/mistakes', params: { drill: w.tag } })} />
            </View>
          </Card>
        ))
      )}

      <SectionTitle title="Mistakes" />
      <ListRow
        skill="structures"
        icon="repeat"
        category="Mistakes notebook"
        title={data.openMistakes === 0 ? 'No open mistakes' : `${data.openMistakes} open mistake${data.openMistakes === 1 ? '' : 's'}`}
        onPress={() => router.push('/mistakes')}
      />
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="title">{value}</AppText>
      <AppText variant="meta" tone="muted" center>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.lg },
  stat: { width: '33%', alignItems: 'center' },
  mt: { marginTop: spacing.md },
  between: { justifyContent: 'space-between' },
  flex: { flex: 1 },
});

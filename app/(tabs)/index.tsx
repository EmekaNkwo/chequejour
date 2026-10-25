import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { PlayButton } from '../../components/audio/AudioControls';
import { useTheme } from '../../components/theme/ThemeProvider';
import { radii, spacing } from '../../components/theme/tokens';
import { AppText } from '../../components/ui/AppText';
import { GenderTag, LinkText, Pill, Row } from '../../components/ui/Bits';
import { Button, IconButton } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { BarChart, ProgressBar, ProgressRing } from '../../components/ui/Progress';
import { ErrorState, Loading, Screen } from '../../components/ui/Screen';
import { ContextRow, ScreenHeader } from '../../components/ui/ScreenHeader';
import { audioKey, headword } from '../../domain/audio-keys';
import { fromDayKey } from '../../domain/dates';
import { useApp } from '../../features/app/AppContext';
import { useLoad } from '../../features/app/useLoad';
import { loadHome, type HomeData } from '../../features/home/home-data';

const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function HomeScreen() {
  const app = useApp();
  const { data, error, reload } = useLoad('home', () => loadHome(app), [app.settings.dailyGoal, app.settings.placementLevel, app.today]);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return <Home data={data} />;
}

function Home({ data }: { data: HomeData }) {
  const { colors } = useTheme();
  const { path, plan, daily, activity, level, streak } = data;
  const current = path.current;
  const unitIndex = current ? path.units.findIndex((u) => u.id === current.id) + 1 : path.units.length;
  const pct = Math.round(plan.completion * 100);
  const weekMinutes = activity.reduce((n, d) => n + d.minutes, 0);
  const sessionDone = plan.completion >= 1;

  return (
    <Screen tabs testID="home-screen">
      <ScreenHeader
        title="Accueil"
        actions={
          <>
            <IconButton icon="search" label="Search words" onPress={() => router.push('/search')} />
            <IconButton
              icon="bell"
              label={data.unseenDaily ? "Today's word or sentence is waiting" : "Today's word and sentence"}
              badge={data.unseenDaily}
              onPress={() => router.push(daily && !daily.wordOpened ? `/daily/word?day=${daily.day}` : `/daily/sentence?day=${daily?.day ?? ''}`)}
            />
          </>
        }
      />
      <ContextRow level={level.estimate.label} unitText={`Unit ${unitIndex}/${path.units.length}`} onPress={() => router.push('/level')} />

      <Card accessibilityLabel={`Today's session, ${pct} percent complete. ${plan.remaining}`} testID="session-card">
        <Row gap={spacing.lg}>
          <ProgressRing value={plan.completion} accessibilityLabel={`Today's session, ${pct} percent complete`} />
          <View style={styles.flex}>
            <AppText variant="cardTitle">Today&apos;s session</AppText>
            <AppText variant="meta" tone="muted">
              {sessionDone ? 'Done for today. Bien joué !' : plan.remaining}
            </AppText>
            {streak.current > 0 ? (
              <AppText variant="meta" tone="secondary">
                {`${streak.current}-day streak${streak.restDays.length > 0 ? ` · ${streak.restDays.length} rest day${streak.restDays.length > 1 ? 's' : ''}` : ''}`}
              </AppText>
            ) : null}
          </View>
        </Row>
        <Button
          label={sessionDone ? 'Review the session' : pct > 0 ? 'Continue' : 'Start'}
          icon="play"
          onPress={() => router.push('/session')}
          style={styles.cta}
          variant={sessionDone ? 'secondary' : 'primary'}
          testID="start-session"
        />
      </Card>

      {daily?.word ? (
        <Card onPress={() => router.push(`/daily/word?day=${daily.day}`)} accessibilityLabel={`Word of the day: ${headword(daily.word)}, ${daily.word.en}`} testID="word-of-day">
          <Row style={styles.between}>
            <Pill label="MOT DU JOUR" color={colors.skills.vocabulary.tint} textColor={colors.skills.vocabulary.onTint} icon="sun" />
            <PlayButton audioKey={audioKey.word(daily.word.id)} text={headword(daily.word)} size={48} label="Play word" />
          </Row>
          <AppText variant="frenchLarge" french style={styles.mt}>
            {headword(daily.word)}
          </AppText>
          <Row gap={spacing.sm} style={styles.wrap}>
            <GenderTag gender={daily.word.gender} />
            <AppText variant="meta" tone="muted">
              {daily.word.pos}
            </AppText>
          </Row>
          <AppText variant="body" tone="secondary" style={styles.mt}>
            {daily.word.en}
          </AppText>
          <LinkText label="Test me" icon="arrow-right" onPress={() => router.push(`/daily/word?day=${daily.day}&test=1`)} />
        </Card>
      ) : null}

      {daily?.sentence ? (
        <Card onPress={() => router.push(`/daily/sentence?day=${daily.day}`)} accessibilityLabel={`Sentence of the day: ${daily.sentence.fr}`} testID="sentence-of-day">
          <Row style={styles.between}>
            <Pill label="PHRASE DU JOUR" color={colors.skills.unit.tint} textColor={colors.skills.unit.onTint} icon="message-circle" />
            <PlayButton audioKey={audioKey.sentence(daily.sentence.id)} text={daily.sentence.fr} size={48} label="Play sentence" />
          </Row>
          <AppText variant="french" french style={styles.mt}>
            {daily.sentence.fr}
          </AppText>
          <AppText variant="body" tone="secondary">
            {daily.sentence.en}
          </AppText>
          <AppText variant="meta" tone="muted">
            {daily.sentence.grammarNote}
          </AppText>
          <LinkText label="Test me" icon="arrow-right" onPress={() => router.push(`/daily/sentence?day=${daily.day}&test=1`)} />
        </Card>
      ) : null}

      <Card onPress={() => router.push('/weekly')} accessibilityLabel={`Activity: ${weekMinutes} minutes of study in the last 7 days. Opens the weekly summary.`}>
        <Row style={styles.between}>
          <View>
            <AppText variant="cardTitle">Activity</AppText>
            <AppText variant="meta" tone="muted">
              Last 7 days
            </AppText>
          </View>
          <View style={styles.alignEnd}>
            <AppText variant="title">{`${weekMinutes} min`}</AppText>
            <Pill label={`${activity.reduce((n, d) => n + d.reviews, 0)} reviews`} color={colors.primaryTint} textColor={colors.skills.structures.onTint} />
          </View>
        </Row>
        <View style={styles.mt}>
          <BarChart
            values={activity.map((d) => d.minutes)}
            labels={activity.map((d) => WEEKDAY[fromDayKey(d.day).getDay()])}
            accessibilityLabel={`Study minutes per day: ${activity.map((d) => `${d.minutes}`).join(', ')}`}
          />
        </View>
      </Card>

      {current ? (
        <Card padded={false} onPress={() => router.push(`/unit/${current.id}`)} accessibilityLabel={`Current unit: ${current.theme}. ${current.masteredWords} of ${current.coreWords} words mastered.`}>
          <LinearGradient colors={colors.unitGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.unitCard}>
            <AppText variant="label" color={colors.skills.unit.onBase}>
              {`UNIT ${current.order} · ${current.level}`}
            </AppText>
            <AppText variant="title" color={colors.skills.unit.onBase}>
              {current.titleFr}
            </AppText>
            <AppText variant="meta" color={colors.skills.unit.onBase}>
              {current.theme}
            </AppText>
            <View style={styles.mt}>
              <ProgressBar value={current.segmentsTotal > 0 ? current.segmentsDone / current.segmentsTotal : 0} color={colors.skills.structures.base} track="rgba(255,255,255,0.55)" />
            </View>
            <AppText variant="meta" color={colors.skills.unit.onBase}>
              {`${current.masteredWords}/${current.coreWords} words mastered · ${current.segmentsDone}/${current.segmentsTotal} lessons`}
            </AppText>
          </LinearGradient>
        </Card>
      ) : null}

      <Card onPress={() => router.push('/level')} accessibilityLabel={`Estimated level ${level.estimate.label}, practice estimate, ${Math.round(level.estimate.value * 100)} percent of the way from A2 to B1.`}>
        <AppText variant="cardTitle">Your level</AppText>
        <Row style={[styles.between, styles.mt]}>
          <AppText variant="bodyStrong">A2</AppText>
          <View style={styles.flex}>
            <ProgressBar value={level.estimate.value} />
          </View>
          <AppText variant="bodyStrong">B1</AppText>
        </Row>
        <AppText variant="meta" tone="muted" style={styles.mt}>
          {`Estimated: ${level.estimate.label} — a practice estimate, not an official TCF result.`}
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  cta: { marginTop: spacing.lg },
  between: { justifyContent: 'space-between' },
  mt: { marginTop: spacing.sm },
  wrap: { flexWrap: 'wrap', marginTop: spacing.xs },
  alignEnd: { alignItems: 'flex-end', gap: 4 },
  unitCard: { borderRadius: radii.lg, padding: spacing.xl, gap: 4 },
});

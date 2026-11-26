import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PlayButton } from '../../components/audio/AudioControls';
import { useTheme } from '../../components/theme/ThemeProvider';
import { radii, spacing } from '../../components/theme/tokens';
import { AppText } from '../../components/ui/AppText';
import { LinkText, Pill, Row } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PressableScale } from '../../components/ui/PressableScale';
import { ErrorState, Loading, Screen } from '../../components/ui/Screen';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { fromDayKey } from '../../domain/dates';
import type { Tense } from '../../domain/exercises/conjugation-tables';
import { conjugationTable, verbOfDay, verbQuiz } from '../../domain/verb-of-day';
import { useApp } from '../../features/app/AppContext';
import { useLoad } from '../../features/app/useLoad';
import { learnerFor } from '../../features/daily/daily-learner';
import { DailyTest } from '../../features/daily/DailyTest';
import { dayParam } from '../../features/daily/load-daily';

/** Verbe du jour: one verb, its six tenses, and a quick "type the form" check. */
export default function VerbOfTheDayScreen() {
  const app = useApp();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ day?: string; test?: string }>();
  const day = dayParam(params.day, app.today);
  const [testing, setTesting] = useState(params.test === '1');
  const [tense, setTense] = useState<Tense>('présent');
  const { data, error, reload } = useLoad(
    'daily verb',
    async () => {
      const { level } = await learnerFor(app.content, app.progress, app.settings.placementLevel);
      const verb = verbOfDay(day, level);
      return { verb, table: conjugationTable(verb), quiz: verbQuiz(verb, day, level) };
    },
    [day, app.settings.placementLevel],
  );

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const { verb, table, quiz } = data;
  const forms = table.find((t) => t.tense === tense)?.forms ?? [];
  const dateLabel = fromDayKey(day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const accent = colors.skills.structures;

  return (
    <Screen testID="verb-screen">
      <ScreenHeader title="Verbe du jour" subtitle={day === app.today ? 'Today' : dateLabel} back />
      <Card style={styles.card}>
        <Row style={styles.between}>
          <Pill label="VERBE DU JOUR" color={accent.tint} textColor={accent.onTint} icon="zap" />
          <PlayButton audioKey={`verb:${verb.infinitive}`} text={verb.infinitive} size={48} label="Play verb" />
        </Row>
        <AppText variant="frenchLarge" french>
          {verb.infinitive}
        </AppText>
        <AppText variant="body" tone="secondary">
          {verb.en}
        </AppText>
        <AppText variant="meta" tone="muted">
          {`${verb.level} · passé composé with ${verb.aux} · participe passé: ${verb.participle}`}
        </AppText>
      </Card>

      {testing ? (
        <Card style={styles.card}>
          <AppText variant="label" tone="muted">
            TEST ME
          </AppText>
          <DailyTest exercise={quiz} />
        </Card>
      ) : (
        <Button label="Test me" icon="check-square" onPress={() => setTesting(true)} testID="daily-test-start" />
      )}

      <View style={styles.tenses} accessibilityRole="tablist">
        {table.map(({ tense: t }) => {
          const active = t === tense;
          return (
            <PressableScale
              key={t}
              onPress={() => setTense(t)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tense, { backgroundColor: active ? accent.tint : colors.surface, borderColor: active ? accent.onTint : colors.border }]}
              testID={`tense-${t}`}
            >
              <AppText variant="meta" color={active ? accent.onTint : colors.text}>
                {t}
              </AppText>
            </PressableScale>
          );
        })}
      </View>

      <Card style={styles.card} accessibilityLabel={`${verb.infinitive}, ${tense}`}>
        <Row style={styles.between}>
          <AppText variant="cardTitle">{tense}</AppText>
          <PlayButton audioKey={`verb:${verb.infinitive}:${tense}`} text={forms.join('. ')} size={40} label={`Play ${tense}`} />
        </Row>
        {forms.map((form) => (
          <AppText key={form} variant="french" french>
            {form}
          </AppText>
        ))}
        {verb.aux === 'être' && tense === 'passé composé' ? (
          <AppText variant="meta" tone="muted">
            With être, the participle agrees with the subject: elle est {verb.participle}e, ils sont {verb.participle}s.
          </AppText>
        ) : null}
      </Card>

      <LinkText label={`Practise every tense of ${verb.infinitive}`} icon="zap" onPress={() => router.push({ pathname: '/verb-trainer', params: { verb: verb.infinitive } })} />
      <LinkText label="More verbs and tables" icon="grid" onPress={() => router.push({ pathname: '/conjugation', params: { verb: verb.infinitive } })} />
      <LinkText label="Word of the day" icon="arrow-right" onPress={() => router.replace(`/daily/word?day=${day}`)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  between: { justifyContent: 'space-between' },
  tenses: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tense: { minHeight: 44, borderRadius: radii.pill, borderWidth: 1.5, paddingHorizontal: spacing.md, justifyContent: 'center' },
});

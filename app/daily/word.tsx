import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '../../components/theme/ThemeProvider';
import { AppText } from '../../components/ui/AppText';
import { LinkText, Pill } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState, Loading, Screen } from '../../components/ui/Screen';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { WordCard } from '../../components/lesson/WordCard';
import { spacing } from '../../components/theme/tokens';
import { audioKey, headword } from '../../domain/audio-keys';
import { fromDayKey } from '../../domain/dates';
import { useApp } from '../../features/app/AppContext';
import { logError } from '../../features/app/log';
import { useLoad } from '../../features/app/useLoad';
import { useAutoPlay } from '../../features/audio/useAudio';
import { openDailyItem } from '../../features/daily/daily-service';
import { DailyTest } from '../../features/daily/DailyTest';
import { wordMeaningQuiz } from '../../features/daily/daily-tests';
import { dayParam, loadDaily } from '../../features/daily/load-daily';

/** Unit id from a word id such as "u03-w012". */
const unitOf = (wordId: string): string => wordId.split('-')[0];

export default function WordOfTheDayScreen() {
  const app = useApp();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ day?: string; test?: string }>();
  const day = dayParam(params.day, app.today);
  const [testing, setTesting] = useState(params.test === '1');
  const [answered, setAnswered] = useState(false);
  const { data, error, reload } = useLoad(
    'daily word',
    async () => {
      const daily = await loadDaily(app, day);
      if (!daily?.word) return { daily, quiz: null };
      const unitWords = await app.content.listKind('word', unitOf(daily.word.id));
      return { daily, quiz: wordMeaningQuiz(daily.word, unitWords, day) };
    },
    [day],
  );

  const word = data?.daily?.word ?? null;
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!word || opened.current === word.id) return;
    opened.current = word.id;
    openDailyItem(app.progress, day, 'word', word.id, Date.now())
      .then(app.invalidate)
      .catch((e: unknown) => logError('open daily word', e));
  }, [word, day, app.progress, app.invalidate]);
  useAutoPlay(word ? audioKey.word(word.id) : null, word ? headword(word) : null);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (!word) return <ErrorState message="There's no word for this day yet." />;
  const dateLabel = fromDayKey(day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Screen testID="word-screen">
      <ScreenHeader title="Mot du jour" subtitle={day === app.today ? 'Today' : dateLabel} back />
      <Card style={styles.card}>
        <Pill label="MOT DU JOUR" color={colors.skills.vocabulary.tint} textColor={colors.skills.vocabulary.onTint} icon="sun" />
        <WordCard word={word} hideMeaning={testing && !answered} />
        <AppText variant="meta" tone="muted" style={styles.mt}>
          Added to your reviews, so it will come back at the right time.
        </AppText>
      </Card>

      {testing && data.quiz ? (
        <Card style={styles.card}>
          <AppText variant="label" tone="muted">
            TEST ME
          </AppText>
          <DailyTest exercise={data.quiz} onAnswered={() => setAnswered(true)} />
        </Card>
      ) : data.quiz ? (
        <Button label="Test me" icon="check-square" onPress={() => setTesting(true)} testID="daily-test-start" />
      ) : null}

      {word ? (
        <LinkText label="Shadow it: listen, repeat, compare" icon="mic" onPress={() => router.push({ pathname: '/shadow', params: { kind: 'word', id: word.id } })} />
      ) : null}
      <LinkText label="Sentence of the day" icon="arrow-right" onPress={() => router.replace(`/daily/sentence?day=${day}`)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  mt: { marginTop: spacing.xs },
});

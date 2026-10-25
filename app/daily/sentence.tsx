import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AudioControls } from '../../components/audio/AudioControls';
import { useTheme } from '../../components/theme/ThemeProvider';
import { spacing } from '../../components/theme/tokens';
import { AppText } from '../../components/ui/AppText';
import { LevelPill, LinkText, ListRow, Pill, Row, SectionTitle } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState, Loading, Screen } from '../../components/ui/Screen';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { audioKey } from '../../domain/audio-keys';
import { GRAMMAR_TAG_LABELS } from '../../domain/content-types';
import { fromDayKey, type DayKey } from '../../domain/dates';
import { useApp } from '../../features/app/AppContext';
import { logError } from '../../features/app/log';
import { useLoad } from '../../features/app/useLoad';
import { useAutoPlay } from '../../features/audio/useAudio';
import { openDailyItem } from '../../features/daily/daily-service';
import { DailyTest } from '../../features/daily/DailyTest';
import { sentenceMeaningQuiz, sentenceReorderQuiz } from '../../features/daily/daily-tests';
import { dayParam, loadDaily, previousDays } from '../../features/daily/load-daily';

const formatDay = (day: DayKey): string => fromDayKey(day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

export default function SentenceOfTheDayScreen() {
  const app = useApp();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ day?: string; test?: string }>();
  const day = dayParam(params.day, app.today);
  const [testing, setTesting] = useState(params.test === '1');
  const [answered, setAnswered] = useState(false);
  const { data, error, reload } = useLoad(
    'daily sentence',
    async () => {
      const [daily, earlier] = await Promise.all([loadDaily(app, day), previousDays(app, app.today)]);
      const sentence = daily?.sentence ?? null;
      if (!sentence) return { sentence, quiz: null, earlier };
      const quiz = sentenceReorderQuiz(sentence) ?? sentenceMeaningQuiz(sentence, await app.content.listKind('sentence'), day);
      return { sentence, quiz, earlier };
    },
    [day, app.today],
  );

  const sentence = data?.sentence ?? null;
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!sentence || opened.current === sentence.id) return;
    opened.current = sentence.id;
    openDailyItem(app.progress, day, 'sentence', sentence.id, Date.now())
      .then(app.invalidate)
      .catch((e: unknown) => logError('open daily sentence', e));
  }, [sentence, day, app.progress, app.invalidate]);
  useAutoPlay(sentence ? audioKey.sentence(sentence.id) : null, sentence?.fr ?? null);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (!sentence) return <ErrorState message="There's no sentence for this day yet." />;

  return (
    <Screen testID="sentence-screen">
      <ScreenHeader title="Phrase du jour" subtitle={day === app.today ? 'Today' : formatDay(day)} back />
      <Card style={styles.card}>
        <Row style={styles.between}>
          <Pill label="PHRASE DU JOUR" color={colors.skills.unit.tint} textColor={colors.skills.unit.onTint} icon="message-circle" />
          <LevelPill level={sentence.level} />
        </Row>
        <AppText variant="frenchLarge" french>
          {sentence.fr}
        </AppText>
        <AppText variant="body" tone={testing && !answered ? 'muted' : 'secondary'}>
          {testing && !answered ? 'Translation hidden until you answer the test.' : sentence.en}
        </AppText>
        <AudioControls audioKey={audioKey.sentence(sentence.id)} text={sentence.fr} />
      </Card>

      <Card style={styles.card} accessibilityLabel={`Grammar point: ${GRAMMAR_TAG_LABELS[sentence.grammarTag]}. ${sentence.grammarNote}`}>
        <AppText variant="label" tone="muted">
          {`GRAMMAR · ${GRAMMAR_TAG_LABELS[sentence.grammarTag].toUpperCase()}`}
        </AppText>
        <AppText variant="body">{sentence.grammarNote}</AppText>
        <LinkText label="Grammar lessons on this point" icon="arrow-right" onPress={() => router.push(`/grammar?tag=${sentence.grammarTag}`)} />
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

      <LinkText label="Word of the day" icon="arrow-right" onPress={() => router.replace(`/daily/word?day=${day}`)} />

      {data.earlier.length > 0 ? (
        <>
          <SectionTitle title="Previous days" />
          <View style={styles.list}>
            {data.earlier.map((d) => (
              <ListRow
                key={d}
                skill="unit"
                icon="message-circle"
                category="Phrase du jour"
                title={formatDay(d)}
                onPress={() => router.push(`/daily/sentence?day=${d}`)}
                accessibilityLabel={`Sentence of the day for ${formatDay(d)}`}
              />
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  between: { justifyContent: 'space-between' },
  list: { gap: spacing.md },
});

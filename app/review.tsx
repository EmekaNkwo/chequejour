import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AudioControls } from '../components/audio/AudioControls';
import { WordCard } from '../components/lesson/WordCard';
import { QuizResult } from '../components/lesson/QuizResult';
import { useTheme } from '../components/theme/ThemeProvider';
import { radii, spacing } from '../components/theme/tokens';
import { AppText } from '../components/ui/AppText';
import { GenderTag, Row } from '../components/ui/Bits';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/Progress';
import { PressableScale } from '../components/ui/PressableScale';
import { ErrorState, Loading, Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { audioKey, headword } from '../domain/audio-keys';
import type { Sentence, VocabItem } from '../domain/content-types';
import { REVIEW_BUDGET } from '../domain/session';
import type { ReviewGrade, SrsCard } from '../domain/srs';
import { useApp } from '../features/app/AppContext';
import { logError } from '../features/app/log';
import { useLoad } from '../features/app/useLoad';
import { useAutoPlay } from '../features/audio/useAudio';
import { useStudyTimer } from '../features/progress/useStudyTimer';
import { gradeReview } from '../features/session/session-service';

type ReviewItem = { card: SrsCard } & ({ kind: 'word'; word: VocabItem } | { kind: 'sentence'; sentence: Sentence });

const GRADES: readonly { grade: ReviewGrade; label: string; hint: string }[] = [
  { grade: 'again', label: 'Again', hint: "I didn't remember" },
  { grade: 'hard', label: 'Hard', hint: 'I remembered with effort' },
  { grade: 'good', label: 'Good', hint: 'I remembered' },
  { grade: 'easy', label: 'Easy', hint: 'I knew it instantly' },
];

export default function ReviewScreen() {
  const { content, progress, settings } = useApp();
  const { data, error, reload } = useLoad(
    'review',
    async () => {
      const cards = await progress.dueCards(Date.now(), REVIEW_BUDGET[settings.dailyGoal]);
      const items = await Promise.all(
        cards.map(async (card): Promise<ReviewItem | null> => {
          if (card.itemKind === 'word') {
            const word = await content.item('word', card.itemId);
            return word ? { card, kind: 'word', word } : null;
          }
          const sentence = await content.item('sentence', card.itemId);
          return sentence ? { card, kind: 'sentence', sentence } : null;
        }),
      );
      return items.filter((x): x is ReviewItem => x !== null);
    },
    [settings.dailyGoal],
  );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (data.length === 0) {
    return (
      <Screen testID="review-screen">
        <ScreenHeader title="Reviews" back />
        <Card>
          <AppText variant="cardTitle">Nothing to review right now</AppText>
          <AppText variant="body" tone="secondary">
            Words and sentences come back here when they are due. Learn new words in a lesson to fill your queue.
          </AppText>
        </Card>
      </Screen>
    );
  }
  return <ReviewSession initialItems={data} />;
}

function ReviewSession({ initialItems }: { initialItems: readonly ReviewItem[] }) {
  useStudyTimer();
  // Fixed for the whole session: grading moves cards out of the due list, which must not reshuffle it.
  const [items] = useState(initialItems);
  const { progress, invalidate } = useApp();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const item = items[index];

  if (!item) {
    return (
      <QuizResult
        title="Reviews done"
        message={`You reviewed ${items.length} item${items.length === 1 ? '' : 's'}. They will come back when you are about to forget them.`}
        onPrimary={() => {
          invalidate();
          router.back();
        }}
        testID="review-done"
      />
    );
  }

  const grade = async (g: ReviewGrade, now: number) => {
    setSaving(true);
    try {
      await gradeReview(progress, item.card, g, now);
    } catch (e: unknown) {
      logError('grade review', e);
    } finally {
      setSaving(false);
      setRevealed(false);
      setIndex((i) => i + 1);
    }
  };

  return (
    <Screen
      testID="review-screen"
      footer={
        revealed ? (
          <View style={styles.grades}>
            {GRADES.map((g) => (
              <GradeButton key={g.grade} label={g.label} hint={g.hint} grade={g.grade} disabled={saving} onPress={() => void grade(g.grade, Date.now())} />
            ))}
          </View>
        ) : (
          <Button label="Show answer" onPress={() => setRevealed(true)} testID="review-show" />
        )
      }
    >
      <ScreenHeader title="Reviews" back />
      <View style={styles.progress}>
        <AppText variant="meta" tone="muted">{`${index + 1} of ${items.length}`}</AppText>
        <ProgressBar value={index / items.length} accessibilityLabel={`Review ${index + 1} of ${items.length}`} />
      </View>
      <ReviewCardView key={item.card.itemId} item={item} revealed={revealed} />
    </Screen>
  );
}

function ReviewCardView({ item, revealed }: { item: ReviewItem; revealed: boolean }) {
  const front = item.kind === 'word' ? headword(item.word) : item.sentence.fr;
  const key = item.kind === 'word' ? audioKey.word(item.word.id) : audioKey.sentence(item.sentence.id);
  useAutoPlay(key, front);

  if (revealed && item.kind === 'word') {
    return (
      <Card>
        <WordCard word={item.word} />
      </Card>
    );
  }
  return (
    <Card>
      <AppText variant="label" tone="muted">
        {item.kind === 'word' ? 'WORD' : 'SENTENCE'}
      </AppText>
      <AppText variant={item.kind === 'word' ? 'frenchLarge' : 'french'} french style={styles.front}>
        {front}
      </AppText>
      {item.kind === 'word' ? (
        <Row>
          <GenderTag gender={item.word.gender} />
        </Row>
      ) : null}
      <View style={styles.audio}>
        <AudioControls audioKey={key} text={front} />
      </View>
      {revealed && item.kind === 'sentence' ? (
        <View style={styles.answer}>
          <AppText variant="bodyStrong" tone="secondary">
            {item.sentence.en}
          </AppText>
          <AppText variant="meta" tone="muted">
            {item.sentence.grammarNote}
          </AppText>
        </View>
      ) : (
        <AppText variant="meta" tone="muted" style={styles.answer}>
          Say the meaning to yourself, then show the answer.
        </AppText>
      )}
    </Card>
  );
}

interface GradeButtonProps {
  label: string;
  hint: string;
  grade: ReviewGrade;
  disabled: boolean;
  onPress: () => void;
}

function GradeButton({ label, hint, grade, disabled, onPress }: GradeButtonProps) {
  const { colors } = useTheme();
  const bg = grade === 'again' ? colors.dangerTint : grade === 'good' ? colors.primary : colors.primaryTint;
  const fg = grade === 'again' ? colors.danger : grade === 'good' ? colors.onPrimary : colors.primary;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={`${label}: ${hint}`}
      accessibilityState={{ disabled }}
      style={[styles.grade, { backgroundColor: bg, opacity: disabled ? 0.6 : 1 }]}
      testID={`grade-${grade}`}
    >
      <AppText variant="bodyStrong" color={fg}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  progress: { gap: spacing.xs },
  front: { marginVertical: spacing.sm },
  audio: { marginTop: spacing.lg },
  answer: { marginTop: spacing.lg, gap: spacing.xs },
  grades: { flexDirection: 'row', gap: spacing.sm },
  grade: { flex: 1, minHeight: 52, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
});

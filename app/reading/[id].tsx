import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { ComprehensionQuiz, type ComprehensionAnswer } from '../../components/skills/ComprehensionQuiz';
import { SkillResult } from '../../components/skills/SkillResult';
import { useTheme } from '../../components/theme/ThemeProvider';
import { spacing } from '../../components/theme/tokens';
import { AppText } from '../../components/ui/AppText';
import { LevelPill, LinkText, Pill, Row } from '../../components/ui/Bits';
import { IconButton } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState, Loading, Screen } from '../../components/ui/Screen';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import type { ReadingItem } from '../../domain/content-types';
import { useApp } from '../../features/app/AppContext';
import { logError } from '../../features/app/log';
import { useLoad } from '../../features/app/useLoad';
import { useStudyTimer } from '../../features/progress/useStudyTimer';
import { findReading, unitIdOf } from '../../features/skills/skill-items';

const KIND_LABEL: Readonly<Record<ReadingItem['kind'], string>> = {
  message: 'Message',
  notice: 'Notice',
  email: 'Email',
  article: 'Article',
  advert: 'Advert',
  letter: 'Letter',
};

export default function ReadingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { content, progress } = useApp();
  const { data, error, reload } = useLoad(
    `reading ${id}`,
    async () => {
      const [item, done] = await Promise.all([findReading(content, id), progress.skillProgress()]);
      return { item, saved: done.get(id)?.saved ?? false };
    },
    [id],
  );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (!data.item) return <ErrorState message="This reading text couldn't be found." />;
  return <Reading item={data.item} initiallySaved={data.saved} />;
}

function Reading({ item, initiallySaved }: { item: ReadingItem; initiallySaved: boolean }) {
  useStudyTimer();
  const { colors } = useTheme();
  const { progress, invalidate } = useApp();
  const unitId = unitIdOf(item.id);
  const [saved, setSaved] = useState(initiallySaved);
  const [showTranslation, setShowTranslation] = useState(false);
  const [answers, setAnswers] = useState<ComprehensionAnswer[] | null>(null);
  const [attempt, setAttempt] = useState(0);

  const toggleSaved = () => {
    const next = !saved;
    setSaved(next);
    progress.setSaved(item.id, 'reading', unitId, next).catch((e: unknown) => logError('save item', e));
  };

  const finish = (result: ComprehensionAnswer[]) => {
    setAnswers(result);
    const score = result.length > 0 ? result.filter((a) => a.correct).length / result.length : null;
    progress
      .completeSkillItem(item.id, 'reading', unitId, score, Date.now())
      .then(invalidate)
      .catch((e: unknown) => logError('complete reading', e));
  };

  return (
    <Screen testID="reading-screen">
      <ScreenHeader
        title={item.title}
        back
        actions={
          <IconButton
            icon="bookmark"
            label={saved ? 'Remove from saved' : 'Save for later'}
            background={saved ? colors.skills.reading.tint : undefined}
            color={saved ? colors.skills.reading.onTint : undefined}
            onPress={toggleSaved}
            testID="toggle-saved"
          />
        }
      />
      <Row gap={spacing.sm}>
        <Pill label={KIND_LABEL[item.kind].toUpperCase()} color={colors.skills.reading.tint} textColor={colors.skills.reading.onTint} icon="book-open" />
        <LevelPill level={item.level} />
      </Row>

      <Card>
        <AppText variant="french" french style={styles.text}>
          {item.text}
        </AppText>
      </Card>

      <Card>
        <Row style={styles.between}>
          <AppText variant="cardTitle">Translation</AppText>
          <LinkText label={showTranslation ? 'Hide' : 'Show'} onPress={() => setShowTranslation((v) => !v)} />
        </Row>
        {showTranslation ? (
          <AppText variant="body" tone="secondary">
            {item.translation}
          </AppText>
        ) : (
          <AppText variant="meta" tone="muted">
            Try the questions first — then check the translation.
          </AppText>
        )}
      </Card>

      {answers ? (
        <SkillResult
          answers={answers}
          onRetry={() => {
            setAnswers(null);
            setAttempt((n) => n + 1);
          }}
        />
      ) : (
        <Card>
          <ComprehensionQuiz key={attempt} questions={item.questions} skill="reading" level={item.level} unitId={unitId} context="practice" onFinish={finish} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  text: { lineHeight: 30 },
  between: { justifyContent: 'space-between' },
});

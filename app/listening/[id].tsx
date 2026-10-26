import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AudioControls } from '../../components/audio/AudioControls';
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
import { audioKey, listeningScript } from '../../domain/audio-keys';
import type { ListeningItem } from '../../domain/content-types';
import { useApp } from '../../features/app/AppContext';
import { logError } from '../../features/app/log';
import { useLoad } from '../../features/app/useLoad';
import { usePlayback } from '../../features/audio/useAudio';
import { useStudyTimer } from '../../features/progress/useStudyTimer';
import { findListening, unitIdOf } from '../../features/skills/skill-items';

const KIND_LABEL: Readonly<Record<ListeningItem['kind'], string>> = {
  dialogue: 'Dialogue',
  announcement: 'Announcement',
  message: 'Voice message',
  interview: 'Interview',
};

/** Played share is saved in steps so the progress line moves without a write per tick. */
const PLAYED_STEP = 0.1;

export default function ListeningScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { content, progress } = useApp();
  const { data, error, reload } = useLoad(
    `listening ${id}`,
    async () => {
      const [item, done] = await Promise.all([findListening(content, id), progress.skillProgress()]);
      return { item, saved: done.get(id)?.saved ?? false };
    },
    [id],
  );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (!data.item) return <ErrorState message="This listening item couldn't be found." />;
  return <Listening item={data.item} initiallySaved={data.saved} />;
}

function Listening({ item, initiallySaved }: { item: ListeningItem; initiallySaved: boolean }) {
  useStudyTimer();
  const { colors } = useTheme();
  const { progress, invalidate } = useApp();
  const playback = usePlayback();
  const unitId = unitIdOf(item.id);
  const key = audioKey.listening(item.id);
  const [saved, setSaved] = useState(initiallySaved);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [answers, setAnswers] = useState<ComprehensionAnswer[] | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lastSaved = useRef(0);

  useEffect(() => {
    if (playback.key !== key) return;
    const stepped = Math.floor(playback.progress / PLAYED_STEP) * PLAYED_STEP;
    if (stepped <= lastSaved.current) return;
    lastSaved.current = stepped;
    progress.setPlayedFraction(item.id, 'listening', unitId, playback.progress >= 0.98 ? 1 : stepped).catch((e: unknown) => logError('played fraction', e));
  }, [playback.key, playback.progress, key, item.id, unitId, progress]);

  const toggleSaved = () => {
    const next = !saved;
    setSaved(next);
    progress.setSaved(item.id, 'listening', unitId, next).catch((e: unknown) => logError('save item', e));
  };

  const finish = (result: ComprehensionAnswer[]) => {
    setAnswers(result);
    const score = result.length > 0 ? result.filter((a) => a.correct).length / result.length : null;
    progress
      .completeSkillItem(item.id, 'listening', unitId, score, Date.now())
      .then(invalidate)
      .catch((e: unknown) => logError('complete listening', e));
  };

  return (
    <Screen testID="listening-screen">
      <ScreenHeader
        title={item.title}
        back
        actions={<IconButton icon="bookmark" label={saved ? 'Remove from saved' : 'Save for later'} background={saved ? colors.skills.listening.tint : undefined} color={saved ? colors.skills.listening.onTint : undefined} onPress={toggleSaved} testID="toggle-saved" />}
      />
      <Row gap={spacing.sm}>
        <Pill label={KIND_LABEL[item.kind].toUpperCase()} color={colors.skills.listening.tint} textColor={colors.skills.listening.onTint} icon="headphones" />
        <LevelPill level={item.level} />
      </Row>

      <Card>
        <AppText variant="body" tone="secondary">
          {item.context}
        </AppText>
        <View style={styles.audio}>
          <AudioControls audioKey={key} text={listeningScript(item.lines)} />
        </View>
        <AppText variant="meta" tone="muted" center>
          Listen as many times as you like, then answer the questions.
        </AppText>
        {item.id.startsWith('u') ? (
          <View style={styles.shadow}>
            <LinkText label="Shadow this text line by line" icon="mic" onPress={() => router.push({ pathname: '/shadow', params: { kind: 'listening', id: item.id } })} />
          </View>
        ) : null}
      </Card>

      <Card>
        <Row style={styles.between}>
          <AppText variant="cardTitle">Transcript</AppText>
          <LinkText label={showTranscript ? 'Hide' : 'Show'} onPress={() => setShowTranscript((v) => !v)} />
        </Row>
        {showTranscript
          ? item.lines.map((line, i) => (
              <View key={`${i}-${line.speaker}`} style={styles.line}>
                <AppText variant="label" tone="muted">
                  {line.speaker.toUpperCase()}
                </AppText>
                <AppText variant="french" french>
                  {line.fr}
                </AppText>
              </View>
            ))
          : null}
        <Row style={[styles.between, styles.mt]}>
          <AppText variant="cardTitle">Translation</AppText>
          <LinkText label={showTranslation ? 'Hide' : 'Show'} onPress={() => setShowTranslation((v) => !v)} />
        </Row>
        {showTranslation ? (
          <AppText variant="body" tone="secondary">
            {item.translation}
          </AppText>
        ) : null}
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
          <ComprehensionQuiz key={attempt} questions={item.questions} skill="listening" level={item.level} unitId={unitId} context="practice" onFinish={finish} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  shadow: { alignItems: 'center', marginTop: spacing.sm },
  audio: { marginVertical: spacing.xl },
  between: { justifyContent: 'space-between' },
  line: { marginTop: spacing.md, gap: 2 },
  mt: { marginTop: spacing.md },
});

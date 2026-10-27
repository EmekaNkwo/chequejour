import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AiPanel } from '../../components/ai/AiPanel';
import { SpeakingAiFeedback } from '../../components/ai/SpeakingAiFeedback';
import { AnswerInput } from '../../components/exercises/inputs';
import { useTheme } from '../../components/theme/ThemeProvider';
import { radii, spacing } from '../../components/theme/tokens';
import { AppText } from '../../components/ui/AppText';
import { LevelPill, Row } from '../../components/ui/Bits';
import { Button, IconButton } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState, Loading, Screen } from '../../components/ui/Screen';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { conversationMessages, learnerSide, MAX_LEARNER_TURNS, openingLine, type ConversationTask } from '../../domain/ai/conversation';
import { aiFailureMessage } from '../../domain/ai/errors';
import type { SpeakingTask } from '../../domain/content-types';
import { useAiFeature } from '../../features/ai/useAiFeature';
import { useWarmLlm } from '../../features/ai/useWarmLlm';
import { useConversation, type ConversationModels } from '../../features/ai/useConversation';
import { useApp } from '../../features/app/AppContext';
import { useLoad } from '../../features/app/useLoad';
import { useStudyTimer } from '../../features/progress/useStudyTimer';
import { findSpeaking } from '../../features/skills/skill-items';
import { useFrenchSpeech } from '../../features/speech/useFrenchSpeech';
import { FrenchSpeechSetup } from '../../components/speaking/FrenchSpeechSetup';

const isConversationTask = (t: SpeakingTask): t is SpeakingTask & ConversationTask => t.taskType === 'interaction' || t.taskType === 'opinion';

/** Practising speaking task 2 or 3 with the AI partner. */
export default function ConversationScreen() {
  const { id, mock } = useLocalSearchParams<{ id: string; mock?: string }>();
  const { content } = useApp();
  const { ready, llm } = useAiFeature('conversation');
  const { data, error, reload } = useLoad(`conversation ${id}`, async () => ({ task: await findSpeaking(content, id, mock) }), [id, mock]);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (!data.task || !isConversationTask(data.task)) return <ErrorState message="This task has no conversation practice." />;
  if (!ready || !llm) {
    return <ErrorState message="The conversation partner needs the AI pack with its language model, and the feature turned on in Settings → AI pack." />;
  }
  return <Chat task={data.task} models={{ llm }} />;
}

function Chat({ task, models }: { task: SpeakingTask & ConversationTask; models: ConversationModels }) {
  useStudyTimer();
  const { colors } = useTheme();
  const chat = useConversation(task, models);
  const speech = useFrenchSpeech();
  // The partner's instructions (with its opening line) are read while the learner reads the task.
  useWarmLlm(models.llm, conversationMessages(task, [{ role: 'partner', text: openingLine(task) }]));
  const [typed, setTyped] = useState('');
  const learnerTurns = chat.turns.filter((t) => t.role === 'learner').length;
  const busy = chat.phase === 'transcribing' || chat.phase === 'replying';

  const send = () => {
    chat.say(typed);
    setTyped('');
  };

  return (
    <Screen testID="conversation-screen">
      <ScreenHeader title="Conversation practice" subtitle={task.title} back />
      <Card>
        <Row gap={spacing.sm}>
          <LevelPill level={task.level} />
          <AppText variant="meta" tone="muted" style={styles.flex}>{`${task.taskType === 'interaction' ? 'Task 2 · role-play' : 'Task 3 · opinion'} · ${learnerTurns} of ${MAX_LEARNER_TURNS} turns`}</AppText>
        </Row>
        <AppText variant="french" french>
          {task.promptFr}
        </AppText>
        <AppText variant="meta" tone="muted">
          The partner is an AI on your phone. It can make mistakes; nothing you say is saved or uploaded.
        </AppText>
      </Card>

      {chat.turns.map((t, i) => (
        <View
          key={`${i}-${t.role}`}
          style={[styles.bubble, t.role === 'learner' ? [styles.mine, { backgroundColor: colors.skills.speaking.tint }] : { backgroundColor: colors.surfaceRaised }]}
          testID={`turn-${i}`}
        >
          <AppText variant="french" french color={t.role === 'learner' ? colors.skills.speaking.onTint : undefined} style={styles.shrink}>
            {t.text}
          </AppText>
          {t.role === 'partner' ? <IconButton icon="volume-2" label="Listen again" onPress={() => chat.replay(i)} size={36} /> : null}
        </View>
      ))}

      <AiPanel title="Partner" state={chat.phase === 'replying' ? { status: 'working', partial: chat.partial } : { status: 'idle' }} workingText={chat.partial || 'Thinking…'}>
        {() => null}
      </AiPanel>
      {chat.phase === 'transcribing' ? (
        <AppText variant="meta" tone="muted">
          Listening to what you said…
        </AppText>
      ) : null}
      {chat.failure ? (
        <AppText variant="meta" tone="danger">{`${aiFailureMessage(chat.failure)} Say it again or type it.`}</AppText>
      ) : null}
      {chat.heardNothing ? (
        <AppText variant="meta" tone="muted">
          Nothing was recognised. Try again a little closer to the microphone, or type.
        </AppText>
      ) : null}

      {chat.phase !== 'ended' ? <FrenchSpeechSetup speech={speech} purpose="To answer by voice, your phone needs to recognise French." /> : null}

      {chat.phase === 'ended' ? (
        <Card testID="conversation-ended">
          <AppText variant="cardTitle">Conversation finished</AppText>
          <SpeakingAiFeedback
            input={{ taskType: task.taskType, level: task.level, promptFr: task.promptFr, transcript: learnerSide(chat.turns), durationMs: 0 }}
          />
        </Card>
      ) : (
        <Card>
          {speech.ready ? (
            <Button
              label={chat.phase === 'recording' ? 'Stop and send' : 'Tap to speak'}
              icon={chat.phase === 'recording' ? 'square' : 'mic'}
              onPress={() => void (chat.phase === 'recording' ? chat.stopTalking() : chat.startTalking())}
              disabled={busy}
              testID="conversation-talk"
            />
          ) : null}
          {chat.micAllowed === false ? (
            <AppText variant="meta" tone="muted">
              Microphone access is off. You can type your answers instead.
            </AppText>
          ) : null}
          <AnswerInput value={typed} onChange={setTyped} onSubmit={send} placeholder={speech.ready ? '…or type in French' : 'Type your answer in French'} accessibilityLabel="Your answer in French" editable={!busy && chat.phase !== 'recording'} testID="conversation-input" />
          <Button label="Send" icon="send" variant="secondary" onPress={send} disabled={busy || typed.trim().length === 0} testID="conversation-send" />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bubble: { borderRadius: radii.lg, padding: spacing.md, maxWidth: '88%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mine: { alignSelf: 'flex-end' },
  shrink: { flexShrink: 1 },
});

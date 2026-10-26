/**
 * What the on-device speech model heard in the learner's latest take. With a target line
 * (shadowing) it compares word by word; without one (speaking tasks) it shows the text
 * and the speaking pace. Always labelled as a hint, never as a score.
 */
import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { aiFailureMessage } from '../../domain/ai/errors';
import { speechPace } from '../../domain/ai/transcript';
import type { Transcript } from '../../features/ai/useSpeechAi';
import { heardMatch } from '../../features/speech/offline-french';
import { DictationDiff } from '../exercises/DictationDiff';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { Row } from '../ui/Bits';
import { Card } from '../ui/Card';

export interface TranscriptCardProps {
  transcript: Transcript;
  /** The line the learner was repeating, if any. */
  target?: string;
  durationMs: number;
  /** Shown under a finished, non-empty transcript (e.g. AI coaching). */
  children?: ReactNode;
}

export function TranscriptCard({ transcript, target, durationMs, children }: TranscriptCardProps) {
  const { colors } = useTheme();
  return (
    <Card testID="ai-transcript">
      <Row gap={spacing.sm}>
        <Feather name="cpu" size={16} color={colors.textMuted} />
        <AppText variant="bodyStrong" style={styles.flex}>
          What the AI heard
        </AppText>
      </Row>
      {transcript.status === 'working' ? (
        <Row gap={spacing.sm}>
          <ActivityIndicator color={colors.textMuted} />
          <AppText variant="meta" tone="muted">
            Listening to your recording on this phone…
          </AppText>
        </Row>
      ) : transcript.status === 'failed' ? (
        <AppText variant="meta" tone="muted">
          {aiFailureMessage(transcript.failure)}
        </AppText>
      ) : transcript.text === '' ? (
        <AppText variant="body" tone="secondary">
          No speech was recognised. Try again a little closer to the microphone.
        </AppText>
      ) : (
        <>
          <Heard text={transcript.text} target={target} durationMs={durationMs} />
          {children}
        </>
      )}
      <AppText variant="meta" tone="muted">
        AI suggestion, recognised on this phone only. It can mishear; it is not a pronunciation score.
      </AppText>
    </Card>
  );
}

function Heard({ text, target, durationMs }: { text: string; target?: string; durationMs: number }) {
  if (target) {
    const match = heardMatch(target, text);
    return (
      <View style={styles.gap}>
        <AppText variant="bodyStrong">{`It heard ${match.matched} of ${match.total} words`}</AppText>
        <DictationDiff expected={target} typed={text} />
        <AppText variant="french" french tone="secondary">{`“${text}”`}</AppText>
      </View>
    );
  }
  const pace = speechPace(text, durationMs);
  return (
    <View style={styles.gap}>
      <AppText variant="french" french>
        {text}
      </AppText>
      <AppText variant="meta" tone="muted">
        {`${pace.words} ${pace.words === 1 ? 'word' : 'words'}${pace.wordsPerMinute !== null ? ` · about ${pace.wordsPerMinute} words a minute` : ''}`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: spacing.sm },
});

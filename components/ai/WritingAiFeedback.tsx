/** "Get AI feedback" after handing in a text: checked corrections, strengths and one next step. */
import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import type { CheckedWritingFeedback, WritingFeedbackInput } from '../../domain/ai/writing-feedback';
import { useAiFeature } from '../../features/ai/useAiFeature';
import { useAiJob } from '../../features/ai/useAiJob';
import { writingFeedback } from '../../features/ai/writing-feedback';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { Row } from '../ui/Bits';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { AiPanel } from './AiPanel';

export function WritingAiFeedback({ input }: { input: WritingFeedbackInput }) {
  const { ready, llm } = useAiFeature('writing');
  const job = useAiJob<CheckedWritingFeedback>('writing feedback');
  if (!ready || !llm || input.text.trim().length === 0) return null;
  const ask = () => job.run((signal) => writingFeedback(llm, input, signal));
  const idle = job.state.status === 'idle' || job.state.status === 'failed';
  return (
    <Card testID="ai-writing-card">
      <AppText variant="cardTitle">AI feedback</AppText>
      {idle ? (
        <>
          <AppText variant="meta" tone="muted">
            The AI on your phone reads your text and points out a few mistakes. It takes a minute or two.
          </AppText>
          <Button label={job.state.status === 'failed' ? 'Try again' : 'Get AI feedback'} icon="cpu" variant="secondary" onPress={ask} testID="ai-writing-ask" />
        </>
      ) : null}
      <AiPanel title="Feedback" state={job.state} workingText="Reading your text on this phone… this can take a minute or two." onCancel={job.cancel} testID="ai-writing">
        {(value) => <FeedbackView value={value} />}
      </AiPanel>
    </Card>
  );
}

/** Never "no mistakes": the AI doesn't decide that, and its corrections may have been held back. */
function noCorrectionsText(heldBack: number): string {
  return heldBack > 0
    ? 'The AI’s corrections didn’t pass the app’s checks, so none are shown. Check the hints above.'
    : 'The AI didn’t point out any mistakes. That doesn’t mean there are none: check the hints above too.';
}

function FeedbackView({ value }: { value: CheckedWritingFeedback }) {
  const { colors } = useTheme();
  return (
    <View style={styles.gap}>
      {value.corrections.length === 0 ? (
        <AppText variant="body">{noCorrectionsText(value.heldBack)}</AppText>
      ) : (
        value.corrections.map((c) => (
          <View key={`${c.original}→${c.corrected}`} style={styles.item} accessible accessibilityLabel={`${c.original}, better: ${c.corrected}. ${c.why}`}>
            <AppText variant="french" french tone="danger" style={styles.strike}>
              {c.original}
            </AppText>
            <AppText variant="french" french tone="success">
              {c.corrected}
            </AppText>
            <AppText variant="meta" tone="secondary">
              {c.why}
            </AppText>
          </View>
        ))
      )}
      {value.strengths.map((s) => (
        <Row key={s} gap={spacing.sm} style={styles.top}>
          <Feather name="check" size={16} color={colors.success} />
          <AppText variant="body" tone="secondary" style={styles.flex}>
            {s}
          </AppText>
        </Row>
      ))}
      <Row gap={spacing.sm} style={styles.top}>
        <Feather name="arrow-right" size={16} color={colors.textMuted} />
        <AppText variant="body" style={styles.flex}>{`Next time: ${value.nextStep}`}</AppText>
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.md },
  item: { gap: 2 },
  strike: { textDecorationLine: 'line-through' },
  top: { alignItems: 'flex-start' },
  flex: { flex: 1 },
});

/**
 * AI feedback after handing in a text: checked corrections, each explained by the app, and
 * one next step. It starts on its own when the text is handed in, so it is often ready by the
 * time the learner has read the hints, and shows fixes sentence by sentence as the AI writes.
 */
import { Feather } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { partialWritingCorrections, writingFeedbackMessages, type CheckedWritingFeedback, type WritingCorrection, type WritingFeedbackInput } from '../../domain/ai/writing-feedback';
import { useAiFeature } from '../../features/ai/useAiFeature';
import { useWarmLlm } from '../../features/ai/useWarmLlm';
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
  const shown = ready && llm !== null && input.text.trim().length > 0;
  useWarmLlm(shown ? llm : null, writingFeedbackMessages(input));
  const job = useAiJob<CheckedWritingFeedback>('writing feedback');
  const ask = () => {
    if (llm) job.run((signal, onText) => writingFeedback(llm, input, signal, onText));
  };
  useEffect(() => {
    if (shown) ask();
    // Once per handed-in text; a new text remounts or changes `input.text`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, llm?.id, input.text]);
  if (!shown || !llm) return null;
  const idle = job.state.status === 'idle' || job.state.status === 'failed';
  return (
    <Card testID="ai-writing-card">
      <AppText variant="cardTitle">AI feedback</AppText>
      {idle ? (
        <>
          <AppText variant="meta" tone="muted">
            The AI on your phone corrects your text; the app shows each change with what kind of mistake it fixes.
          </AppText>
          <Button label={job.state.status === 'failed' ? 'Try again' : 'Get AI feedback'} icon="cpu" variant="secondary" onPress={ask} testID="ai-writing-ask" />
        </>
      ) : null}
      <AiPanel
        title="Feedback"
        state={job.state}
        workingText="Reading your text on this phone… fixes appear sentence by sentence."
        onCancel={job.cancel}
        renderPartial={(soFar) => <Corrections items={partialWritingCorrections(soFar, input)} />}
        testID="ai-writing"
      >
        {(value) => <FeedbackView value={value} />}
      </AiPanel>
    </Card>
  );
}

/** Loads the model and reads the fixed part of the prompt while the learner writes, so feedback starts at once on hand-in. */
export function useWarmWritingFeedback(input: WritingFeedbackInput): void {
  const { ready, llm } = useAiFeature('writing');
  useWarmLlm(ready ? llm : null, writingFeedbackMessages(input));
}

/** Never "no mistakes": the AI doesn't decide that, and its corrections may have been held back. */
function noCorrectionsText(heldBack: number): string {
  return heldBack > 0
    ? 'The AI changed some words, but not in a way the app could explain, so nothing is shown. Check the hints above.'
    : 'The AI didn’t point out any mistakes. That doesn’t mean there are none: check the hints above too.';
}

function Corrections({ items }: { items: readonly WritingCorrection[] }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.gap}>
      {items.map((c) => (
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
      ))}
    </View>
  );
}

function FeedbackView({ value }: { value: CheckedWritingFeedback }) {
  const { colors } = useTheme();
  return (
    <View style={styles.gap}>
      {value.corrections.length === 0 ? <AppText variant="body">{noCorrectionsText(value.heldBack)}</AppText> : <Corrections items={value.corrections} />}
      {value.nextStep ? (
        <Row gap={spacing.sm} style={styles.top}>
          <Feather name="arrow-right" size={16} color={colors.textMuted} />
          <AppText variant="body" style={styles.flex}>{`Next time: ${value.nextStep}`}</AppText>
        </Row>
      ) : null}
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

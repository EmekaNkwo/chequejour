/** Coaching on a speaking take, from its transcript: task fit, a few slips, phrases to try, a next step. */
import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { speakingFeedbackMessages, type CheckedSpeakingFeedback, type SpeakingFeedbackInput } from '../../domain/ai/speaking-feedback';
import { speakingFeedback } from '../../features/ai/speaking-feedback';
import { useAiFeature } from '../../features/ai/useAiFeature';
import { useWarmLlm } from '../../features/ai/useWarmLlm';
import { useAiJob } from '../../features/ai/useAiJob';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { Row } from '../ui/Bits';
import { Button } from '../ui/Button';
import { AiPanel } from './AiPanel';

/** Too few words for useful coaching. */
const MIN_WORDS = 8;

export function SpeakingAiFeedback({ input }: { input: SpeakingFeedbackInput }) {
  const { llm } = useAiFeature('speaking');
  const shown = llm !== null && input.transcript.trim().split(/\s+/).length >= MIN_WORDS;
  useWarmLlm(shown ? llm : null, speakingFeedbackMessages(input));
  const job = useAiJob<CheckedSpeakingFeedback>('speaking feedback');
  if (!shown || !llm) return null;
  const ask = () => job.run((signal) => speakingFeedback(llm, input, signal));
  const idle = job.state.status === 'idle' || job.state.status === 'failed';
  return (
    <View style={styles.gap} testID="ai-speaking-card">
      {idle ? <Button label={job.state.status === 'failed' ? 'Try the coaching again' : 'Get AI coaching on this take'} icon="cpu" variant="secondary" onPress={ask} testID="ai-speaking-ask" /> : null}
      <AiPanel title="Coaching" state={job.state} workingText="Listening back on this phone… this can take a minute." onCancel={job.cancel} testID="ai-speaking">
        {(value) => <CoachingView value={value} />}
      </AiPanel>
    </View>
  );
}

function CoachingView({ value }: { value: CheckedSpeakingFeedback }) {
  const { colors } = useTheme();
  return (
    <View style={styles.gap}>
      <AppText variant="body">{value.task}</AppText>
      {value.corrections.map((c) => (
        <View key={`${c.original}→${c.corrected}`} style={styles.item}>
          <AppText variant="french" french tone="danger" style={styles.strike}>
            {c.original}
          </AppText>
          <AppText variant="french" french tone="success">
            {c.corrected}
          </AppText>
          {c.why ? (
            <AppText variant="meta" tone="secondary">
              {c.why}
            </AppText>
          ) : null}
        </View>
      ))}
      {value.phrases.length > 0 ? (
        <View style={styles.item}>
          <AppText variant="label" tone="muted">
            PHRASES TO TRY
          </AppText>
          {value.phrases.map((p) => (
            <AppText key={p.fr} variant="body">
              <AppText variant="bodyStrong" french>
                {p.fr}
              </AppText>
              {` — ${p.en}`}
            </AppText>
          ))}
        </View>
      ) : null}
      <Row gap={spacing.sm} style={styles.top}>
        <Feather name="arrow-right" size={16} color={colors.textMuted} />
        <AppText variant="body" style={styles.flex}>{`Next take: ${value.nextStep}`}</AppText>
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

/** "Explain with AI" under a mistake: a short explanation and one new example. */
import { View } from 'react-native';
import type { ExplainInput, Explanation } from '../../domain/ai/explain';
import { explainMistake } from '../../features/ai/explain-mistake';
import { useAiFeature } from '../../features/ai/useAiFeature';
import { useAiJob } from '../../features/ai/useAiJob';
import { AppText } from '../ui/AppText';
import { LinkText } from '../ui/Bits';
import { AiPanel } from './AiPanel';

export function ExplainMistake({ mistake }: { mistake: ExplainInput }) {
  const { ready, llm } = useAiFeature('explain');
  const job = useAiJob<Explanation>('explain mistake');
  if (!ready || !llm) return null;
  const ask = () => job.run((signal) => explainMistake(llm, mistake, signal));
  return (
    <View>
      {job.state.status === 'idle' || job.state.status === 'failed' ? (
        <LinkText label={job.state.status === 'failed' ? 'Try the AI explanation again' : 'Explain with AI'} icon="cpu" onPress={ask} />
      ) : null}
      <AiPanel title="Why" state={job.state} workingText="Writing an explanation on this phone…" onCancel={job.cancel} testID="ai-explain">
        {(value) => (
          <>
            <AppText variant="body">{value.explanation}</AppText>
            <AppText variant="french" french>{`Example: ${value.example}`}</AppText>
          </>
        )}
      </AiPanel>
    </View>
  );
}

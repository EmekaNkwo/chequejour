/** AI-made examples for a word (experimental, off by default), with optional fill-the-gap practice. */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { gapSentence, type ExampleWord, type WordExample } from '../../domain/ai/word-examples';
import { useAiFeature } from '../../features/ai/useAiFeature';
import { useAiJob } from '../../features/ai/useAiJob';
import { wordExamples } from '../../features/ai/word-examples';
import { PlayButton } from '../audio/AudioControls';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { LinkText, Row } from '../ui/Bits';
import { Card } from '../ui/Card';
import { AiPanel } from './AiPanel';

export function WordExamples({ word, wordId }: { word: ExampleWord; wordId: string }) {
  const { ready, llm } = useAiFeature('generatedPractice');
  const job = useAiJob<WordExample[]>('word examples');
  const [practising, setPractising] = useState(false);
  if (!ready || !llm) return null;
  const ask = () => {
    setPractising(false);
    job.run((signal) => wordExamples(llm, word, signal));
  };
  return (
    <Card testID="ai-word-examples">
      <Row style={styles.between}>
        <AppText variant="cardTitle">More examples</AppText>
        {job.state.status === 'done' ? <LinkText label={practising ? 'Show all' : 'Practise'} icon={practising ? 'eye' : 'edit-3'} onPress={() => setPractising((p) => !p)} /> : null}
      </Row>
      {job.state.status === 'idle' || job.state.status === 'failed' ? (
        <LinkText label={job.state.status === 'failed' ? 'Try again' : 'Write new examples with AI'} icon="cpu" onPress={ask} />
      ) : null}
      <AiPanel title="Examples" state={job.state} workingText="Writing examples on this phone…" onCancel={job.cancel} testID="ai-word-examples-panel">
        {(examples) => (
          <View style={styles.list}>
            {examples.map((e, i) =>
              practising ? <GapItem key={e.fr} example={e} /> : <ExampleItem key={e.fr} example={e} audioKey={`ai-example-${wordId}-${i}`} />,
            )}
            {job.state.status === 'done' ? <LinkText label="New examples" icon="refresh-cw" onPress={ask} /> : null}
          </View>
        )}
      </AiPanel>
    </Card>
  );
}

function ExampleItem({ example, audioKey }: { example: WordExample; audioKey: string }) {
  return (
    <Row gap={spacing.sm} style={styles.top}>
      <PlayButton audioKey={audioKey} text={example.fr} size={36} label="Play example" />
      <View style={styles.flex}>
        <AppText variant="french" french>
          {example.fr}
        </AppText>
        <AppText variant="meta" tone="secondary">
          {example.en}
        </AppText>
      </View>
    </Row>
  );
}

function GapItem({ example }: { example: WordExample }) {
  const [shown, setShown] = useState(false);
  return (
    <View style={styles.gap}>
      <AppText variant="french" french>
        {shown ? example.fr : gapSentence(example.fr, example.form, example.start)}
      </AppText>
      <AppText variant="meta" tone="secondary">
        {example.en}
      </AppText>
      {shown ? null : <LinkText label="Show the answer" onPress={() => setShown(true)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between' },
  list: { gap: spacing.md },
  top: { alignItems: 'flex-start' },
  flex: { flex: 1 },
  gap: { gap: 2 },
});

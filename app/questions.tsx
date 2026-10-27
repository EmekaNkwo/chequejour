import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { QuizRunner, type QuizScore } from '../components/exercises/QuizRunner';
import { QuizResult } from '../components/lesson/QuizResult';
import { spacing } from '../components/theme/tokens';
import { AppText } from '../components/ui/AppText';
import { Row } from '../components/ui/Bits';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorState, Loading, Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import type { Exercise } from '../domain/content-types';
import { seededShuffle } from '../domain/shuffle';
import { useApp } from '../features/app/AppContext';
import { useLoad } from '../features/app/useLoad';
import { useStudyTimer } from '../features/progress/useStudyTimer';

const SESSION_SIZE = 10;

const WAYS: readonly { name: string; example: string; note: string }[] = [
  { name: 'Intonation', example: 'Vous habitez ici ?', note: 'Spoken and informal: your voice rises at the end.' },
  { name: 'Est-ce que', example: 'Où est-ce que vous habitez ?', note: 'Neutral and safe: question word + est-ce que + normal order.' },
  { name: 'Inversion', example: 'Où habitez-vous ?', note: 'Formal, good with the examiner: verb-pronoun with a hyphen.' },
];

const WORDS: readonly [string, string][] = [
  ['où', 'where'],
  ['quand', 'when'],
  ['à quelle heure', 'what time'],
  ['combien (de)', 'how much / how many'],
  ['pourquoi', 'why'],
  ['comment', 'how'],
  ['quel, quelle, quels, quelles', 'which / what'],
  ['qui', 'who'],
  ["qu'est-ce que / que", 'what'],
];

/** Question-forming drills for speaking task 2, where you ask the examiner for information. */
export default function QuestionDrillsScreen() {
  const { content, today } = useApp();
  const [round, setRound] = useState(0);
  const [running, setRunning] = useState(false);
  const { data, error, reload } = useLoad(
    'question drills',
    async () => {
      const all = await content.listKind('exercise');
      return all.filter((e) => e.grammarTag === 'questions');
    },
    [],
  );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (running) {
    const exercises = seededShuffle(data, `${today}:${round}`).slice(0, SESSION_SIZE);
    return (
      <DrillRun key={round} exercises={exercises} onExit={() => setRunning(false)} onAgain={() => setRound((r) => r + 1)} />
    );
  }
  return (
    <Screen testID="questions-screen">
      <ScreenHeader title="Asking questions" subtitle="Speaking task 2" back />
      <AppText variant="body" tone="secondary">
        In task 2 you ask the examiner for information for about 3½ minutes. Practise forming clear, polite questions quickly.
      </AppText>
      <Card>
        <AppText variant="cardTitle">Three ways to ask</AppText>
        {WAYS.map((w) => (
          <View key={w.name} style={styles.mt}>
            <AppText variant="bodyStrong">{w.name}</AppText>
            <AppText variant="french" french>
              {w.example}
            </AppText>
            <AppText variant="meta" tone="muted">
              {w.note}
            </AppText>
          </View>
        ))}
      </Card>
      <Card>
        <AppText variant="cardTitle">Question words</AppText>
        {WORDS.map(([fr, en]) => (
          <Row key={fr} style={[styles.between, styles.mtXs]}>
            <AppText variant="bodyStrong" french style={styles.flex}>
              {fr}
            </AppText>
            <AppText variant="body" tone="secondary">
              {en}
            </AppText>
          </Row>
        ))}
      </Card>
      <Button label={`Start a drill (${Math.min(SESSION_SIZE, data.length)} questions)`} icon="play" onPress={() => setRunning(true)} disabled={data.length === 0} testID="questions-start" />
      <AppText variant="meta" tone="muted">
        Wrong answers go to your mistakes notebook and come back for review.
      </AppText>
    </Screen>
  );
}

function DrillRun({ exercises, onExit, onAgain }: { exercises: readonly Exercise[]; onExit: () => void; onAgain: () => void }) {
  useStudyTimer();
  const { invalidate } = useApp();
  const [items] = useState(exercises);
  const [score, setScore] = useState<QuizScore | null>(null);
  if (score) {
    return (
      <QuizResult
        title="Drill done"
        score={score}
        message="Now use questions like these in a speaking task 2 practice."
        primaryLabel="Done"
        onPrimary={() => {
          invalidate();
          onExit();
        }}
        secondary={<Button label="Another drill" variant="secondary" icon="refresh-cw" onPress={onAgain} />}
        testID="questions-result"
      />
    );
  }
  return <QuizRunner title="Asking questions" exercises={items} context="practice" unitId={null} onClose={onExit} onFinish={setScore} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt: { marginTop: spacing.md },
  mtXs: { marginTop: spacing.xs },
  between: { justifyContent: 'space-between' },
});

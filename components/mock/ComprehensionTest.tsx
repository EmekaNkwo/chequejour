/**
 * A timed listening or reading test: documents one after another, each with its
 * questions, under one countdown. Answers are kept as they come, so when time runs out
 * whatever was answered is scored and the rest counts as wrong. No feedback until the end.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { audioKey, listeningScript } from '../../domain/audio-keys';
import type { MockListeningItem, MockReadingItem } from '../../domain/content-types';
import type { QuestionAnswer } from '../../domain/tcf/mock-scoring';
import { stop as stopAudio } from '../../features/audio/audio-controller';
import { useStudyTimer } from '../../features/progress/useStudyTimer';
import { useCountdown } from '../../features/skills/useCountdown';
import { ComprehensionQuiz } from '../skills/ComprehensionQuiz';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { Row } from '../ui/Bits';
import { Button, IconButton } from '../ui/Button';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/Progress';
import { Screen } from '../ui/Screen';
import { useToast } from '../ui/Toast';
import { PlayOnce } from './PlayOnce';
import { TestClock } from './TestClock';

type Item = MockListeningItem | MockReadingItem;

export interface ComprehensionTestProps {
  skill: 'listening' | 'reading';
  /** e.g. "Compréhension orale · test 1 of 4" */
  title: string;
  items: readonly Item[];
  minutes: number;
  onFinish: (answers: QuestionAnswer[]) => void;
  onQuit: () => void;
}

export function ComprehensionTest({ skill, title, items, minutes, onFinish, onQuit }: ComprehensionTestProps) {
  useStudyTimer();
  const { colors } = useTheme();
  const toast = useToast();
  const answers = useRef<QuestionAnswer[]>([]);
  const finished = useRef(false);
  const [index, setIndex] = useState(0);
  const totalQuestions = items.reduce((n, i) => n + i.questions.length, 0);
  const [answered, setAnswered] = useState(0);

  const timer = useCountdown(() => finish());
  function finish() {
    if (finished.current) return;
    finished.current = true;
    timer.stop();
    void stopAudio();
    onFinish(answers.current);
  }
  const { start } = timer;
  // One countdown for the whole test; the component is keyed per test.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => start(minutes * 60), []);

  const endEarly = async () => {
    const ok = await toast.confirm({
      title: 'End this test now?',
      message: 'Questions you haven’t answered count as wrong.',
      confirmLabel: 'End the test',
      cancelLabel: 'Keep going',
    });
    if (ok) finish();
  };

  const item = items[index];
  const palette = colors.skills[skill];

  return (
    <Screen testID={`mock-test-${skill}`}>
      <Row>
        <IconButton icon="x" label="Leave the test" onPress={onQuit} testID="mock-quit" />
        <View style={styles.flex}>
          <AppText variant="meta" tone="muted" numberOfLines={1}>
            {title}
          </AppText>
          <ProgressBar value={totalQuestions > 0 ? answered / totalQuestions : 0} color={palette.base} track={palette.tint} accessibilityLabel={`${answered} of ${totalQuestions} questions answered`} />
        </View>
        <TestClock seconds={timer.remaining} label="in this test" />
      </Row>

      {item ? (
        <View key={item.id} style={styles.gap}>
          <Card>
            <AppText variant="label" tone="muted">
              {`DOCUMENT ${index + 1} OF ${items.length}`}
            </AppText>
            {'lines' in item ? (
              <>
                <AppText variant="body" tone="secondary" style={styles.mt}>
                  {item.context}
                </AppText>
                <View style={styles.audio}>
                  <PlayOnce audioKey={audioKey.listening(item.id)} text={listeningScript(item.lines)} />
                </View>
              </>
            ) : (
              <>
                <AppText variant="cardTitle" style={styles.mt}>
                  {item.title}
                </AppText>
                <AppText variant="french" french style={styles.mt}>
                  {item.text}
                </AppText>
              </>
            )}
          </Card>
          <Card>
            <ComprehensionQuiz
              questions={item.questions}
              skill={skill}
              level={item.level}
              unitId={null}
              context="mock"
              showFeedback={false}
              onAnswer={(a) => {
                answers.current = [...answers.current, { questionId: a.question.id, picked: a.picked }];
                setAnswered((n) => n + 1);
              }}
              onFinish={() => {
                void stopAudio();
                if (index + 1 >= items.length) finish();
                else setIndex(index + 1);
              }}
            />
          </Card>
        </View>
      ) : null}

      <Button label="End this test now" variant="ghost" onPress={() => void endEarly()} testID="mock-end-test" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  gap: { gap: spacing.lg },
  mt: { marginTop: spacing.sm },
  audio: { marginTop: spacing.lg },
});

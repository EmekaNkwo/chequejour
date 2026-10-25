/**
 * Comprehension questions for a listening or reading text, one at a time. In practice
 * each answer shows its explanation; in mock tests answers are only recorded.
 */
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { AttemptInput } from '../../data/progress-repo';
import type { ComprehensionQuestion, Level } from '../../domain/content-types';
import { useApp } from '../../features/app/AppContext';
import { logError } from '../../features/app/log';
import { recordComprehension } from '../../features/exercises/record-result';
import { useAnswerToast } from '../../features/exercises/useAnswerToast';
import { OptionPill } from '../exercises/inputs';
import { spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';

export interface ComprehensionAnswer {
  question: ComprehensionQuestion;
  picked: number;
  correct: boolean;
}

export interface ComprehensionQuizProps {
  questions: readonly ComprehensionQuestion[];
  skill: 'listening' | 'reading';
  level: Level;
  unitId: string | null;
  context: AttemptInput['context'];
  onFinish: (answers: ComprehensionAnswer[]) => void;
  /** Called after every answer, e.g. so a timed test keeps answers if time runs out. */
  onAnswer?: (answer: ComprehensionAnswer) => void;
  /** Off in mock tests: answers are recorded but not revealed. */
  showFeedback?: boolean;
}

const timestamp = (): number => Date.now();

export function ComprehensionQuiz({ questions, skill, level, unitId, context, onFinish, onAnswer, showFeedback = true }: ComprehensionQuizProps) {
  const { progress } = useApp();
  const feedback = useAnswerToast();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const answeredIndex = useRef(-1);
  const [answers, setAnswers] = useState<ComprehensionAnswer[]>([]);
  const question = questions[index];
  if (!question) return null;

  const advance = (next: ComprehensionAnswer[]) => {
    feedback.clear();
    setPicked(null);
    if (index + 1 >= questions.length) {
      onFinish(next);
      return;
    }
    setIndex(index + 1);
  };

  const pick = (i: number) => {
    // A ref, not state: a fast double tap fires twice before a re-render.
    if (picked !== null || answeredIndex.current === index) return;
    answeredIndex.current = index;
    const correct = i === question.answer;
    const answer = { question, picked: i, correct };
    const next = [...answers, answer];
    setAnswers(next);
    onAnswer?.(answer);
    recordComprehension(progress, {
      questionId: question.id,
      skill,
      level,
      unitId,
      correct,
      question: question.question,
      userAnswer: question.options[i] ?? '',
      correctAnswer: question.options[question.answer] ?? '',
      explanation: question.explanation,
      context,
      now: timestamp(),
    }).catch((e: unknown) => logError('record comprehension', e));
    if (showFeedback) {
      setPicked(i);
      const expected = question.options[question.answer] ?? '';
      feedback.show({ result: correct ? 'correct' : 'wrong', expected }, question.explanation);
    } else advance(next);
  };

  return (
    <View style={styles.gap}>
      <AppText variant="label" tone="muted">
        {`QUESTION ${index + 1} OF ${questions.length}`}
      </AppText>
      <AppText variant="cardTitle" accessibilityRole="header">
        {question.question}
      </AppText>
      <View style={styles.options}>
        {question.options.map((option, i) => {
          const state = picked === null ? 'idle' : i === question.answer ? 'correct' : i === picked ? 'wrong' : 'dimmed';
          return (
            <OptionPill key={`${i}-${option}`} label={option} state={state} disabled={picked !== null} onPress={() => pick(i)} testID={`comprehension-option-${i}`} />
          );
        })}
      </View>
      {picked !== null ? (
        <Button label={index + 1 >= questions.length ? 'Finish' : 'Next question'} onPress={() => advance(answers)} testID="comprehension-next" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.md },
  options: { gap: spacing.sm },
});

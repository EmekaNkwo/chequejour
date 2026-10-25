/**
 * Renders one exercise of any type and reports the learner's answer.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { audioKey } from '../../domain/audio-keys';
import { checkChoice, checkMatch, checkReorder, checkTyped, joinTokens, type CheckOutcome } from '../../domain/answers';
import type {
  ConjugationExercise,
  DictationExercise,
  Exercise,
  FillBlankExercise,
  MatchExercise,
  McqExercise,
  ReorderExercise,
  TranslateExercise,
} from '../../domain/content-types';
import { seededShuffle, shuffledOrder } from '../../domain/shuffle';
import { AudioControls } from '../audio/AudioControls';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { AnswerInput, Chip, OptionPill } from './inputs';

export interface ExerciseViewProps {
  exercise: Exercise;
  /** Set once answered; locks the view and shows the result. */
  answered: CheckOutcome | null;
  onAnswer: (outcome: CheckOutcome, userAnswer: string) => void;
}

export const TYPE_INSTRUCTION: Readonly<Record<Exercise['type'], string>> = {
  mcq: 'Choose the right answer',
  fill_blank: 'Fill in the blank',
  conjugation: 'Conjugate the verb',
  reorder: 'Put the words in order',
  match: 'Match the pairs',
  translate: 'Translate',
  dictation: 'Listen and type what you hear',
};

export function ExerciseView({ exercise, answered, onAnswer }: ExerciseViewProps) {
  switch (exercise.type) {
    case 'mcq':
      return <McqView exercise={exercise} answered={answered} onAnswer={onAnswer} />;
    case 'fill_blank':
      return <FillBlankView exercise={exercise} answered={answered} onAnswer={onAnswer} />;
    case 'conjugation':
      return <ConjugationView exercise={exercise} answered={answered} onAnswer={onAnswer} />;
    case 'reorder':
      return <ReorderView exercise={exercise} answered={answered} onAnswer={onAnswer} />;
    case 'match':
      return <MatchView exercise={exercise} answered={answered} onAnswer={onAnswer} />;
    case 'translate':
      return <TranslateView exercise={exercise} answered={answered} onAnswer={onAnswer} />;
    case 'dictation':
      return <DictationView exercise={exercise} answered={answered} onAnswer={onAnswer} />;
  }
}

interface ViewProps<E extends Exercise> {
  exercise: E;
  answered: CheckOutcome | null;
  onAnswer: (outcome: CheckOutcome, userAnswer: string) => void;
}

function Prompt({ text }: { text: string }) {
  return (
    <AppText variant="bodyStrong" tone="secondary">
      {text}
    </AppText>
  );
}

/** French sentence with the gap drawn as a line. */
function GapSentence({ sentence }: { sentence: string }) {
  const spoken = sentence.replace(/_{3,}/g, 'blank');
  return (
    <AppText variant="frenchLarge" french accessibilityLabel={spoken}>
      {sentence.replace(/_{3,}/g, '＿＿＿')}
    </AppText>
  );
}

export function McqView({ exercise, answered, onAnswer }: ViewProps<McqExercise>) {
  const [picked, setPicked] = useState<number | null>(null);
  // Authored content often lists the answer first, so options are shown in a stable
  // per-exercise shuffled order. `i` below is always the index in exercise.options.
  const order = useMemo(() => shuffledOrder(exercise.options.length, exercise.id), [exercise]);
  const frenchOptions = exercise.options.some((o) => /[a-zàâçéèêëîïôûùüœ]{2,}/i.test(o)) && !!exercise.promptFr;
  return (
    <View style={styles.gap}>
      <Prompt text={exercise.prompt} />
      {exercise.promptFr ? <GapSentence sentence={exercise.promptFr} /> : null}
      <View style={styles.options}>
        {order.map((i, position) => {
          const option = exercise.options[i];
          const state = !answered ? 'idle' : i === exercise.answer ? 'correct' : i === picked ? 'wrong' : 'dimmed';
          return (
            <OptionPill
              key={option}
              label={option}
              french={frenchOptions}
              state={state}
              disabled={!!answered}
              onPress={() => {
                setPicked(i);
                onAnswer(checkChoice(i, exercise.answer, exercise.options), option);
              }}
              testID={`option-${position}`}
            />
          );
        })}
      </View>
    </View>
  );
}

function TypedAnswer({ accepted, answered, onAnswer, label }: { accepted: readonly string[]; answered: CheckOutcome | null; onAnswer: ViewProps<Exercise>['onAnswer']; label: string }) {
  const [value, setValue] = useState('');
  const submit = () => {
    if (value.trim().length === 0 || answered) return;
    onAnswer(checkTyped(value, accepted), value.trim());
  };
  return (
    <View style={styles.gap}>
      <AnswerInput value={value} onChange={setValue} onSubmit={submit} accessibilityLabel={label} editable={!answered} testID="answer-input" />
      {!answered ? <Button label="Check" onPress={submit} disabled={value.trim().length === 0} testID="check-answer" /> : null}
    </View>
  );
}

function FillBlankView({ exercise, answered, onAnswer }: ViewProps<FillBlankExercise>) {
  return (
    <View style={styles.gap}>
      <Prompt text={exercise.prompt} />
      <GapSentence sentence={exercise.sentence} />
      {exercise.hint ? (
        <AppText variant="meta" tone="muted">
          {`Hint: ${exercise.hint}`}
        </AppText>
      ) : null}
      <TypedAnswer accepted={exercise.answers} answered={answered} onAnswer={onAnswer} label="Missing word" />
    </View>
  );
}

function ConjugationView({ exercise, answered, onAnswer }: ViewProps<ConjugationExercise>) {
  const { colors } = useTheme();
  return (
    <View style={styles.gap}>
      <Prompt text={`Conjugate in the ${exercise.tense}`} />
      <View style={[styles.verbCard, { backgroundColor: colors.skills.structures.tint }]}>
        <AppText variant="frenchLarge" french color={colors.skills.structures.onTint}>
          {exercise.verb}
        </AppText>
        <AppText variant="bodyStrong" color={colors.skills.structures.onTint}>
          {exercise.tense}
        </AppText>
      </View>
      <AppText variant="french" french>{`${exercise.person} …`}</AppText>
      <TypedAnswer accepted={exercise.answers} answered={answered} onAnswer={onAnswer} label={`Verb form for ${exercise.person}`} />
    </View>
  );
}

function TranslateView({ exercise, answered, onAnswer }: ViewProps<TranslateExercise>) {
  const toFrench = exercise.direction === 'en-fr';
  return (
    <View style={styles.gap}>
      <Prompt text={toFrench ? 'Translate into French' : 'Translate into English'} />
      <AppText variant={toFrench ? 'title' : 'frenchLarge'} french={!toFrench}>
        {exercise.source}
      </AppText>
      <TypedAnswer accepted={exercise.answers} answered={answered} onAnswer={onAnswer} label={toFrench ? 'Your French translation' : 'Your English translation'} />
    </View>
  );
}

function DictationView({ exercise, answered, onAnswer }: ViewProps<DictationExercise>) {
  return (
    <View style={styles.gap}>
      <Prompt text="Listen, then type the sentence you hear." />
      <AudioControls audioKey={audioKey.dictation(exercise.id)} text={exercise.text} />
      {answered ? (
        <AppText variant="meta" tone="muted">
          {exercise.translation}
        </AppText>
      ) : null}
      <TypedAnswer accepted={[exercise.text]} answered={answered} onAnswer={onAnswer} label="What you heard" />
    </View>
  );
}

function ReorderView({ exercise, answered, onAnswer }: ViewProps<ReorderExercise>) {
  const { colors } = useTheme();
  const order = useMemo(() => shuffledOrder(exercise.tokens.length, exercise.id), [exercise]);
  const [picked, setPicked] = useState<number[]>([]);
  const built = picked.map((i) => exercise.tokens[i]);
  return (
    <View style={styles.gap}>
      <Prompt text={exercise.prompt} />
      <AppText variant="meta" tone="muted">
        {exercise.translation}
      </AppText>
      <View
        style={[styles.answerLine, { borderColor: colors.border, backgroundColor: colors.surfaceRaised }]}
        accessibilityLabel={built.length > 0 ? `Your sentence: ${joinTokens(built)}` : 'Your sentence is empty'}
      >
        {built.length === 0 ? (
          <AppText variant="meta" tone="muted">
            Tap the words below in order
          </AppText>
        ) : (
          picked.map((tokenIndex, position) => (
            <Chip
              key={`${tokenIndex}-${position}`}
              label={exercise.tokens[tokenIndex]}
              accessibilityHint="Removes this word"
              onPress={() => !answered && setPicked((p) => p.filter((_, i) => i !== position))}
            />
          ))
        )}
      </View>
      <View style={styles.chips}>
        {order.map((tokenIndex) => (
          <Chip
            key={tokenIndex}
            label={exercise.tokens[tokenIndex]}
            used={picked.includes(tokenIndex)}
            accessibilityHint="Adds this word to your sentence"
            onPress={() => !answered && setPicked((p) => [...p, tokenIndex])}
          />
        ))}
      </View>
      {!answered ? (
        <Button
          label="Check"
          disabled={picked.length !== exercise.tokens.length}
          onPress={() => onAnswer(checkReorder(built, exercise.tokens), joinTokens(built))}
          testID="check-answer"
        />
      ) : null}
    </View>
  );
}

function MatchView({ exercise, answered, onAnswer }: ViewProps<MatchExercise>) {
  const { colors } = useTheme();
  const rights = useMemo(() => seededShuffle(exercise.pairs.map((_, i) => i), exercise.id), [exercise]);
  const [activeLeft, setActiveLeft] = useState<number | null>(null);
  const [pairs, setPairs] = useState<Record<number, number>>({});
  const usedRights = new Set(Object.values(pairs));
  const complete = Object.keys(pairs).length === exercise.pairs.length;

  const pickRight = (rightIndex: number) => {
    if (answered || activeLeft === null) return;
    setPairs((p) => {
      const next = Object.fromEntries(Object.entries(p).filter(([, r]) => r !== rightIndex)) as Record<number, number>;
      return { ...next, [activeLeft]: rightIndex };
    });
    setActiveLeft(null);
  };

  const stateFor = (left: number): 'idle' | 'selected' | 'correct' | 'wrong' => {
    if (answered) return pairs[left] === left ? 'correct' : 'wrong';
    return activeLeft === left || pairs[left] !== undefined ? 'selected' : 'idle';
  };

  return (
    <View style={styles.gap}>
      <Prompt text={exercise.prompt} />
      <AppText variant="meta" tone="muted">
        Tap a French item, then its match.
      </AppText>
      <View style={styles.matchCols}>
        <View style={styles.matchCol}>
          {exercise.pairs.map((p, i) => (
            <OptionPill key={p.left} label={pairs[i] !== undefined ? `${p.left} → ${exercise.pairs[pairs[i]].right}` : p.left} french state={stateFor(i)} disabled={!!answered} onPress={() => setActiveLeft(i)} />
          ))}
        </View>
        <View style={styles.matchCol}>
          {rights.map((r) => (
            <OptionPill
              key={exercise.pairs[r].right}
              label={exercise.pairs[r].right}
              state={usedRights.has(r) ? 'dimmed' : 'idle'}
              disabled={!!answered || activeLeft === null}
              onPress={() => pickRight(r)}
            />
          ))}
        </View>
      </View>
      {answered ? null : (
        <View style={[styles.matchHint, { backgroundColor: colors.surfaceRaised }]}>
          <Button
            label="Check"
            disabled={!complete}
            onPress={() =>
              onAnswer(
                checkMatch(pairs, exercise.pairs.length),
                exercise.pairs.map((p, i) => `${p.left} → ${pairs[i] !== undefined ? exercise.pairs[pairs[i]].right : '?'}`).join(' · '),
              )
            }
            testID="check-answer"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.lg },
  options: { gap: spacing.md },
  verbCard: { borderRadius: radii.lg, padding: spacing.lg, gap: spacing.xs },
  answerLine: { minHeight: 64, borderRadius: radii.md, borderWidth: 1.5, borderStyle: 'dashed', padding: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  matchCols: { gap: spacing.md },
  matchCol: { gap: spacing.sm },
  matchHint: { borderRadius: radii.md },
});

import { forwardRef, useImperativeHandle, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing, typography } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { PressableScale } from '../ui/PressableScale';

type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed';

export interface OptionPillProps {
  label: string;
  state?: OptionState;
  onPress: () => void;
  french?: boolean;
  disabled?: boolean;
  testID?: string;
}

/** Big tappable answer option. State is shown with an icon word as well as colour. */
export function OptionPill({ label, state = 'idle', onPress, french, disabled, testID }: OptionPillProps) {
  const { colors } = useTheme();
  const style = {
    idle: { bg: colors.surfaceRaised, fg: colors.text, border: colors.border },
    selected: { bg: colors.primaryTint, fg: colors.text, border: colors.primary },
    correct: { bg: colors.successTint, fg: colors.success, border: colors.success },
    wrong: { bg: colors.dangerTint, fg: colors.danger, border: colors.danger },
    dimmed: { bg: colors.surfaceRaised, fg: colors.textMuted, border: colors.border },
  }[state];
  const suffix = state === 'correct' ? ' ✓' : state === 'wrong' ? ' ✗' : '';
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={`${label}${state === 'correct' ? ', correct answer' : state === 'wrong' ? ', your answer, wrong' : ''}`}
      accessibilityState={{ selected: state === 'selected', disabled: !!disabled }}
      style={[styles.option, { backgroundColor: style.bg, borderColor: style.border }]}
      testID={testID}
    >
      <AppText variant={french ? 'french' : 'bodyStrong'} color={style.fg} french={french} center>
        {`${label}${suffix}`}
      </AppText>
    </PressableScale>
  );
}

const ACCENTS = ['é', 'è', 'ê', 'à', 'â', 'ç', 'ù', 'û', 'î', 'ï', 'ô', 'ë', 'œ', '’'];

export interface AnswerInputHandle {
  focus: () => void;
}

export interface AnswerInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  multiline?: boolean;
  accessibilityLabel: string;
  editable?: boolean;
  testID?: string;
}

/** Text input with an accent bar, since many keyboards make accents slow to type. */
export const AnswerInput = forwardRef<AnswerInputHandle, AnswerInputProps>(function AnswerInput(
  { value, onChange, onSubmit, placeholder = 'Type your answer', multiline, accessibilityLabel, editable = true, testID },
  ref,
) {
  const { colors } = useTheme();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [selection, setSelection] = useState({ start: value.length, end: value.length });
  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }));

  const insert = (ch: string) => {
    const start = Math.min(selection.start, value.length);
    const end = Math.min(selection.end, value.length);
    const next = `${value.slice(0, start)}${ch}${value.slice(end)}`;
    onChange(next);
    setSelection({ start: start + ch.length, end: start + ch.length });
  };

  return (
    <View style={styles.inputWrap}>
      <TextInput
        ref={input}
        value={value}
        onChangeText={onChange}
        onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
        onSubmitEditing={multiline ? undefined : onSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        multiline={multiline}
        editable={editable}
        returnKeyType="done"
        accessibilityLabel={accessibilityLabel}
        style={[styles.input, typography.french, { color: colors.text, backgroundColor: colors.surfaceRaised, borderColor: colors.border }, multiline && styles.multiline]}
        testID={testID}
      />
      {editable ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.accents}>
          {ACCENTS.map((ch) => (
            <PressableScale
              key={ch}
              onPress={() => insert(ch)}
              accessibilityLabel={`Insert ${ch}`}
              style={[styles.accent, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
            >
              <AppText variant="cardTitle">{ch}</AppText>
            </PressableScale>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
});

export interface ChipProps {
  label: string;
  onPress: () => void;
  used?: boolean;
  accessibilityHint?: string;
}

export function Chip({ label, onPress, used, accessibilityHint }: ChipProps) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      disabled={used}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!used }}
      style={[styles.chip, { backgroundColor: used ? colors.background : colors.surface, borderColor: used ? colors.background : colors.border }]}
    >
      <AppText variant="french" french color={used ? colors.background : colors.text}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  option: { minHeight: 56, borderRadius: radii.pill, borderWidth: 2, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, justifyContent: 'center' },
  inputWrap: { gap: spacing.sm },
  input: { minHeight: 56, borderRadius: radii.md, borderWidth: 2, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  multiline: { minHeight: 200, textAlignVertical: 'top' },
  accents: { gap: spacing.xs, paddingVertical: 2 },
  accent: { width: 44, height: 44, borderRadius: radii.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chip: { minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.md, borderWidth: 1.5, justifyContent: 'center' },
});

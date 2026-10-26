/**
 * The frame every AI answer is shown in: a clear "AI suggestion" label, a calm working
 * state, and the failure message when the answer could not be used.
 */
import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { aiFailureMessage } from '../../domain/ai/errors';
import type { AiJobState } from '../../features/ai/useAiJob';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { LinkText, Row } from '../ui/Bits';

export interface AiPanelProps<T> {
  title: string;
  state: AiJobState<T>;
  /** What the model is doing, while it works. */
  workingText?: string;
  onCancel?: () => void;
  children: (value: T) => ReactNode;
  testID?: string;
}

export function AiPanel<T>({ title, state, workingText = 'Thinking on this phone…', onCancel, children, testID }: AiPanelProps<T>) {
  const { colors } = useTheme();
  if (state.status === 'idle') return null;
  return (
    <View style={[styles.panel, { backgroundColor: colors.surfaceRaised }]} testID={testID}>
      <Row gap={spacing.sm}>
        <Feather name="cpu" size={14} color={colors.textMuted} />
        <AppText variant="label" tone="muted" style={styles.flex}>
          {`${title.toUpperCase()} · AI SUGGESTION`}
        </AppText>
      </Row>
      {state.status === 'working' ? (
        <Row gap={spacing.sm}>
          <ActivityIndicator color={colors.textMuted} />
          <AppText variant="meta" tone="muted" style={styles.flex}>
            {workingText}
          </AppText>
          {onCancel ? <LinkText label="Stop" onPress={onCancel} /> : null}
        </Row>
      ) : state.status === 'failed' ? (
        <AppText variant="meta" tone="muted">
          {aiFailureMessage(state.failure)}
        </AppText>
      ) : (
        children(state.value)
      )}
      {state.status === 'done' ? (
        <AppText variant="meta" tone="muted">
          Written by the AI on your phone. It can be wrong; the app’s own answers and scores come first.
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: radii.md, padding: spacing.md, gap: spacing.sm },
  flex: { flex: 1 },
});

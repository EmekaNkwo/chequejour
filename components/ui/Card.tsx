import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { PressableScale } from './PressableScale';

export interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  color?: string;
  padded?: boolean;
  testID?: string;
}

/** White rounded card with a soft shadow; pressable when given onPress. */
export function Card({ children, style, onPress, accessibilityLabel, accessibilityHint, color, padded = true, testID }: CardProps) {
  const { colors, shadow } = useTheme();
  const base = [styles.card, shadow, { backgroundColor: color ?? colors.surface }, padded && styles.padded, style];
  if (!onPress) {
    return (
      <View style={base} accessibilityLabel={accessibilityLabel} testID={testID}>
        {children}
      </View>
    );
  }
  return (
    <PressableScale onPress={onPress} style={base} accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint} testID={testID}>
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg },
  padded: { padding: spacing.xl },
});

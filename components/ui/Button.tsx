import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: FeatherName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
}

export function Button({ label, onPress, variant = 'primary', icon, disabled, loading, style, accessibilityHint, testID }: ButtonProps) {
  const { colors } = useTheme();
  const bg = variant === 'primary' ? colors.primary : variant === 'secondary' ? colors.primaryTint : 'transparent';
  const fg = variant === 'primary' ? colors.onPrimary : colors.primary;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={[styles.button, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }, style]}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Feather name={icon} size={18} color={fg} /> : null}
          <AppText variant="bodyStrong" color={fg}>
            {label}
          </AppText>
        </View>
      )}
    </PressableScale>
  );
}

export interface IconButtonProps {
  icon: FeatherName;
  label: string;
  onPress: () => void;
  size?: number;
  color?: string;
  background?: string;
  badge?: boolean;
  disabled?: boolean;
  testID?: string;
}

/** Round icon-only button; always 44×44 or larger, with a screen-reader label. */
export function IconButton({ icon, label, onPress, size = 44, color, background, badge, disabled, testID }: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={size < 44 ? (44 - size) / 2 : 0}
      style={[styles.icon, { width: size, height: size, borderRadius: size / 2, backgroundColor: background ?? colors.surface, opacity: disabled ? 0.5 : 1 }]}
      testID={testID}
    >
      <Feather name={icon} size={Math.round(size * 0.45)} color={color ?? colors.text} />
      {badge ? <View style={[styles.badge, { backgroundColor: colors.skills.structures.base, borderColor: background ?? colors.surface }]} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 52, borderRadius: radii.pill, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 9, right: 10, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
});

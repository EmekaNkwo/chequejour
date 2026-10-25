import { Text, type TextProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { typography, type TypographyVariant } from '../theme/tokens';

type Tone = 'default' | 'secondary' | 'muted' | 'primary' | 'success' | 'danger' | 'inverse';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  tone?: Tone;
  color?: string;
  /** French text is announced in French by screen readers. */
  french?: boolean;
  center?: boolean;
}

/** Large titles cap their scaling so they don't push cards off screen. */
const SCALE_CAP: Partial<Record<TypographyVariant, number>> = { screenTitle: 1.4, frenchLarge: 1.5, title: 1.6 };

export function AppText({ variant = 'body', tone = 'default', color, french, center, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const toneColor: Record<Tone, string> = {
    default: colors.text,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    primary: colors.primary,
    success: colors.success,
    danger: colors.danger,
    inverse: colors.onPrimary,
  };
  return (
    <Text
      maxFontSizeMultiplier={SCALE_CAP[variant] ?? 2}
      // Lets TalkBack / VoiceOver pick a French voice for French text.
      {...(french ? { accessibilityLanguage: 'fr-FR' } : null)}
      style={[typography[variant], { color: color ?? toneColor[tone] }, center ? { textAlign: 'center' } : null, style]}
      {...rest}
    />
  );
}

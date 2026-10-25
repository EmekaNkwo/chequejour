import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { ScrollView, StyleSheet, useColorScheme, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '../brand/Logo';
import { useTheme } from '../theme/ThemeProvider';
import { darkColors, lightColors, spacing } from '../theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';

/** Room for the floating tab bar on tab screens. */
export const TAB_BAR_SPACE = 104;

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  /** Leaves space at the bottom for the floating tab bar. */
  tabs?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
  testID?: string;
}

export function Screen({ children, scroll = true, tabs = false, contentStyle, footer, testID }: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: insets.top + spacing.md,
    paddingBottom: (tabs ? TAB_BAR_SPACE : spacing.xxl) + insets.bottom,
  };
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID={testID}>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.content, padding, contentStyle]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill, padding, contentStyle]}>{children}</View>
      )}
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg, backgroundColor: colors.background }]}>{footer}</View> : null}
    </View>
  );
}

/** Matches the native splash image width in app.json, so the handover doesn't jump. */
export const SPLASH_LOGO_SIZE = 120;
const PULSE_MS = 900;

/** Gently pulsing logo; the motion stops when the system asks for reduced motion. */
function PulsingLogo({ size }: { size: number }) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.set(withRepeat(withSequence(withTiming(0.55, { duration: PULSE_MS }), withTiming(1, { duration: PULSE_MS })), -1));
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.get(), transform: [{ scale: 0.94 + pulse.get() * 0.06 }] }));
  return (
    <Animated.View style={style}>
      <Logo size={size} />
    </Animated.View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, styles.center, { backgroundColor: colors.background }]} accessible accessibilityRole="progressbar" accessibilityLabel="Loading">
      <PulsingLogo size={56} />
    </View>
  );
}

/** First screen after the native splash: same logo, same place, then the name fades in. */
export function AppLoading() {
  // Shown before settings (and so the theme preference) load: follow the system like the native splash does.
  const colors = useColorScheme() === 'dark' ? darkColors : lightColors;
  const reduceMotion = useReducedMotion();
  return (
    <View style={[styles.root, styles.center, { backgroundColor: colors.background }]} accessible accessibilityRole="progressbar" accessibilityLabel="Chaque Jour is loading">
      <PulsingLogo size={SPLASH_LOGO_SIZE} />
      <Animated.View entering={reduceMotion ? undefined : FadeIn.delay(200).duration(400)} style={styles.name}>
        <AppText variant="title" color={colors.text}>
          Chaque Jour
        </AppText>
        <AppText variant="meta" color={colors.textMuted}>
          Getting today&apos;s French ready…
        </AppText>
      </Animated.View>
    </View>
  );
}

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  /** Offers a way out (back, or home after a deep link). Off where no navigator is mounted yet. */
  canLeave?: boolean;
}

export function ErrorState({ message, onRetry, canLeave = true }: ErrorStateProps) {
  const { colors } = useTheme();
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View style={[styles.root, styles.center, { backgroundColor: colors.background, padding: spacing.xxl, gap: spacing.lg }]}>
      <AppText variant="cardTitle" center>
        {message}
      </AppText>
      {onRetry ? <Button label="Try again" onPress={onRetry} variant="secondary" /> : null}
      {canLeave ? <Button label="Go back" icon="arrow-left" onPress={leave} variant="secondary" testID="error-back" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  center: { alignItems: 'center', justifyContent: 'center' },
  // Absolute so the logo stays exactly where the splash drew it.
  name: { position: 'absolute', top: '50%', marginTop: SPLASH_LOGO_SIZE / 2 + spacing.xl, alignItems: 'center', gap: spacing.xs },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
});

import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from './AppText';
import { IconButton } from './Button';
import { PressableScale } from './PressableScale';

export interface ScreenHeaderProps {
  title: string;
  /** Shown as a back button for pushed screens. */
  back?: boolean;
  actions?: ReactNode;
  subtitle?: string;
}

export function ScreenHeader({ title, back, actions, subtitle }: ScreenHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {back ? <IconButton icon="arrow-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} /> : null}
        <AppText variant={back ? 'title' : 'screenTitle'} accessibilityRole="header" style={styles.title} numberOfLines={2}>
          {title}
        </AppText>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
      {subtitle ? (
        <AppText variant="meta" tone="muted">
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

/** Small round French flag drawn in SVG. */
export function FrenchFlag({ size = 22 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }} importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 3 3">
        <Rect x="0" y="0" width="1" height="3" fill="#002395" />
        <Rect x="1" y="0" width="1" height="3" fill="#FFFFFF" />
        <Rect x="2" y="0" width="1" height="3" fill="#ED2939" />
      </Svg>
    </View>
  );
}

export interface ContextRowProps {
  level: string;
  unitText: string;
  onPress: () => void;
}

/** "🇫🇷 Français · Your level: A2 · Unit 4/18" — opens level details. */
export function ContextRow({ level, unitText, onPress }: ContextRowProps) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`Français. Your level: ${level}, practice estimate. ${unitText}. Opens level details.`}
      style={styles.context}
      testID="context-row"
    >
      <FrenchFlag />
      <AppText variant="bodyStrong">Français</AppText>
      <AppText variant="meta" tone="muted" style={styles.flex} numberOfLines={1}>
        {`Your level: ${level} · ${unitText}`}
      </AppText>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  title: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  context: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  flex: { flex: 1 },
});

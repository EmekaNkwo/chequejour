import { Feather } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { AppText } from '../ui/AppText';
import { PressableScale } from '../ui/PressableScale';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const TABS: Readonly<Record<string, { label: string; icon: FeatherName }>> = {
  index: { label: 'Home', icon: 'home' },
  learn: { label: 'Learn', icon: 'map' },
  practice: { label: 'Practice', icon: 'headphones' },
  progress: { label: 'Progress', icon: 'bar-chart-2' },
};

/** White rounded pill inset from the screen edges, above the safe area. */
export function FloatingTabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { colors, shadow } = useTheme();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]} pointerEvents="box-none">
      <View style={[styles.bar, shadow, { backgroundColor: colors.tabBar }]} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = index === state.index;
          const color = focused ? colors.tabActive : colors.tabInactive;
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <PressableScale
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={`${tab.label}, tab, ${index + 1} of ${state.routes.length}`}
              style={[styles.item, focused && { backgroundColor: colors.background }]}
              testID={`tab-${route.name}`}
            >
              <Feather name={tab.icon} size={focused ? 23 : 21} color={color} />
              <AppText variant="label" color={color} style={focused ? styles.activeLabel : undefined} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                {tab.label}
              </AppText>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg },
  bar: { flexDirection: 'row', borderRadius: radii.xl, padding: 6, gap: 4 },
  item: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: radii.lg, gap: 2 },
  activeLabel: { fontFamily: 'Nunito_900Black' },
});

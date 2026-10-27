import { Tabs } from 'expo-router/js-tabs';
import { FloatingTabBar } from '../../components/navigation/FloatingTabBar';
import { useTheme } from '../../components/theme/ThemeProvider';

export default function TabLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn' }} />
      <Tabs.Screen name="practice" options={{ title: 'Practice' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
    </Tabs>
  );
}

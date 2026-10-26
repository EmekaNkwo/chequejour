import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from '@expo-google-fonts/nunito';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../components/theme/ThemeProvider';
import { AppLoading, ErrorState } from '../components/ui/Screen';
import { ToastProvider } from '../components/ui/Toast';
import { loadSettings, type Settings } from '../data/settings-repo';
import { AppProvider, useApp } from '../features/app/AppContext';
import { DATABASE_NAME, initDatabase } from '../features/app/bootstrap';
import { logError } from '../features/app/log';
import { NotificationManager } from '../features/notifications/NotificationManager';

const SPLASH_FADE_MS = 300;

SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ fade: true, duration: SPLASH_FADE_MS });

const APP_SCREENS = [
  '(tabs)',
  'session',
  'review',
  'lesson/[id]',
  'unit/[id]',
  'checkpoint/[unitId]',
  'drill/[unitId]',
  'mistakes',
  'conjugation',
  'shadow',
  'questions',
  'listening/[id]',
  'reading/[id]',
  'writing/[id]',
  'speaking/[id]',
  'exam-practice/[skill]',
  'nclc',
  'mock/[id]',
  'daily/word',
  'daily/sentence',
  'settings',
  'weekly',
  'level',
  'search',
  'grammar/index',
  'grammar/[id]',
] as const;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={initDatabase} onError={(e) => logError('database', e)}>
        <Bootstrap />
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}

function Bootstrap() {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    loadSettings(db)
      .then(setSettings)
      .catch((e: unknown) => {
        logError('load settings', e);
        setFailed(true);
      })
      .finally(() => SplashScreen.hideAsync().catch(() => undefined));
  }, [db]);
  if (failed) return <ErrorState message="Chaque Jour couldn't open its data on this device." canLeave={false} />;
  if (!settings) return <AppLoading />;
  return (
    <AppProvider db={db} initialSettings={settings}>
      <Themed />
    </AppProvider>
  );
}

function Themed() {
  const { settings } = useApp();
  return (
    <ThemeProvider preference={settings.theme}>
      <ToastProvider>
        <Navigation />
        <NotificationManager />
      </ToastProvider>
    </ThemeProvider>
  );
}

function Navigation() {
  const { colors, scheme } = useTheme();
  const { settings } = useApp();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }}>
        {/* Every app screen is listed here: unlisted routes would be reachable before
            onboarding, and the router would pick one of them as the first screen. */}
        <Stack.Protected guard={settings.onboarded}>
          {APP_SCREENS.map((name) => (
            <Stack.Screen key={name} name={name} />
          ))}
        </Stack.Protected>
        <Stack.Protected guard={!settings.onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import type { ThemePreference } from '../../data/settings-repo';
import { cardShadow, darkColors, lightColors, type ColorScheme, type ThemeColors } from './tokens';

export interface Theme {
  scheme: ColorScheme;
  colors: ThemeColors;
  shadow: object;
}

const ThemeContext = createContext<Theme>({ scheme: 'light', colors: lightColors, shadow: cardShadow(lightColors, 'light') });

interface ThemeProviderProps {
  preference: ThemePreference;
  children: ReactNode;
}

export function ThemeProvider({ preference, children }: ThemeProviderProps) {
  const system = useColorScheme();
  const scheme: ColorScheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const value = useMemo<Theme>(() => {
    const colors = scheme === 'dark' ? darkColors : lightColors;
    return { scheme, colors, shadow: cardShadow(colors, scheme) };
  }, [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

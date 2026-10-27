/**
 * Design tokens. Every skill area has one colour, always paired with an icon and a
 * label. Text colours on coloured tiles were picked to pass WCAG AA (4.5:1) at body
 * size; see docs/DESIGN.md for the contrast table.
 */
import type { Skill } from '../../domain/content-types';

export type ColorScheme = 'light' | 'dark';

export interface SkillPalette {
  /** Saturated tile colour. */
  base: string;
  /** Pale tint for thumbnails and icon wells. */
  tint: string;
  /** Text and icons placed on `base`. */
  onBase: string;
  /** Text and icons placed on `tint`. */
  onTint: string;
}

export type PaletteKey = Skill | 'vocabulary' | 'tests' | 'unit';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  /** Text on primary (coral) buttons. */
  onPrimary: string;
  primaryTint: string;
  success: string;
  successTint: string;
  danger: string;
  dangerTint: string;
  tabBar: string;
  tabActive: string;
  tabInactive: string;
  shadow: string;
  masculine: string;
  masculineTint: string;
  feminine: string;
  feminineTint: string;
  unitGradient: [string, string];
  skills: Record<PaletteKey, SkillPalette>;
}

const NAVY = '#1B2440';

export const lightColors: ThemeColors = {
  background: '#EEF3F8',
  surface: '#FFFFFF',
  surfaceRaised: '#F6F8FB',
  text: NAVY,
  textSecondary: '#4A5672',
  textMuted: '#5F6B85',
  border: '#DCE3EC',
  // Coral #F26B5B is the brand accent; buttons use a deeper coral so white text passes AA.
  primary: '#BF3A2E',
  onPrimary: '#FFFFFF',
  primaryTint: '#FDE7E4',
  success: '#1E7A55',
  successTint: '#DDF3E9',
  danger: '#AD3328',
  dangerTint: '#FCE4E1',
  tabBar: '#FFFFFF',
  tabActive: NAVY,
  tabInactive: '#636E87',
  shadow: '#1B2440',
  masculine: '#2F5DA8',
  masculineTint: '#E3ECFA',
  feminine: '#A63A6B',
  feminineTint: '#F8E3EE',
  unitGradient: ['#9D9CF6', '#C3B5FA'],
  skills: {
    structures: { base: '#F26B5B', tint: '#FDE7E4', onBase: NAVY, onTint: '#8F2A20' },
    vocabulary: { base: '#F7C948', tint: '#FDF3D3', onBase: NAVY, onTint: '#6B5100' },
    tests: { base: '#5CC2B5', tint: '#DDF3F0', onBase: NAVY, onTint: '#145E55' },
    unit: { base: '#9D9CF6', tint: '#ECEBFE', onBase: NAVY, onTint: '#3F3DA6' },
    listening: { base: '#6BA8F0', tint: '#E3EFFD', onBase: NAVY, onTint: '#1F5596' },
    reading: { base: '#8FCB7A', tint: '#E6F5E0', onBase: NAVY, onTint: '#2F6B1D' },
    writing: { base: '#F4A261', tint: '#FDEBDD', onBase: NAVY, onTint: '#86450F' },
    speaking: { base: '#E58AB8', tint: '#FBE6F0', onBase: NAVY, onTint: '#8A2B5B' },
  },
};

export const darkColors: ThemeColors = {
  background: '#141A2E',
  surface: '#1E2640',
  surfaceRaised: '#262F4D',
  text: '#F1F4FA',
  textSecondary: '#C3CADB',
  textMuted: '#A3ACC2',
  border: '#323C5C',
  primary: '#FF8A7C',
  onPrimary: '#141A2E',
  primaryTint: '#3D2A36',
  success: '#5BD1A0',
  successTint: '#1E3B37',
  danger: '#FF8A7C',
  dangerTint: '#3D2A36',
  tabBar: '#1E2640',
  tabActive: '#FFFFFF',
  tabInactive: '#9AA3BA',
  shadow: '#000000',
  masculine: '#8DB4F5',
  masculineTint: '#24345A',
  feminine: '#F2A3C8',
  feminineTint: '#3F2943',
  unitGradient: ['#9391F2', '#ABA0EE'],
  skills: {
    structures: { base: '#FF8A7C', tint: '#3D2A36', onBase: '#141A2E', onTint: '#FFC2BA' },
    vocabulary: { base: '#F9D36B', tint: '#3B3528', onBase: '#141A2E', onTint: '#FBE3A0' },
    tests: { base: '#6FD3C6', tint: '#1F3A40', onBase: '#141A2E', onTint: '#A8E8DF' },
    unit: { base: '#B1B0FA', tint: '#2C2D52', onBase: '#141A2E', onTint: '#D2D1FC' },
    listening: { base: '#8DBDF5', tint: '#22344F', onBase: '#141A2E', onTint: '#BCD8FA' },
    reading: { base: '#A6D894', tint: '#26392A', onBase: '#141A2E', onTint: '#C9E8BE' },
    writing: { base: '#F7B57F', tint: '#3C2F2A', onBase: '#141A2E', onTint: '#FAD0AE' },
    speaking: { base: '#EEA5CA', tint: '#3B2840', onBase: '#141A2E', onTint: '#F6CCE1' },
  },
};

export const radii = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;

export const fonts = {
  regular: 'Nunito_400Regular',
  medium: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  heavy: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
} as const;

export const typography = {
  screenTitle: { fontFamily: fonts.black, fontSize: 32, lineHeight: 38 },
  title: { fontFamily: fonts.heavy, fontSize: 22, lineHeight: 28 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 23 },
  meta: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
  /** French text is set larger than English. */
  french: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 28 },
  frenchLarge: { fontFamily: fonts.heavy, fontSize: 30, lineHeight: 38 },
} as const;

export type TypographyVariant = keyof typeof typography;

export function cardShadow(colors: ThemeColors, scheme: ColorScheme): object {
  return scheme === 'dark'
    ? { elevation: 0 }
    : {
        shadowColor: colors.shadow,
        shadowOpacity: 0.07,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      };
}

/** WCAG relative-luminance contrast ratio between two hex colours. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string): number => {
    const v = hex.replace('#', '');
    const [r, g, bl] = [0, 2, 4].map((i) => {
      const c = parseInt(v.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

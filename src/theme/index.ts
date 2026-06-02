import { useColorScheme } from 'react-native';
import { useFonts } from 'expo-font';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_700Bold_Italic,
} from '@expo-google-fonts/playfair-display';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  DMSans_400Regular_Italic,
} from '@expo-google-fonts/dm-sans';
import {
  DMMono_400Regular,
  DMMono_500Medium,
  DMMono_300Light,
} from '@expo-google-fonts/dm-mono';

// ─── Colors ──────────────────────────────────────────────────────────────────

export const palette = {
  primary: '#0D1F6E',
  secondary: '#0D9E5E',
  tertiary: '#E07B2A',
  bgLight: '#F7F8FA',
  bgDark: '#13161E',
  success: '#0D9E5E',
  error: '#C0392B',
  warning: '#D4820A',
  info: '#0D1F6E',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type PaletteKey = keyof typeof palette;

const lightColors = {
  background: palette.bgLight,
  surface: palette.white,
  text: '#0D1120',
  textSecondary: '#4B5063',
  textDisabled: '#9EA3B5',
  border: '#DDE1EC',
  ...palette,
} as const;

const darkColors = {
  background: palette.bgDark,
  surface: '#1E2230',
  text: '#F0F2FA',
  textSecondary: '#9EA3B5',
  textDisabled: '#4B5063',
  border: '#2C3145',
  ...palette,
  bgLight: palette.bgDark,
} as const;

export type Colors = Record<keyof typeof lightColors, string>;

// ─── Spacing ─────────────────────────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const;

export type SpacingKey = keyof typeof spacing;

// ─── Border Radius ────────────────────────────────────────────────────────────

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  pill: 24,
  full: 999,
} as const;

export type RadiusKey = keyof typeof radius;

// ─── Typography ───────────────────────────────────────────────────────────────

export const fontFamilies = {
  // Playfair Display — display headings and section headers
  display: 'PlayfairDisplay_700Bold',
  displayMedium: 'PlayfairDisplay_500Medium',
  displayRegular: 'PlayfairDisplay_400Regular',
  displayItalic: 'PlayfairDisplay_400Regular_Italic',
  displayBoldItalic: 'PlayfairDisplay_700Bold_Italic',
  // DM Sans — UI labels, body text, buttons
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemiBold: 'DMSans_600SemiBold',
  bodyBold: 'DMSans_700Bold',
  bodyItalic: 'DMSans_400Regular_Italic',
  // DM Mono — phonetics, technical labels, code
  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
  monoLight: 'DMMono_300Light',
} as const;

export type FontFamilyKey = keyof typeof fontFamilies;

export const fontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
} as const;

export const lineHeights = {
  tight: 1.2,
  snug: 1.35,
  normal: 1.5,
  relaxed: 1.65,
} as const;

// ─── Font loader hook ─────────────────────────────────────────────────────────

export function useAppFonts() {
  return useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_700Bold_Italic,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_400Regular_Italic,
    DMMono_300Light,
    DMMono_400Regular,
    DMMono_500Medium,
  });
}

// ─── Theme object ─────────────────────────────────────────────────────────────

function buildTheme(colors: Colors) {
  return {
    colors,
    spacing,
    radius,
    fontFamilies,
    fontSizes,
    lineHeights,
  } as const;
}

export type Theme = ReturnType<typeof buildTheme>;

export const lightTheme = buildTheme(lightColors);
export const darkTheme = buildTheme(darkColors);

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}

import { createContext, useContext, useMemo } from 'react';

// Semantic color tokens. Every screen styles itself from these via
// useThemedStyles, so switching the palette re-themes the whole app.
export interface ThemeColors {
  /** Page background (was #fff) */
  surface: string;
  /** Card background (was #f9fafb) */
  card: string;
  /** Secondary fill: chips, steppers, toolbars (was #f3f4f6) */
  cardAlt: string;
  /** Card & input borders (was #e5e7eb) */
  border: string;
  /** Hairline row dividers (was #eef0f2 / #f3f4f6) */
  divider: string;
  /** Primary text (was #000) */
  text: string;
  /** Secondary text (was #888) */
  textMuted: string;
  /** Tertiary text / disabled (was #aaa, #ccc) */
  textFaint: string;
  /** Body copy softer than primary (was #444, #555) */
  textSoft: string;
  /** Filled buttons & active toggles (was #000) */
  primary: string;
  /** Text/icons on primary (was #fff) */
  onPrimary: string;
  /** Subtle fill on primary surfaces (buttons on the rest-timer bar) */
  onPrimaryFaint: string;
  /** Brand lime accent */
  accent: string;
  /** Text/icons on accent fills — always dark, lime is a light color */
  onAccent: string;
  /** Hard offset shadows (neo-brutalist cards & buttons) */
  shadow: string;
  /** Darker accent for "target met" states */
  accentDeep: string;
  /** Informational blue (pickers, links) */
  blue: string;
  /** Errors & destructive */
  danger: string;
  // Opaque pastel tints (pre-blended over surface so hard shadows and
  // dark mode both work — semi-transparent fills + iOS hard shadows
  // cause content-shaped ghosting).
  tintOrange: string;
  tintBlue: string;
  tintCyan: string;
  tintPurple: string;
  tintLime: string;
  tintLimeFaint: string;
}

export const LIGHT: ThemeColors = {
  surface: '#ffffff',
  card: '#f9fafb',
  cardAlt: '#f3f4f6',
  border: '#e5e7eb',
  divider: '#eef0f2',
  text: '#000000',
  textMuted: '#888888',
  textFaint: '#bbbbbb',
  textSoft: '#444444',
  primary: '#000000',
  onPrimary: '#ffffff',
  onPrimaryFaint: 'rgba(255,255,255,0.15)',
  accent: '#a3e635',
  onAccent: '#0a0a0a',
  shadow: '#000000',
  accentDeep: '#65a30d',
  blue: '#3b82f6',
  danger: '#dc2626',
  tintOrange: '#fef2e8',
  tintBlue: '#ecf4fe',
  tintCyan: '#e4fafd',
  tintPurple: '#f4f1fe',
  tintLime: '#f4fce7',
  tintLimeFaint: '#fafdf3',
};

export const DARK: ThemeColors = {
  surface: '#0f1114',
  card: '#1a1d21',
  cardAlt: '#24282d',
  border: '#2e343a',
  divider: '#22262b',
  text: '#f2f2f2',
  textMuted: '#9aa0a6',
  textFaint: '#5c6166',
  textSoft: '#c4c9ce',
  primary: '#f2f2f2',
  onPrimary: '#0f1114',
  onPrimaryFaint: 'rgba(15,17,20,0.12)',
  accent: '#a3e635',
  onAccent: '#0a0a0a',
  // Matches the dark-mode border ink so hard offset shadows read as the
  // same thick bottom-right edge they create in light mode.
  shadow: '#f2f2f2',
  accentDeep: '#84cc16',
  blue: '#60a5fa',
  danger: '#f87171',
  tintOrange: '#2b2119',
  tintBlue: '#192330',
  tintCyan: '#11282e',
  tintPurple: '#212030',
  tintLime: '#212b18',
  tintLimeFaint: '#181e14',
};

const ThemeContext = createContext<ThemeColors>(LIGHT);

export const ThemeProvider = ThemeContext.Provider;

export function useThemeColors(): ThemeColors {
  return useContext(ThemeContext);
}

/**
 * Per-component themed styles. `factory` is a module-level
 * `createStyles(c)` function; the result is memoised per palette.
 * Returns the palette too, for inline colors (icons etc.).
 */
export function useThemedStyles<T>(
  factory: (c: ThemeColors) => T
): { c: ThemeColors; styles: T } {
  const c = useThemeColors();
  const styles = useMemo(() => factory(c), [c, factory]);
  return { c, styles };
}

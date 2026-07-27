import { Platform } from 'react-native';

/**
 * Spread onto any VERTICAL ScrollView that contains text inputs:
 *
 *   <ScrollView {...keyboardAwareScrollProps} style={styles.content}>
 *
 * Why this and not a library: react-native-keyboard-controller needs a
 * native build, which would break the Expo Go workflow. These two
 * built-in props solve the same problem with no dependency.
 *
 * - automaticallyAdjustKeyboardInsets (iOS only, RN 0.72+): extends the
 *   scrollable area by the keyboard's height when it opens, so a focused
 *   field can scroll clear of it instead of hiding underneath. On
 *   Android the equivalent happens at the window level via
 *   android.softwareKeyboardLayoutMode: "resize" in app.json — setting
 *   this prop there too would double-compensate, hence the Platform check.
 * - keyboardShouldPersistTaps: without it, the first tap on a button
 *   while the keyboard is open is swallowed just to dismiss the
 *   keyboard, so every save/add button needs two taps.
 *
 * Do NOT spread this onto `horizontal` ScrollViews (chip rows) — the
 * keyboard inset applies to the wrong axis there.
 */
export const keyboardAwareScrollProps = {
  automaticallyAdjustKeyboardInsets: Platform.OS === 'ios',
  keyboardShouldPersistTaps: 'handled' as const,
};

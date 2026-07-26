import React, { useId } from 'react';
import {
  TextInput,
  TextInputProps,
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import { ThemeColors, useThemedStyles } from '../../lib/theme';

export default function NumericInput(props: TextInputProps) {
  const { c, styles } = useThemedStyles(createStyles);
  // Generate a unique ID for each individual input instance
  const uniqueId = useId();

  // InputAccessoryView is iOS-only; Android's number pad has its own
  // dismiss affordance, so skip the toolbar there.
  const isIOS = Platform.OS === 'ios';

  return (
    <>
      <TextInput
        {...props}
        keyboardType="decimal-pad"
        inputAccessoryViewID={isIOS ? uniqueId : undefined}
      />

      {isIOS && (
        <InputAccessoryView nativeID={uniqueId}>
          <View style={styles.toolbar}>
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => Keyboard.dismiss()}>
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}
    </>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
  toolbar: {
    height: 44,
    backgroundColor: c.cardAlt,
    borderTopWidth: 0.5,
    borderColor: c.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  done: {
    color: c.blue,
    fontSize: 17,
    fontWeight: '600',
  },
});
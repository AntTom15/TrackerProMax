import { View, Text, StyleSheet } from 'react-native';
import { Settings } from './Icons';
import { ThemeColors, useThemedStyles } from '../lib/theme';

interface BlankPageProps {
  title: string;
}

export default function BlankPage({ title }: BlankPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.container}>
      <Settings size={48} color={c.textMuted} strokeWidth={1} />
      <Text style={styles.text}>{title} — Coming soon</Text>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  text: {
    color: c.textMuted,
    fontSize: 14,
    fontFamily: 'DM Sans',
  },
});

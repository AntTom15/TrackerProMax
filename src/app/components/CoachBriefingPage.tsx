import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from './Icons';
import { ThemeColors, useThemedStyles } from '../lib/theme';

interface CoachBriefingPageProps {
  briefing: string;
  onChange: (text: string) => void;
}

const SOFT_CAP = 2000;
const HARD_CAP = 4000;

const PLACEHOLDER = `Push back on me when evidence is thin — no fantasies.
I eat a modified animal-based diet for micronutrient density; low carb and fiber are intentional.
Winter high-fat eating works best paired with cold exposure (agreed 7/26).
Currently experimenting: cold exposure 2-3×/week.
Off the table: plant-based protein powders.`;

export default function CoachBriefingPage({
  briefing,
  onChange,
}: CoachBriefingPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const navigation = useNavigation();
  const len = briefing.length;
  const counterColor =
    len > HARD_CAP ? c.danger : len > SOFT_CAP ? '#fb923c' : c.textMuted;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ChevronLeft size={22} color={c.textMuted} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Coach Briefing</Text>
          <Text style={styles.subtitle}>
            Read by your coach before every reply
          </Text>
        </View>
        <Text style={[styles.counter, { color: counterColor }]}>
          {len} / {SOFT_CAP}
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hintBox}>
          <Text style={styles.hintText}>
            Your coach treats this as your stated positions — not established
            fact. Keep the first lines as standing instructions (how the coach
            should behave), then one idea per line. Chats can propose updates
            here, but nothing saves without your approval.
          </Text>
        </View>

        <TextInput
          value={briefing}
          onChangeText={(t) => onChange(t.slice(0, HARD_CAP))}
          placeholder={PLACEHOLDER}
          placeholderTextColor={c.textFaint}
          multiline
          textAlignVertical="top"
          style={styles.editor}
        />

        {len > SOFT_CAP && (
          <Text style={[styles.capWarning, { color: counterColor }]}>
            {len > HARD_CAP
              ? 'Hard cap reached — trim before adding more.'
              : 'Past the soft cap — long briefings dilute the coach’s attention, especially on local models.'}
          </Text>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.surface,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
    },
    headerBtn: {
      padding: 4,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    subtitle: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      marginTop: 2,
    },
    counter: {
      fontSize: 12,
      fontWeight: '700',
      fontFamily: 'Barlow Condensed',
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    hintBox: {
      borderRadius: 12,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: c.text,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 12,
    },
    hintText: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      lineHeight: 16,
    },
    editor: {
      minHeight: 280,
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      padding: 14,
      fontSize: 13,
      color: c.text,
      fontFamily: 'DM Sans',
      lineHeight: 19,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    capWarning: {
      fontSize: 11,
      fontFamily: 'DM Sans',
      marginTop: 8,
      lineHeight: 15,
    },
  });

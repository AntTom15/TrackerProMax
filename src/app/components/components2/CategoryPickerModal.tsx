import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ANIMAL_CATEGORIES,
  CATEGORY_ORDER,
  PLANT_CATEGORIES,
} from '../../lib/constants';
import { ThemeColors, useThemedStyles } from '../../lib/theme';

interface CategoryPickerModalProps {
  visible: boolean;
  // Header context, e.g. "Breakfast — food categories".
  title: string;
  subtitle?: string;
  selected: string[];
  onChange: (categories: string[]) => void;
  onClose: () => void;
}

// Full-screen multi-select over the canonical food categories. Quick
// sets cover the common cases (fasting = Plants + tap Shellfish) so
// nobody has to tap 22 chips one by one.
export default function CategoryPickerModal({
  visible,
  title,
  subtitle,
  selected,
  onChange,
  onClose,
}: CategoryPickerModalProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const selectedSet = new Set(selected);

  const toggle = (cat: string) => {
    if (selectedSet.has(cat)) onChange(selected.filter((x) => x !== cat));
    else onChange([...selected, cat]);
  };

  const quickSet = (cats: string[]) => {
    // Union with what's already selected, so "Plants" then "Shellfish"
    // (or Plants + Animal) composes instead of replacing.
    const merged = new Set([...selected, ...cats]);
    onChange(CATEGORY_ORDER.filter((cat) => merged.has(cat)));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          <Pressable onPress={onClose} style={styles.doneBtn} hitSlop={6}>
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>

        {/* Quick sets */}
        <View style={styles.quickRow}>
          <Pressable
            onPress={() => quickSet(PLANT_CATEGORIES)}
            style={styles.quickBtn}
          >
            <Text style={styles.quickBtnText}>+ Plants</Text>
          </Pressable>
          <Pressable
            onPress={() => quickSet(ANIMAL_CATEGORIES)}
            style={styles.quickBtn}
          >
            <Text style={styles.quickBtnText}>+ Animal</Text>
          </Pressable>
          <Pressable onPress={() => onChange([])} style={styles.quickBtn}>
            <Text style={styles.quickBtnText}>Clear</Text>
          </Pressable>
          <Text style={styles.count}>
            {selected.length === 0 ? 'Any' : `${selected.length} selected`}
          </Text>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.chipWrap}>
            {CATEGORY_ORDER.map((cat) => {
              const active = selectedSet.has(cat);
              return (
                <Pressable
                  key={cat}
                  onPress={() => toggle(cat)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
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
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
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
    doneBtn: {
      borderRadius: 10,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 16,
      paddingVertical: 8,
      shadowColor: c.shadow,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    doneBtnText: {
      fontSize: 12,
      fontWeight: '800',
      color: c.onAccent,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    quickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    quickBtn: {
      borderRadius: 10,
      backgroundColor: c.cardAlt,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    quickBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    count: {
      flex: 1,
      textAlign: 'right',
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      borderRadius: 12,
      borderWidth: 2,
      borderColor: c.border,
      backgroundColor: c.card,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    chipActive: {
      backgroundColor: c.accent,
      borderColor: c.text,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: c.textMuted,
      fontFamily: 'DM Sans',
    },
    chipTextActive: {
      color: c.onAccent,
      fontWeight: '700',
    },
  });

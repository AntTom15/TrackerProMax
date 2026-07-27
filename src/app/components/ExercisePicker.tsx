import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
} from 'react-native';
import { keyboardAwareScrollProps } from '../lib/keyboard';
import { Search, X } from './Icons';
import { MUSCLE_GROUPS } from '../lib/exerciseSeed';
import type { Exercise, MuscleGroup } from '../lib/types';
import { ThemeColors, useThemedStyles } from '../lib/theme';

interface ExercisePickerProps {
  exercises: Exercise[];
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
}

// Inline searchable exercise list with muscle-group filter chips.
export default function ExercisePicker({
  exercises,
  onSelect,
  onClose,
}: ExercisePickerProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);

  const filtered = exercises.filter((e) => {
    const q = query.toLowerCase();
    const matchesQuery =
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.muscles.some((m) => m.toLowerCase().includes(q)) ||
      e.equipment.toLowerCase().includes(q);
    const matchesMuscle = !muscle || e.muscles.includes(muscle);
    return matchesQuery && matchesMuscle;
  });

  // When a muscle filter is active, exercises that target it as their
  // PRIMARY muscle come first; alphabetical within each group.
  const sorted = [...filtered].sort((a, b) => {
    if (muscle) {
      const ap = a.muscles[0] === muscle ? 0 : 1;
      const bp = b.muscles[0] === muscle ? 0 : 1;
      if (ap !== bp) return ap - bp;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.searchContainer}>
          <Search size={14} color={c.textMuted} />
          <TextInput
            placeholder="Search exercises..."
            value={query}
            onChangeText={setQuery}
            placeholderTextColor={c.textMuted}
            style={styles.searchInput}
            autoFocus
          />
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
          <X size={16} color={c.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chips}
        contentContainerStyle={{ gap: 8, paddingRight: 12, alignItems: 'center' }}
      >
        {MUSCLE_GROUPS.map((m) => (
          <Pressable
            key={m}
            onPress={() => setMuscle(muscle === m ? null : m)}
            style={[styles.chip, muscle === m && styles.chipActive]}
          >
            <Text style={[styles.chipText, muscle === m && styles.chipTextActive]}>
              {m}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        {...keyboardAwareScrollProps}
        style={styles.list}
        nestedScrollEnabled
      >
        {sorted.map((e) => {
          // Filtered muscle is only a secondary target for this exercise.
          const isSecondary = !!muscle && e.muscles[0] !== muscle;
          return (
            <Pressable
              key={e.id}
              onPress={() => onSelect(e)}
              style={[styles.row, isSecondary && styles.rowSecondary]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{e.name}</Text>
                <Text style={styles.rowMeta}>
                  <Text style={styles.rowMetaPrimary}>{e.muscles[0]}</Text>
                  {e.muscles.length > 1 ? ' · ' + e.muscles.slice(1).join(' · ') : ''} · {e.equipment}
                </Text>
              </View>
              {isSecondary && <Text style={styles.secondaryBadge}>2nd</Text>}
              {e.kind === 'cardio' && <Text style={styles.cardioBadge}>Cardio</Text>}
            </Pressable>
          );
        })}
        {sorted.length === 0 && (
          <Text style={styles.empty}>No exercises match</Text>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: c.text,
    backgroundColor: c.surface,
    padding: 12,
    marginTop: 8,
    maxHeight: 360,
    shadowColor: c.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: c.card,
    borderWidth: 2,
    borderColor: c.text,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: c.text,
    fontSize: 13,
    fontFamily: 'DM Sans',
    padding: 0,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: {
    marginTop: 10,
    flexGrow: 0,
    height: 48,
  },
  chip: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: c.cardAlt,
    borderWidth: 2,
    borderColor: c.text,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: c.accent,
  },
  chipText: {
    fontSize: 13,
    lineHeight: 16,
    color: c.textSoft,
    fontWeight: '700',
    fontFamily: 'Barlow Condensed',
    flexShrink: 0,
  },
  chipTextActive: {
    color: c.onAccent,
  },
  list: {
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: c.cardAlt,
  },
  rowSecondary: {
    opacity: 0.75,
  },
  secondaryBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: c.textMuted,
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    backgroundColor: c.cardAlt,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  rowName: {
    fontSize: 13,
    color: c.text,
    fontFamily: 'DM Sans',
  },
  rowMeta: {
    fontSize: 10,
    color: c.textMuted,
    fontFamily: 'DM Sans',
    marginTop: 1,
  },
  rowMetaPrimary: {
    color: c.text,
    fontWeight: '700',
  },
  cardioBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: c.text,
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    backgroundColor: 'rgba(96,165,250,0.2)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  empty: {
    fontSize: 12,
    color: c.textMuted,
    fontFamily: 'DM Sans',
    textAlign: 'center',
    padding: 14,
  },
});

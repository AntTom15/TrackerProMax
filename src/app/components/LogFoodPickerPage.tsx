import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { format } from 'date-fns';
import { ChevronLeft, Search, Plus } from './Icons';
import { CATEGORY_ORDER } from '../lib/constants';
import { ThemeColors, useThemedStyles } from '../lib/theme';
import type { Food, MealName } from '../lib/types';

interface LogFoodPickerPageProps {
  foods: Food[];
  pantryIds: string[];
  onAddEntry: (entry: {
    date: string;
    meal: MealName;
    foodId: string;
    servings: number;
  }) => void;
}

// Pantry-first food selection for the meal logger. The pantry IS the
// user's real-world food inventory, so it's the default source; the
// full database is one toggle away.
export default function LogFoodPickerPage({
  foods,
  pantryIds,
  onAddEntry,
}: LogFoodPickerPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as
    | { meal?: MealName; date?: string }
    | undefined;
  const meal = params?.meal ?? 'Breakfast';
  const date = params?.date ?? format(new Date(), 'yyyy-MM-dd');

  const [query, setQuery] = useState('');
  const [source, setSource] = useState<'pantry' | 'all'>('pantry');

  const pantrySet = new Set(pantryIds);
  const pool = source === 'pantry' ? foods.filter((f) => pantrySet.has(f.id)) : foods;
  const q = query.toLowerCase();
  const visible = pool.filter(
    (f) => !q || f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)
  );

  // Group by category in the canonical order. Inside each category,
  // pantry items are elevated to the top, then alphabetical.
  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: visible
      .filter((f) => f.category === cat)
      .sort((a, b) => {
        const ap = pantrySet.has(a.id) ? 0 : 1;
        const bp = pantrySet.has(b.id) ? 0 : 1;
        return ap - bp || a.name.localeCompare(b.name);
      }),
  })).filter((g) => g.items.length > 0);

  const pick = (foodId: string) => {
    onAddEntry({ date, meal, foodId, servings: 1 });
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ChevronLeft size={22} color={c.textMuted} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Add to {meal}</Text>
          <Text style={styles.subtitle}>Tap a food to log 1 serving</Text>
        </View>
        {/* Source toggle */}
        <View style={styles.sourceToggle}>
          {(['pantry', 'all'] as const).map((s) => (
            <Pressable
              key={s}
              onPress={() => setSource(s)}
              style={[styles.sourceBtn, source === s && styles.sourceBtnActive]}
            >
              <Text
                style={[
                  styles.sourceBtnText,
                  source === s && styles.sourceBtnTextActive,
                ]}
              >
                {s === 'pantry' ? 'Pantry' : 'All'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={16} color={c.textMuted} />
        <TextInput
          placeholder={
            source === 'pantry' ? 'Search your pantry...' : 'Search all foods...'
          }
          value={query}
          onChangeText={setQuery}
          placeholderTextColor={c.textMuted}
          style={styles.searchInput}
        />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {grouped.length === 0 && (
          <Text style={styles.emptyText}>
            {source === 'pantry'
              ? 'Nothing in your pantry matches — try "All", or stock your Pantry first.'
              : 'No foods match your search.'}
          </Text>
        )}

        {grouped.map(({ cat, items }) => (
          <View key={cat} style={styles.section}>
            <Text style={styles.sectionTitle}>{cat}</Text>
            {items.map((food) => (
              <Pressable
                key={food.id}
                onPress={() => pick(food.id)}
                style={styles.row}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{food.name}</Text>
                  <Text style={styles.rowMeta}>
                    {food.servingLabel} ·{' '}
                    {Math.round(food.nutrients?.calories ?? 0)} kcal ·{' '}
                    {Math.round(food.nutrients?.protein ?? 0)}g protein
                  </Text>
                </View>
                {source === 'all' && pantrySet.has(food.id) && (
                  <Text style={styles.pantryBadge}>Pantry</Text>
                )}
                <View style={styles.addIcon}>
                  <Plus size={14} color={c.onAccent} />
                </View>
              </Pressable>
            ))}
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
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
    sourceToggle: {
      flexDirection: 'row',
      gap: 4,
      backgroundColor: c.cardAlt,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: c.text,
      padding: 3,
    },
    sourceBtn: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 8,
    },
    sourceBtnActive: {
      backgroundColor: c.accent,
    },
    sourceBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    sourceBtnTextActive: {
      color: c.onAccent,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: 20,
      marginBottom: 12,
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    searchInput: {
      flex: 1,
      color: c.text,
      fontSize: 14,
      fontFamily: 'DM Sans',
      padding: 0,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    section: {
      marginBottom: 14,
    },
    sectionTitle: {
      fontSize: 10,
      letterSpacing: 0.8,
      color: c.text,
      fontWeight: '700',
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 6,
    },
    rowName: {
      fontSize: 14,
      color: c.text,
      fontWeight: '500',
      fontFamily: 'DM Sans',
    },
    rowMeta: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      marginTop: 2,
    },
    pantryBadge: {
      fontSize: 9,
      fontWeight: '800',
      color: c.onAccent,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      backgroundColor: c.accent,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      overflow: 'hidden',
    },
    addIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      textAlign: 'center',
      color: c.textMuted,
      fontSize: 13,
      fontFamily: 'DM Sans',
      marginVertical: 24,
      paddingHorizontal: 20,
    },
  });

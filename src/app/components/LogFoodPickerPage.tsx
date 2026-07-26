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
import NumericInput from './components2/NumericInput';

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

const GRAMS_PER_OZ = 28.3495;

type AmountUnit = 'servings' | 'g' | 'oz';

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

  // Inline amount editor: which row is expanded, the typed amount, and
  // its unit. Weight units are only offered when the food's serving
  // weight is known (needed for the conversion).
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [amount, setAmount] = useState('1');
  const [unit, setUnit] = useState<AmountUnit>('servings');

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

  const logServings = (foodId: string, servings: number) => {
    onAddEntry({ date, meal, foodId, servings });
    navigation.goBack();
  };

  const toggleExpand = (food: Food) => {
    if (expandedId === food.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(food.id);
    setAmount('1');
    setUnit('servings');
  };

  // Convert the typed amount into servings for the given food.
  // Returns NaN when the input isn't usable yet.
  const toServings = (food: Food): number => {
    const val = parseFloat(amount);
    if (!isFinite(val) || val <= 0) return NaN;
    if (unit === 'servings') return val;
    const grams = unit === 'oz' ? val * GRAMS_PER_OZ : val;
    const per = food.servingWeightGrams;
    if (!per || per <= 0) return NaN;
    return grams / per;
  };

  const confirmAmount = (food: Food) => {
    const sv = toServings(food);
    if (!isFinite(sv)) return;
    // 3 decimals is plenty of precision and keeps stored values tidy.
    logServings(food.id, Math.round(sv * 1000) / 1000);
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
          <Text style={styles.subtitle}>
            Tap a food for exact amounts · + logs 1 serving
          </Text>
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
            {items.map((food) => {
              const expanded = expandedId === food.id;
              const sv = expanded ? toServings(food) : NaN;
              const hasWeight = (food.servingWeightGrams ?? 0) > 0;
              const units: AmountUnit[] = hasWeight
                ? ['servings', 'g', 'oz']
                : ['servings'];
              return (
                <View key={food.id}>
                  <Pressable
                    onPress={() => toggleExpand(food)}
                    style={[styles.row, expanded && styles.rowExpanded]}
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
                    {/* Quick add: the + always logs exactly 1 serving */}
                    <Pressable
                      onPress={() => logServings(food.id, 1)}
                      style={styles.addIcon}
                      hitSlop={6}
                    >
                      <Plus size={14} color={c.onAccent} />
                    </Pressable>
                  </Pressable>

                  {/* Inline amount editor */}
                  {expanded && (
                    <View style={styles.amountCard}>
                      <View style={styles.amountRow}>
                        <NumericInput
                          value={amount}
                          onChangeText={setAmount}
                          placeholder="Amount"
                          placeholderTextColor={c.textFaint}
                          autoFocus
                          selectTextOnFocus
                          style={styles.amountInput}
                        />
                        <View style={styles.unitToggle}>
                          {units.map((u) => (
                            <Pressable
                              key={u}
                              onPress={() => setUnit(u)}
                              style={[
                                styles.unitBtn,
                                unit === u && styles.unitBtnActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.unitBtnText,
                                  unit === u && styles.unitBtnTextActive,
                                ]}
                              >
                                {u === 'servings' ? 'serv' : u}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      <View style={styles.amountFooter}>
                        <Text style={styles.amountPreview}>
                          {isFinite(sv)
                            ? `= ${Math.round(sv * 100) / 100} × ${food.servingLabel} · ${Math.round(
                                (food.nutrients?.calories ?? 0) * sv
                              )} kcal · ${Math.round(
                                (food.nutrients?.protein ?? 0) * sv
                              )}g protein`
                            : unit === 'servings'
                              ? 'Enter an amount'
                              : 'Enter a weight'}
                        </Text>
                        <Pressable
                          onPress={() => confirmAmount(food)}
                          style={[
                            styles.logBtn,
                            !isFinite(sv) && { opacity: 0.4 },
                          ]}
                        >
                          <Text style={styles.logBtnText}>Log</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
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
    rowExpanded: {
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      marginBottom: 0,
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
    // Attached editor panel under the expanded row
    amountCard: {
      borderRadius: 12,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      backgroundColor: c.cardAlt,
      borderWidth: 2,
      borderTopWidth: 0,
      borderColor: c.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 6,
    },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    amountInput: {
      flex: 1,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 12,
      paddingVertical: 7,
      fontSize: 14,
      color: c.text,
      fontFamily: 'DM Sans',
    },
    unitToggle: {
      flexDirection: 'row',
      gap: 4,
      backgroundColor: c.surface,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.text,
      padding: 2,
    },
    unitBtn: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 7,
    },
    unitBtnActive: {
      backgroundColor: c.accent,
    },
    unitBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    unitBtnTextActive: {
      color: c.onAccent,
    },
    amountFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginTop: 8,
    },
    amountPreview: {
      flex: 1,
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
    },
    logBtn: {
      borderRadius: 10,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 16,
      paddingVertical: 7,
      shadowColor: c.shadow,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    logBtnText: {
      fontSize: 12,
      fontWeight: '800',
      color: c.onAccent,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
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

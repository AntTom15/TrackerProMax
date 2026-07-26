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
import { format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Search, Sparkles, X } from './Icons';
import { NUTRIENT_SECTIONS, nutrientAmount } from '../lib/nutrients';
import { ThemeColors, useThemedStyles } from '../lib/theme';
import NumericInput from './components2/NumericInput';
import { fmtPlannedAmount, mealTotals } from '../lib/mealPlanner';
import type {
  Food,
  MealPlan,
  Nutrients,
  PlannedItem,
  PlannedMeal,
} from '../lib/types';

interface MealPlanDetailPageProps {
  foods: Food[];
  pantryIds: string[];
  plan: MealPlan | null;
  onSetPlan: (plan: MealPlan) => void;
}

// Detail + editing for one generated meal: adjust amounts (in grams
// where possible), remove or add foods, see the meal's full nutrient
// profile, and tap through to each food's page.
export default function MealPlanDetailPage({
  foods,
  pantryIds,
  plan,
  onSetPlan,
}: MealPlanDetailPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const navigation = useNavigation();
  const route = useRoute();
  const { date, slotId } = (route.params ?? {}) as {
    date?: string;
    slotId?: string;
  };

  const foodById = new Map(foods.map((f) => [f.id, f]));
  const pantrySet = new Set(pantryIds);

  const day = plan?.days.find((d) => d.date === date);
  const meal = day?.meals.find((m) => m.slotId === slotId);

  // Amount edit state: which item, and the text being typed.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  // Add-food search.
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');

  if (!plan || !day || !meal) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}
          >
            <ChevronLeft size={22} color={c.textMuted} />
          </Pressable>
          <Text style={styles.title}>Meal</Text>
        </View>
        <Text style={styles.emptyText}>
          This meal is no longer in the current plan.
        </Text>
      </View>
    );
  }

  const updateMeal = (mutate: (m: PlannedMeal) => PlannedMeal) => {
    onSetPlan({
      ...plan,
      days: plan.days.map((d) =>
        d.date !== date
          ? d
          : {
              ...d,
              meals: d.meals.map((m) => (m.slotId !== slotId ? m : mutate(m))),
            }
      ),
    });
  };

  const removeItem = (foodId: string) =>
    updateMeal((m) => ({
      ...m,
      items: m.items.filter((it) => it.foodId !== foodId),
    }));

  const startEdit = (item: PlannedItem, food: Food) => {
    setEditingId(item.foodId);
    const g = food.servingWeightGrams;
    setEditText(
      g && g > 0
        ? String(Math.round(item.servings * g))
        : String(Math.round(item.servings * 100) / 100)
    );
  };

  const commitEdit = (item: PlannedItem, food: Food) => {
    setEditingId(null);
    const val = parseFloat(editText);
    if (!isFinite(val) || val < 0) return;
    const g = food.servingWeightGrams;
    const servings = g && g > 0 ? val / g : val;
    if (servings <= 0) {
      removeItem(item.foodId);
      return;
    }
    updateMeal((m) => ({
      ...m,
      items: m.items.map((it) =>
        it.foodId === item.foodId
          ? { ...it, servings: Math.round(servings * 1000) / 1000 }
          : it
      ),
    }));
  };

  const addFood = (food: Food) => {
    if (meal.items.some((it) => it.foodId === food.id)) return;
    updateMeal((m) => ({
      ...m,
      items: [...m.items, { foodId: food.id, servings: 1 }],
    }));
    setAdding(false);
    setQuery('');
  };

  // Add-food candidates: pantry first, then everything else.
  const q = query.toLowerCase();
  const inMeal = new Set(meal.items.map((it) => it.foodId));
  const addCandidates = q
    ? foods
        .filter(
          (f) =>
            !inMeal.has(f.id) &&
            (f.name.toLowerCase().includes(q) ||
              f.category.toLowerCase().includes(q))
        )
        .sort((a, b) => {
          const ap = pantrySet.has(a.id) ? 0 : 1;
          const bp = pantrySet.has(b.id) ? 0 : 1;
          return ap - bp || a.name.localeCompare(b.name);
        })
        .slice(0, 12)
    : [];

  // Meal totals for the nutrient summary.
  const totals: Nutrients = {};
  for (const it of meal.items) {
    const food = foodById.get(it.foodId);
    if (!food) continue;
    for (const [k, v] of Object.entries(food.nutrients ?? {})) {
      if (typeof v !== 'number') continue;
      (totals as any)[k] = ((totals as any)[k] ?? 0) + v * it.servings;
    }
  }
  const mt = mealTotals(meal, foodById);

  const dateLabel = format(parseISO(day.date), 'EEE, MMM d');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ChevronLeft size={22} color={c.textMuted} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{meal.slotName}</Text>
          <Text style={styles.subtitle}>
            {dateLabel} · logs to {meal.meal}
            {day.restrictionName ? ` · ${day.restrictionName}` : ''}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Macro hero */}
        <View style={styles.macroCard}>
          <View style={styles.macroHero}>
            <Text style={styles.macroHeroValue}>
              {Math.round(mt.calories)}
            </Text>
            <Text style={styles.macroHeroUnit}>kcal</Text>
          </View>
          <View style={styles.macroRow}>
            {(
              [
                ['Protein', mt.protein],
                ['Carbs', mt.carbs],
                ['Fat', mt.fat],
              ] as const
            ).map(([label, v]) => (
              <View key={label} style={styles.macro}>
                <Text style={styles.macroValue}>{Math.round(v)}g</Text>
                <Text style={styles.macroLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Foods — tap name for profile, tap amount to edit */}
        <Text style={styles.sectionTitle}>Foods</Text>
        {meal.items.map((item) => {
          const food = foodById.get(item.foodId);
          if (!food) return null;
          const cals = (food.nutrients?.calories ?? 0) * item.servings;
          const hasWeight = (food.servingWeightGrams ?? 0) > 0;
          return (
            <View key={item.foodId} style={styles.itemRow}>
              {item.recommended && (
                <Sparkles size={12} color={c.accentDeep} />
              )}
              {editingId === item.foodId ? (
                <View style={styles.amountEditWrap}>
                  <NumericInput
                    value={editText}
                    onChangeText={setEditText}
                    autoFocus
                    selectTextOnFocus
                    onBlur={() => commitEdit(item, food)}
                    onSubmitEditing={() => commitEdit(item, food)}
                    style={styles.amountInput}
                  />
                  <Text style={styles.amountUnit}>
                    {hasWeight ? 'g' : 'srv'}
                  </Text>
                </View>
              ) : (
                <Pressable onPress={() => startEdit(item, food)} hitSlop={4}>
                  <Text style={styles.itemAmount}>
                    {fmtPlannedAmount(food, item.servings)}
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() =>
                  (navigation as any).navigate('FoodDetail', {
                    foodId: food.id,
                  })
                }
                style={styles.itemNameWrap}
                hitSlop={4}
              >
                <Text style={styles.itemName} numberOfLines={1}>
                  {food.name}
                </Text>
                <ChevronRight size={12} color={c.textFaint} />
              </Pressable>
              <Text style={styles.itemCals}>{Math.round(cals)}</Text>
              <Pressable
                onPress={() => removeItem(item.foodId)}
                style={styles.itemRemove}
                hitSlop={6}
              >
                <X size={11} color={c.textMuted} />
              </Pressable>
            </View>
          );
        })}

        {/* Add food */}
        {adding ? (
          <View style={styles.addCard}>
            <View style={styles.searchRow}>
              <Search size={14} color={c.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search foods..."
                placeholderTextColor={c.textFaint}
                autoFocus
                style={styles.searchInput}
              />
              <Pressable
                onPress={() => {
                  setAdding(false);
                  setQuery('');
                }}
                hitSlop={6}
              >
                <X size={14} color={c.textMuted} />
              </Pressable>
            </View>
            {addCandidates.map((food) => (
              <Pressable
                key={food.id}
                onPress={() => addFood(food)}
                style={styles.addRow}
              >
                <Text style={styles.addRowName} numberOfLines={1}>
                  {food.name}
                </Text>
                {pantrySet.has(food.id) && (
                  <Text style={styles.pantryBadge}>Pantry</Text>
                )}
                <Plus size={12} color={c.textMuted} />
              </Pressable>
            ))}
            {q.length > 0 && addCandidates.length === 0 && (
              <Text style={styles.emptyText}>No foods match.</Text>
            )}
          </View>
        ) : (
          <Pressable onPress={() => setAdding(true)} style={styles.addBtn}>
            <Plus size={14} color={c.textMuted} />
            <Text style={styles.addBtnText}>Add food</Text>
          </Pressable>
        )}

        {/* Nutrient summary */}
        <Text style={styles.sectionTitle}>Nutrition</Text>
        {NUTRIENT_SECTIONS.map((section) => (
          <View key={section.title} style={styles.nutrientCard}>
            <Text style={styles.nutrientSectionTitle}>{section.title}</Text>
            {section.items.map((info) => {
              const amount = nutrientAmount(info, totals);
              const pct = info.rda ? amount / info.rda : null;
              return (
                <View key={info.key} style={styles.nutrientRow}>
                  <Text style={styles.nutrientLabel} numberOfLines={1}>
                    {info.label}
                  </Text>
                  <View style={styles.nutrientRight}>
                    <Text style={styles.nutrientValue}>
                      {Math.round(amount * 10) / 10}
                      {info.unit}
                      {pct != null ? ` · ${Math.round(pct * 100)}%` : ''}
                    </Text>
                    {pct != null && (
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              width: `${Math.min(100, Math.round(pct * 100))}%`,
                            },
                            pct >= 1 && { backgroundColor: c.accentDeep },
                          ]}
                        />
                      </View>
                    )}
                  </View>
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
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    macroCard: {
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 20,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    macroHero: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
    },
    macroHeroValue: {
      fontSize: 30,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
    },
    macroHeroUnit: {
      fontSize: 12,
      color: c.textMuted,
      fontFamily: 'DM Sans',
    },
    macroRow: {
      flexDirection: 'row',
      gap: 16,
    },
    macro: {
      alignItems: 'center',
    },
    macroValue: {
      fontSize: 14,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'Barlow Condensed',
    },
    macroLabel: {
      fontSize: 10,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    sectionTitle: {
      fontSize: 12,
      letterSpacing: 0.8,
      color: c.text,
      fontWeight: '700',
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 6,
    },
    itemAmount: {
      fontSize: 12,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      minWidth: 52,
    },
    amountEditWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    amountInput: {
      width: 58,
      borderRadius: 8,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 6,
      paddingVertical: 3,
      fontSize: 12,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      textAlign: 'center',
    },
    amountUnit: {
      fontSize: 10,
      fontWeight: '700',
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
    },
    itemNameWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    itemName: {
      flexShrink: 1,
      fontSize: 13,
      color: c.text,
      fontFamily: 'DM Sans',
    },
    itemCals: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
    },
    itemRemove: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.cardAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 12,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: c.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 16,
    },
    addBtnText: {
      fontSize: 13,
      color: c.textMuted,
      fontFamily: 'DM Sans',
    },
    addCard: {
      borderRadius: 12,
      backgroundColor: c.cardAlt,
      borderWidth: 2,
      borderColor: c.text,
      padding: 10,
      marginBottom: 16,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 10,
      paddingVertical: 7,
      marginBottom: 6,
    },
    searchInput: {
      flex: 1,
      fontSize: 13,
      color: c.text,
      fontFamily: 'DM Sans',
      padding: 0,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 6,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
    },
    addRowName: {
      flex: 1,
      fontSize: 13,
      color: c.text,
      fontFamily: 'DM Sans',
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
    nutrientCard: {
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      padding: 12,
      marginBottom: 10,
    },
    nutrientSectionTitle: {
      fontSize: 10,
      letterSpacing: 0.8,
      color: c.textMuted,
      fontWeight: '700',
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    nutrientRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingVertical: 3,
    },
    nutrientLabel: {
      flex: 1,
      fontSize: 12,
      color: c.text,
      fontFamily: 'DM Sans',
    },
    nutrientRight: {
      alignItems: 'flex-end',
      gap: 2,
      minWidth: 120,
    },
    nutrientValue: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
    },
    barTrack: {
      width: 120,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.cardAlt,
      overflow: 'hidden',
    },
    barFill: {
      height: 4,
      borderRadius: 2,
      backgroundColor: c.accent,
    },
    emptyText: {
      fontSize: 12,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      textAlign: 'center',
      marginVertical: 16,
    },
  });

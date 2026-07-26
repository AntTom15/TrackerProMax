import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { format, parseISO, isToday } from 'date-fns';
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Plus,
  X,
} from './Icons';
import { MEALS } from '../lib/constants';
import { ThemeColors, useThemedStyles } from '../lib/theme';
import NumericInput from './components2/NumericInput';
import {
  ARCHETYPE_LABELS,
  dayMicroCoverage,
  dayTotals,
  generatePlan,
  mealTotals,
} from '../lib/mealPlanner';
import type {
  Food,
  MealName,
  MealPlan,
  MealSlot,
  PlannedMeal,
  PlannerSettings,
  SlotArchetype,
} from '../lib/types';

interface MealPlannerPageProps {
  foods: Food[];
  pantryIds: string[];
  settings: PlannerSettings;
  onChangeSettings: (patch: Partial<PlannerSettings>) => void;
  plan: MealPlan | null;
  onSetPlan: (plan: MealPlan) => void;
  onAddEntry: (entry: {
    date: string;
    meal: MealName;
    foodId: string;
    servings: number;
  }) => void;
}

const ARCHETYPES: SlotArchetype[] = [
  'carb-lean',
  'fatty',
  'high-protein',
  'balanced',
];

const HORIZONS = [
  { label: 'Day', days: 1 },
  { label: 'Week', days: 7 },
  { label: 'Month', days: 28 },
] as const;

// The planner turns your pantry + a day template into concrete meals
// with real amounts. Deterministic rules engine under the hood — see
// lib/mealPlanner.ts. Generation is manual (button), never automatic.
export default function MealPlannerPage({
  foods,
  pantryIds,
  settings,
  onChangeSettings,
  plan,
  onSetPlan,
  onAddEntry,
}: MealPlannerPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const navigation = useNavigation();

  const foodById = new Map(foods.map((f) => [f.id, f]));

  const [setupOpen, setSetupOpen] = useState(!plan || plan.days.length === 0);
  const [horizonDays, setHorizonDays] = useState<1 | 7 | 28>(1);
  const [warnings, setWarnings] = useState<string[]>([]);
  // Which plan days are expanded; day 0 starts open.
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  // Meals already logged this visit (slotId|date), to disable the button.
  const [loggedMeals, setLoggedMeals] = useState<Record<string, boolean>>({});

  // Local text mirrors for the numeric fields (commit on change).
  const [calText, setCalText] = useState(
    settings.calorieTarget > 0 ? String(settings.calorieTarget) : ''
  );
  const [pText, setPText] = useState(
    settings.proteinPct != null ? String(settings.proteinPct) : ''
  );
  const [cText, setCText] = useState(
    settings.carbPct != null ? String(settings.carbPct) : ''
  );
  const [fText, setFText] = useState(
    settings.fatPct != null ? String(settings.fatPct) : ''
  );

  const commitCalories = (t: string) => {
    setCalText(t);
    const v = parseInt(t, 10);
    onChangeSettings({ calorieTarget: isFinite(v) && v > 0 ? v : 0 });
  };
  const commitPct = (
    t: string,
    setText: (s: string) => void,
    key: 'proteinPct' | 'carbPct' | 'fatPct'
  ) => {
    setText(t);
    const v = parseInt(t, 10);
    onChangeSettings({
      [key]: isFinite(v) && v > 0 && v <= 100 ? v : null,
    } as Partial<PlannerSettings>);
  };

  // ---- slot editing ----
  const updateSlot = (slotId: string, patch: Partial<MealSlot>) => {
    onChangeSettings({
      slots: settings.slots.map((s) =>
        s.id === slotId ? { ...s, ...patch } : s
      ),
    });
  };
  const removeSlot = (slotId: string) => {
    onChangeSettings({
      slots: settings.slots.filter((s) => s.id !== slotId),
    });
  };
  const addSlot = () => {
    if (settings.slots.length >= 6) return;
    const id = `slot${Date.now()}`;
    onChangeSettings({
      slots: [
        ...settings.slots,
        { id, name: 'Meal', meal: 'Snacks', archetype: 'balanced' },
      ],
    });
  };
  const cycleMeal = (slot: MealSlot) => {
    const idx = MEALS.indexOf(slot.meal);
    updateSlot(slot.id, { meal: MEALS[(idx + 1) % MEALS.length] });
  };

  // ---- generation ----
  const generate = () => {
    const seed = Math.floor(Math.random() * 1e9);
    const { plan: newPlan, warnings: w } = generatePlan(
      foods,
      pantryIds,
      settings,
      new Date(),
      horizonDays,
      seed
    );
    setWarnings(w);
    if (newPlan.days.length > 0) {
      onSetPlan(newPlan);
      setOpenDays({ [newPlan.days[0].date]: true });
      setLoggedMeals({});
      setSetupOpen(false);
    }
  };

  const logMeal = (date: string, meal: PlannedMeal) => {
    for (const item of meal.items) {
      onAddEntry({
        date,
        meal: meal.meal,
        foodId: item.foodId,
        servings: item.servings,
      });
    }
    setLoggedMeals((prev) => ({ ...prev, [`${meal.slotId}|${date}`]: true }));
  };

  const fmtAmount = (servings: number) =>
    String(Math.round(servings * 100) / 100);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ChevronLeft size={22} color={c.textMuted} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Meal Planner</Text>
          <Text style={styles.subtitle}>
            Your day, planned from your pantry
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* ---- Day template / targets ---- */}
        <Pressable
          onPress={() => setSetupOpen((o) => !o)}
          style={styles.sectionHeader}
          hitSlop={4}
        >
          <Text style={styles.sectionTitle}>Day Template</Text>
          {setupOpen ? (
            <ChevronUp size={16} color={c.textMuted} />
          ) : (
            <ChevronDown size={16} color={c.textMuted} />
          )}
        </Pressable>

        {setupOpen && (
          <View style={styles.setupCard}>
            {/* Calorie target */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Daily calories</Text>
              <NumericInput
                value={calText}
                onChangeText={commitCalories}
                placeholder="e.g. 2800"
                placeholderTextColor={c.textFaint}
                style={styles.fieldInput}
              />
            </View>

            {/* Optional macro percents */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Macros %</Text>
              <View style={styles.macroInputs}>
                {(
                  [
                    ['P', pText, setPText, 'proteinPct'],
                    ['C', cText, setCText, 'carbPct'],
                    ['F', fText, setFText, 'fatPct'],
                  ] as const
                ).map(([label, text, setText, key]) => (
                  <View key={key} style={styles.macroInputWrap}>
                    <Text style={styles.macroInputLabel}>{label}</Text>
                    <NumericInput
                      value={text}
                      onChangeText={(t: string) => commitPct(t, setText, key)}
                      placeholder="—"
                      placeholderTextColor={c.textFaint}
                      style={styles.macroInput}
                    />
                  </View>
                ))}
              </View>
            </View>
            <Text style={styles.hint}>
              Macros are optional and matched loosely — calories are the hard
              target.
            </Text>

            {/* Slots */}
            {settings.slots.map((slot) => (
              <View key={slot.id} style={styles.slotCard}>
                <View style={styles.slotTopRow}>
                  <TextInput
                    value={slot.name}
                    onChangeText={(t) => updateSlot(slot.id, { name: t })}
                    placeholder="Meal name"
                    placeholderTextColor={c.textFaint}
                    style={styles.slotNameInput}
                  />
                  <Pressable
                    onPress={() => cycleMeal(slot)}
                    style={styles.mealChip}
                    hitSlop={4}
                  >
                    <Text style={styles.mealChipText}>{slot.meal}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => removeSlot(slot.id)}
                    style={styles.slotRemove}
                    hitSlop={4}
                  >
                    <X size={12} color={c.textMuted} />
                  </Pressable>
                </View>
                <View style={styles.archetypeRow}>
                  {ARCHETYPES.map((a) => (
                    <Pressable
                      key={a}
                      onPress={() => updateSlot(slot.id, { archetype: a })}
                      style={[
                        styles.archetypeChip,
                        slot.archetype === a && styles.archetypeChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.archetypeChipText,
                          slot.archetype === a &&
                            styles.archetypeChipTextActive,
                        ]}
                      >
                        {ARCHETYPE_LABELS[a]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}

            <Pressable onPress={addSlot} style={styles.addSlotBtn}>
              <Plus size={14} color={c.textMuted} />
              <Text style={styles.addSlotText}>Add meal slot</Text>
            </Pressable>
          </View>
        )}

        {/* ---- Generate ---- */}
        <View style={styles.generateRow}>
          <View style={styles.horizonToggle}>
            {HORIZONS.map((h) => (
              <Pressable
                key={h.label}
                onPress={() => setHorizonDays(h.days)}
                style={[
                  styles.horizonBtn,
                  horizonDays === h.days && styles.horizonBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.horizonBtnText,
                    horizonDays === h.days && styles.horizonBtnTextActive,
                  ]}
                >
                  {h.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={generate} style={styles.generateBtn}>
            <Text style={styles.generateBtnText}>
              {plan && plan.days.length > 0 ? 'Regenerate' : 'Generate'}
            </Text>
          </Pressable>
        </View>

        {warnings.map((w, i) => (
          <Text key={i} style={styles.warning}>
            {w}
          </Text>
        ))}

        {/* ---- Plan ---- */}
        {plan &&
          plan.days.map((day) => {
            const open = !!openDays[day.date];
            const t = dayTotals(day, foodById);
            const cov = dayMicroCoverage(day, foodById);
            const dateObj = parseISO(day.date);
            const label = isToday(dateObj)
              ? 'Today'
              : format(dateObj, 'EEE, MMM d');
            return (
              <View key={day.date} style={styles.daySection}>
                <Pressable
                  onPress={() =>
                    setOpenDays((prev) => ({ ...prev, [day.date]: !open }))
                  }
                  style={styles.dayHeader}
                  hitSlop={4}
                >
                  <Text style={styles.dayTitle}>{label}</Text>
                  <View style={styles.dayHeaderRight}>
                    <Text style={styles.dayMeta}>
                      {Math.round(t.calories)} kcal ·{' '}
                      {Math.round(cov * 100)}% micros
                    </Text>
                    {open ? (
                      <ChevronUp size={16} color={c.textMuted} />
                    ) : (
                      <ChevronDown size={16} color={c.textMuted} />
                    )}
                  </View>
                </Pressable>

                {open && (
                  <>
                    {day.meals.map((meal) => {
                      const mt = mealTotals(meal, foodById);
                      const loggedKey = `${meal.slotId}|${day.date}`;
                      const logged = !!loggedMeals[loggedKey];
                      return (
                        <View key={meal.slotId} style={styles.mealCard}>
                          <View style={styles.mealCardHeader}>
                            <Text style={styles.mealCardTitle}>
                              {meal.slotName}
                            </Text>
                            <Text style={styles.mealCardMeta}>
                              {Math.round(mt.calories)} kcal · P
                              {Math.round(mt.protein)} C{Math.round(mt.carbs)}{' '}
                              F{Math.round(mt.fat)}
                            </Text>
                          </View>
                          {meal.items.length === 0 && (
                            <Text style={styles.mealEmpty}>
                              No pantry foods fit this slot.
                            </Text>
                          )}
                          {meal.items.map((item) => {
                            const food = foodById.get(item.foodId);
                            if (!food) return null;
                            const cals =
                              (food.nutrients?.calories ?? 0) * item.servings;
                            return (
                              <View key={item.foodId} style={styles.itemRow}>
                                <Text style={styles.itemAmount}>
                                  {fmtAmount(item.servings)} ×{' '}
                                  {food.servingLabel}
                                </Text>
                                <Text
                                  style={styles.itemName}
                                  numberOfLines={1}
                                >
                                  {food.name}
                                </Text>
                                <Text style={styles.itemCals}>
                                  {Math.round(cals)}
                                </Text>
                              </View>
                            );
                          })}
                          {meal.items.length > 0 && (
                            <Pressable
                              onPress={() => logMeal(day.date, meal)}
                              disabled={logged}
                              style={[
                                styles.logMealBtn,
                                logged && styles.logMealBtnDone,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.logMealBtnText,
                                  logged && styles.logMealBtnTextDone,
                                ]}
                              >
                                {logged
                                  ? 'Logged ✓'
                                  : `Log to ${meal.meal}`}
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      );
                    })}
                  </>
                )}
              </View>
            );
          })}

        {!plan && (
          <Text style={styles.emptyText}>
            Set your calorie target, shape your day template, and hit
            Generate — the planner builds meals from your pantry so you never
            have to think about what to eat.
          </Text>
        )}

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
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
      marginTop: 4,
    },
    sectionTitle: {
      fontSize: 12,
      letterSpacing: 0.8,
      color: c.text,
      fontWeight: '700',
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
    },
    setupCard: {
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      padding: 12,
      marginBottom: 14,
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 8,
    },
    fieldLabel: {
      fontSize: 13,
      color: c.text,
      fontFamily: 'DM Sans',
      fontWeight: '500',
    },
    fieldInput: {
      width: 110,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 12,
      paddingVertical: 7,
      fontSize: 14,
      color: c.text,
      fontFamily: 'DM Sans',
      textAlign: 'center',
    },
    macroInputs: {
      flexDirection: 'row',
      gap: 6,
    },
    macroInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    macroInputLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
    },
    macroInput: {
      width: 44,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 6,
      paddingVertical: 7,
      fontSize: 13,
      color: c.text,
      fontFamily: 'DM Sans',
      textAlign: 'center',
    },
    hint: {
      fontSize: 10,
      color: c.textFaint,
      fontFamily: 'DM Sans',
      marginBottom: 10,
    },
    slotCard: {
      borderRadius: 12,
      backgroundColor: c.cardAlt,
      borderWidth: 2,
      borderColor: c.text,
      padding: 10,
      marginBottom: 8,
    },
    slotTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    slotNameInput: {
      flex: 1,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 13,
      color: c.text,
      fontFamily: 'DM Sans',
    },
    mealChip: {
      borderRadius: 10,
      backgroundColor: c.primary,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    mealChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: c.onPrimary,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    slotRemove: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    archetypeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    archetypeChip: {
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    archetypeChipActive: {
      backgroundColor: c.accent,
      borderColor: c.text,
    },
    archetypeChipText: {
      fontSize: 10,
      fontWeight: '700',
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    archetypeChipTextActive: {
      color: c.onAccent,
    },
    addSlotBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 12,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: c.text,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    addSlotText: {
      fontSize: 12,
      color: c.textMuted,
      fontFamily: 'DM Sans',
    },
    generateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    horizonToggle: {
      flex: 1,
      flexDirection: 'row',
      gap: 4,
      backgroundColor: c.cardAlt,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: c.text,
      padding: 3,
    },
    horizonBtn: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: 8,
      alignItems: 'center',
    },
    horizonBtnActive: {
      backgroundColor: c.primary,
    },
    horizonBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    horizonBtnTextActive: {
      color: c.onPrimary,
    },
    generateBtn: {
      borderRadius: 12,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 18,
      paddingVertical: 10,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    generateBtnText: {
      fontSize: 13,
      fontWeight: '800',
      color: c.onAccent,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    warning: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      marginBottom: 8,
    },
    daySection: {
      marginBottom: 12,
    },
    dayHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    dayTitle: {
      fontSize: 12,
      letterSpacing: 0.8,
      color: c.text,
      fontWeight: '700',
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
    },
    dayHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    dayMeta: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
      fontWeight: '600',
    },
    mealCard: {
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      padding: 12,
      marginBottom: 8,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    mealCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    mealCardTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    mealCardMeta: {
      fontSize: 10,
      color: c.textMuted,
      fontFamily: 'DM Sans',
    },
    mealEmpty: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 4,
    },
    itemAmount: {
      fontSize: 11,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      minWidth: 86,
    },
    itemName: {
      flex: 1,
      fontSize: 12,
      color: c.text,
      fontFamily: 'DM Sans',
    },
    itemCals: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
    },
    logMealBtn: {
      marginTop: 8,
      borderRadius: 10,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.text,
      paddingVertical: 8,
      alignItems: 'center',
    },
    logMealBtnDone: {
      backgroundColor: c.tintLime,
    },
    logMealBtnText: {
      fontSize: 12,
      fontWeight: '800',
      color: c.onAccent,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    logMealBtnTextDone: {
      color: c.text,
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

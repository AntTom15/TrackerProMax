import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { format, parseISO, isToday } from 'date-fns';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Plus,
  Sparkles,
  X,
} from './Icons';
import { MEALS, PLANT_CATEGORIES, WEEKDAY_LABELS } from '../lib/constants';
import { ThemeColors, useThemedStyles } from '../lib/theme';
import NumericInput from './components2/NumericInput';
import CategoryPickerModal from './components2/CategoryPickerModal';
import {
  ARCHETYPE_LABELS,
  dayMicroCoverage,
  dayTotals,
  effectiveSlotPcts,
  fmtPlannedAmount,
  generatePlan,
  mealTotals,
  periodMicroCoverage,
  suggestReplacement,
} from '../lib/mealPlanner';
import type {
  Food,
  MealName,
  MealPlan,
  MealSlot,
  PlannedMeal,
  PlannerSettings,
  RestrictedDay,
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

  // Legacy stored settings may predate restrictedDays.
  const restrictedDays = settings.restrictedDays ?? [];

  const [setupOpen, setSetupOpen] = useState(!plan || plan.days.length === 0);
  const [horizonDays, setHorizonDays] = useState<1 | 7 | 28>(1);
  const [warnings, setWarnings] = useState<string[]>([]);
  // Which entity the category picker subscreen is editing.
  const [pickerTarget, setPickerTarget] = useState<
    { kind: 'slot' | 'restriction'; id: string } | null
  >(null);
  // Local text mirrors for per-slot % inputs, keyed by slot id.
  const [pctTexts, setPctTexts] = useState<Record<string, string>>({});
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
  const commitSlotPct = (slot: MealSlot, t: string) => {
    setPctTexts((prev) => ({ ...prev, [slot.id]: t }));
    const v = parseInt(t, 10);
    updateSlot(slot.id, {
      caloriePct: isFinite(v) && v > 0 && v <= 100 ? v : null,
    });
  };

  // ---- restricted-day rules ----
  const updateRestriction = (id: string, patch: Partial<RestrictedDay>) => {
    onChangeSettings({
      restrictedDays: restrictedDays.map((r) =>
        r.id === id ? { ...r, ...patch } : r
      ),
    });
  };
  const removeRestriction = (id: string) => {
    onChangeSettings({
      restrictedDays: restrictedDays.filter((r) => r.id !== id),
    });
  };
  const addRestriction = () => {
    if (restrictedDays.length >= 4) return;
    onChangeSettings({
      restrictedDays: [
        ...restrictedDays,
        {
          id: `rd${Date.now()}`,
          name: 'Fast day',
          weekdays: [],
          // Plants pre-selected — the common fasting baseline; tweak in
          // the picker (e.g. add Shellfish).
          allowedCategories: [...PLANT_CATEGORIES],
        },
      ],
    });
  };
  const toggleWeekday = (rule: RestrictedDay, weekday: number) => {
    updateRestriction(rule.id, {
      weekdays: rule.weekdays.includes(weekday)
        ? rule.weekdays.filter((w) => w !== weekday)
        : [...rule.weekdays, weekday],
    });
  };

  // The entity currently in the category picker.
  const pickerSlot =
    pickerTarget?.kind === 'slot'
      ? settings.slots.find((s) => s.id === pickerTarget.id)
      : undefined;
  const pickerRule =
    pickerTarget?.kind === 'restriction'
      ? restrictedDays.find((r) => r.id === pickerTarget.id)
      : undefined;

  const slotPcts = effectiveSlotPcts(settings.slots);
  const categorySummary = (cats: string[] | undefined, emptyLabel: string) =>
    !cats || cats.length === 0
      ? emptyLabel
      : cats.length <= 2
        ? cats.join(', ')
        : `${cats[0]} +${cats.length - 1}`;

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

  // ---- recommendation rejection: X on a starred item ----
  // Rejected food ids per item slot, so "Yes" cycles never repeat.
  const [rejectedRecs, setRejectedRecs] = useState<Record<string, string[]>>(
    {}
  );
  const swapItem = (
    date: string,
    slotId: string,
    currentFoodId: string,
    pantryOnly: boolean
  ) => {
    if (!plan) return;
    const key = `${date}|${slotId}|${currentFoodId}`;
    const excludes = rejectedRecs[key] ?? [];
    const replacement = suggestReplacement(
      foods,
      pantryIds,
      settings,
      plan,
      date,
      slotId,
      currentFoodId,
      excludes,
      pantryOnly
    );
    if (!replacement) {
      Alert.alert(
        'No alternative found',
        pantryOnly
          ? 'Nothing in your pantry fits this spot — try stocking more foods.'
          : 'No other food fits this spot.'
      );
      return;
    }
    // Remember the rejected food under the REPLACEMENT's key so a
    // follow-up rejection keeps excluding the whole chain.
    setRejectedRecs((prev) => ({
      ...prev,
      [`${date}|${slotId}|${replacement.foodId}`]: [
        ...excludes,
        currentFoodId,
      ],
    }));
    onSetPlan({
      ...plan,
      days: plan.days.map((d) =>
        d.date !== date
          ? d
          : {
              ...d,
              meals: d.meals.map((m) =>
                m.slotId !== slotId
                  ? m
                  : {
                      ...m,
                      items: m.items.map((it) =>
                        it.foodId === currentFoodId ? replacement : it
                      ),
                    }
              ),
            }
      ),
    });
  };
  const rejectRecommendation = (
    date: string,
    slotId: string,
    foodId: string
  ) => {
    Alert.alert(
      'Recommended food',
      'Would you like another recommendation?',
      [
        {
          text: 'No — use my pantry',
          onPress: () => swapItem(date, slotId, foodId, true),
        },
        {
          text: 'Yes',
          onPress: () => swapItem(date, slotId, foodId, false),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
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
            {settings.slots.map((slot, si) => (
              <View key={slot.id} style={styles.slotCard}>
                <View style={styles.slotTopRow}>
                  <TextInput
                    value={slot.name}
                    onChangeText={(t) => updateSlot(slot.id, { name: t })}
                    placeholder="Meal name"
                    placeholderTextColor={c.textFaint}
                    style={styles.slotNameInput}
                  />
                  {/* Meal size: % of daily calories; blank = auto */}
                  <View style={styles.pctWrap}>
                    <NumericInput
                      value={
                        pctTexts[slot.id] ??
                        (typeof slot.caloriePct === 'number' &&
                        slot.caloriePct > 0
                          ? String(slot.caloriePct)
                          : '')
                      }
                      onChangeText={(t: string) => commitSlotPct(slot, t)}
                      placeholder={String(Math.round(slotPcts[si] ?? 0))}
                      placeholderTextColor={c.textFaint}
                      style={styles.pctInput}
                    />
                    <Text style={styles.pctSign}>%</Text>
                  </View>
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
                {/* Composition: which food categories build this meal */}
                <Pressable
                  onPress={() =>
                    setPickerTarget({ kind: 'slot', id: slot.id })
                  }
                  style={styles.categoriesRow}
                  hitSlop={4}
                >
                  <Text style={styles.categoriesLabel}>Foods</Text>
                  <Text style={styles.categoriesValue} numberOfLines={1}>
                    {categorySummary(slot.categories, 'Any — engine picks')}
                  </Text>
                  <ChevronDown size={14} color={c.textMuted} />
                </Pressable>
              </View>
            ))}

            <Pressable onPress={addSlot} style={styles.addSlotBtn}>
              <Plus size={14} color={c.textMuted} />
              <Text style={styles.addSlotText}>Add meal slot</Text>
            </Pressable>

            {/* ---- Restricted days ---- */}
            <Text style={styles.subsectionTitle}>Restricted Days</Text>
            <Text style={styles.hint}>
              On these weekdays only the allowed foods are planned — e.g. a
              fast day of plants + shellfish.
            </Text>
            {restrictedDays.map((rule) => (
              <View key={rule.id} style={styles.slotCard}>
                <View style={styles.slotTopRow}>
                  <TextInput
                    value={rule.name}
                    onChangeText={(t) =>
                      updateRestriction(rule.id, { name: t })
                    }
                    placeholder="Rule name"
                    placeholderTextColor={c.textFaint}
                    style={styles.slotNameInput}
                  />
                  <Pressable
                    onPress={() => removeRestriction(rule.id)}
                    style={styles.slotRemove}
                    hitSlop={4}
                  >
                    <X size={12} color={c.textMuted} />
                  </Pressable>
                </View>
                <View style={styles.weekdayRow}>
                  {WEEKDAY_LABELS.map((label, wd) => {
                    const active = rule.weekdays.includes(wd);
                    return (
                      <Pressable
                        key={wd}
                        onPress={() => toggleWeekday(rule, wd)}
                        style={[
                          styles.weekdayChip,
                          active && styles.weekdayChipActive,
                        ]}
                        hitSlop={2}
                      >
                        <Text
                          style={[
                            styles.weekdayChipText,
                            active && styles.weekdayChipTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable
                  onPress={() =>
                    setPickerTarget({ kind: 'restriction', id: rule.id })
                  }
                  style={styles.categoriesRow}
                  hitSlop={4}
                >
                  <Text style={styles.categoriesLabel}>Allowed</Text>
                  <Text style={styles.categoriesValue} numberOfLines={1}>
                    {rule.allowedCategories.length === 0
                      ? 'Nothing selected yet'
                      : `${rule.allowedCategories.length} categories`}
                  </Text>
                  <ChevronDown size={14} color={c.textMuted} />
                </Pressable>
              </View>
            ))}
            <Pressable onPress={addRestriction} style={styles.addSlotBtn}>
              <Plus size={14} color={c.textMuted} />
              <Text style={styles.addSlotText}>Add restricted day</Text>
            </Pressable>
          </View>
        )}

        {/* ---- Recommendations toggle ---- */}
        <Pressable
          onPress={() =>
            onChangeSettings({
              includeRecommendations: !settings.includeRecommendations,
            })
          }
          style={[
            styles.recToggle,
            settings.includeRecommendations && styles.recToggleActive,
          ]}
        >
          <Sparkles
            size={14}
            color={settings.includeRecommendations ? c.onAccent : c.textMuted}
          />
          <Text
            style={[
              styles.recToggleText,
              settings.includeRecommendations && styles.recToggleTextActive,
            ]}
          >
            Include recommendations
          </Text>
          <Text
            style={[
              styles.recToggleHint,
              settings.includeRecommendations && styles.recToggleTextActive,
            ]}
          >
            {settings.includeRecommendations
              ? 'Non-pantry finds get a ★'
              : 'Pantry only'}
          </Text>
        </Pressable>

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

        {/* ---- Plan (grouped into week blocks with weekly coverage) ---- */}
        {plan &&
          Array.from(
            { length: Math.ceil(plan.days.length / 7) },
            (_, wi) => plan.days.slice(wi * 7, wi * 7 + 7)
          ).map((weekDays, wi) => (
            <View key={wi}>
              {plan.days.length > 1 && (
                <View style={styles.weekDivider}>
                  <Text style={styles.weekDividerText}>Week {wi + 1}</Text>
                  <Text style={styles.weekDividerMeta}>
                    {Math.round(periodMicroCoverage(weekDays, foodById) * 100)}
                    % micros over the week
                  </Text>
                </View>
              )}
              {weekDays.map((day) => {
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
                  <View style={styles.dayTitleRow}>
                    <Text style={styles.dayTitle}>{label}</Text>
                    {!!day.restrictionName && (
                      <View style={styles.restrictionBadge}>
                        <Text style={styles.restrictionBadgeText}>
                          {day.restrictionName}
                        </Text>
                      </View>
                    )}
                  </View>
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
                          {/* Tap the header for details, editing, and
                              the full nutrient summary */}
                          <Pressable
                            onPress={() =>
                              (navigation as any).navigate('PlanMealDetail', {
                                date: day.date,
                                slotId: meal.slotId,
                              })
                            }
                            style={({ pressed }) => [
                              styles.mealCardHeader,
                              pressed && { opacity: 0.6 },
                            ]}
                            hitSlop={4}
                          >
                            <Text style={styles.mealCardTitle}>
                              {meal.slotName}
                            </Text>
                            <View style={styles.mealCardHeaderRight}>
                              <Text style={styles.mealCardMeta}>
                                {Math.round(mt.calories)} kcal · P
                                {Math.round(mt.protein)} C
                                {Math.round(mt.carbs)} F{Math.round(mt.fat)}
                              </Text>
                              <ChevronRight size={14} color={c.textMuted} />
                            </View>
                          </Pressable>
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
                                {item.recommended && (
                                  <Sparkles
                                    size={12}
                                    color={c.accentDeep}
                                  />
                                )}
                                <Text style={styles.itemAmount}>
                                  {fmtPlannedAmount(food, item.servings)}
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
                                {item.recommended && (
                                  <Pressable
                                    onPress={() =>
                                      rejectRecommendation(
                                        day.date,
                                        meal.slotId,
                                        item.foodId
                                      )
                                    }
                                    style={styles.itemReject}
                                    hitSlop={6}
                                  >
                                    <X size={10} color={c.textMuted} />
                                  </Pressable>
                                )}
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
            </View>
          ))}

        {!plan && (
          <Text style={styles.emptyText}>
            Set your calorie target, shape your day template, and hit
            Generate — the planner builds meals from your pantry so you never
            have to think about what to eat.
          </Text>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Category picker subscreen (slots & restricted days) */}
      <CategoryPickerModal
        visible={pickerTarget != null}
        title={
          pickerSlot
            ? `${pickerSlot.name || 'Meal'} — foods`
            : pickerRule
              ? `${pickerRule.name || 'Rule'} — allowed foods`
              : ''
        }
        subtitle={
          pickerSlot
            ? 'One food from each category builds this meal. None = engine picks freely.'
            : 'Only these categories are planned on the selected weekdays.'
        }
        selected={
          pickerSlot
            ? pickerSlot.categories ?? []
            : pickerRule
              ? pickerRule.allowedCategories
              : []
        }
        onChange={(cats) => {
          if (pickerSlot) updateSlot(pickerSlot.id, { categories: cats });
          else if (pickerRule)
            updateRestriction(pickerRule.id, { allowedCategories: cats });
        }}
        onClose={() => setPickerTarget(null)}
      />
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
    subsectionTitle: {
      fontSize: 11,
      letterSpacing: 0.8,
      color: c.text,
      fontWeight: '700',
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      marginTop: 14,
      marginBottom: 4,
    },
    pctWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    pctInput: {
      width: 40,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 4,
      paddingVertical: 6,
      fontSize: 12,
      color: c.text,
      fontFamily: 'DM Sans',
      textAlign: 'center',
    },
    pctSign: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
    },
    categoriesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    categoriesLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    categoriesValue: {
      flex: 1,
      fontSize: 12,
      color: c.text,
      fontFamily: 'DM Sans',
    },
    weekdayRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 2,
    },
    weekdayChip: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 2,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    weekdayChipActive: {
      backgroundColor: c.primary,
      borderColor: c.text,
    },
    weekdayChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
    },
    weekdayChipTextActive: {
      color: c.onPrimary,
    },
    dayTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      marginRight: 8,
    },
    restrictionBadge: {
      borderRadius: 8,
      backgroundColor: c.tintPurple,
      borderWidth: 1,
      borderColor: c.text,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    restrictionBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
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
    mealCardHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    itemReject: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: c.cardAlt,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginBottom: 10,
    },
    recToggleActive: {
      backgroundColor: c.accent,
    },
    recToggleText: {
      flex: 1,
      fontSize: 12,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    recToggleHint: {
      fontSize: 10,
      color: c.textMuted,
      fontFamily: 'DM Sans',
    },
    recToggleTextActive: {
      color: c.onAccent,
    },
    weekDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
      marginBottom: 10,
      borderRadius: 10,
      backgroundColor: c.tintLimeFaint,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    weekDividerText: {
      fontSize: 11,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    weekDividerMeta: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
      fontWeight: '600',
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

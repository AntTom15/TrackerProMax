import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import { format, addDays, parseISO, isToday } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Droplets, Plus, X } from './Icons';
import { MEALS } from '../lib/constants';
import type { Food, LogEntry, MealName } from '../lib/types';
import { ThemeColors, useThemedStyles } from '../lib/theme';

interface LoggerPageProps {
  foods: Food[];
  pantryIds: string[];
  log: LogEntry[];
  // Water: oz consumed per day, keyed by yyyy-MM-dd.
  water: Record<string, number>;
  waterGoalOz: number;
  waterCupOz: number;
  onSetWater: (date: string, oz: number) => void;
  onAddEntry: (entry: {
    date: string;
    meal: MealName;
    foodId: string;
    servings: number;
  }) => void;
  onRemoveEntry: (entryId: string) => void;
  onUpdateServings: (entryId: string, servings: number) => void;
}

const todayKey = () => format(new Date(), 'yyyy-MM-dd');

export default function LoggerPage({
  foods,
  pantryIds,
  log,
  water,
  waterGoalOz,
  waterCupOz,
  onSetWater,
  onAddEntry,
  onRemoveEntry,
  onUpdateServings,
}: LoggerPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const navigation = useNavigation();
  const [date, setDate] = useState(todayKey());
  // Collapsed sections ('Water' or a meal name). Default: all expanded.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  const foodById = new Map(foods.map((f) => [f.id, f]));
  const dayEntries = log.filter((e) => e.date === date);

  const nutrientTotal = (key: 'calories' | 'protein' | 'carbs' | 'fat') =>
    dayEntries.reduce((sum, e) => {
      const food = foodById.get(e.foodId);
      return sum + (food?.nutrients?.[key] ?? 0) * e.servings;
    }, 0);

  const shiftDate = (days: number) =>
    setDate(format(addDays(parseISO(date), days), 'yyyy-MM-dd'));

  const dateObj = parseISO(date);
  const dateLabel = isToday(dateObj) ? 'Today' : format(dateObj, 'EEE, MMM d');

  // Water cups: goal / cup size cups per day, Cronometer-style. Custom
  // amounts can leave a cup partially filled, and going past the goal
  // simply grows extra cups so the row always matches what was drunk.
  const waterOz = water[date] ?? 0;
  const waterOzDisplay = Math.round(waterOz * 10) / 10;
  const goalCups = Math.max(1, Math.ceil(waterGoalOz / waterCupOz));
  const cupCount = Math.max(goalCups, Math.ceil(waterOz / waterCupOz));
  const filledCups = Math.floor(waterOz / waterCupOz + 1e-6);
  // Tapping cup N fills up to N; tapping the topmost full cup undoes it.
  // A partially-filled cup tops up to full when tapped.
  const pressCup = (i: number) =>
    onSetWater(
      date,
      i + 1 === filledCups ? i * waterCupOz : (i + 1) * waterCupOz
    );

  // Free-form oz entry for amounts that don't line up with cup size.
  const [customOz, setCustomOz] = useState('');
  const customVal = parseFloat(customOz);
  const addCustomOz = () => {
    if (!isFinite(customVal) || customVal <= 0) return;
    onSetWater(date, waterOz + customVal);
    setCustomOz('');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ChevronLeft size={22} color={c.textMuted} />
        </Pressable>
        <Text style={styles.title}>Logger</Text>
        <View style={styles.dateNav}>
          <Pressable onPress={() => shiftDate(-1)} hitSlop={8}>
            <ChevronLeft size={18} color={c.textMuted} />
          </Pressable>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
          <Pressable onPress={() => shiftDate(1)} hitSlop={8}>
            <ChevronRight size={18} color={c.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* Daily totals — tap for the full micronutrient breakdown */}
      <Pressable
        onPress={() =>
          (navigation as any).navigate('NutritionSummary', { date })
        }
        style={({ pressed }) => [styles.totalsCard, pressed && { opacity: 0.7 }]}
      >
        <View style={styles.totalsCalories}>
          <Text style={styles.totalsCaloriesValue}>
            {Math.round(nutrientTotal('calories'))}
          </Text>
          <Text style={styles.totalsCaloriesUnit}>kcal</Text>
        </View>
        <View style={styles.totalsMacros}>
          {([
            ['Protein', 'protein'],
            ['Carbs', 'carbs'],
            ['Fat', 'fat'],
          ] as const).map(([label, key]) => (
            <View key={key} style={styles.macro}>
              <Text style={styles.macroValue}>
                {Math.round(nutrientTotal(key))}g
              </Text>
              <Text style={styles.macroLabel}>{label}</Text>
            </View>
          ))}
          <View style={styles.macro}>
            <ChevronRight size={18} color={c.textMuted} />
          </View>
        </View>
      </Pressable>

      {/* Meals */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Water — tap cups to quick-add */}
        <View style={styles.waterSection}>
          <Pressable
            onPress={() => toggleSection('Water')}
            style={styles.mealHeader}
            hitSlop={4}
          >
            <Text style={styles.mealTitle}>Water</Text>
            <View style={styles.sectionHeaderRight}>
              <Text
                style={[
                  styles.mealCalories,
                  waterOz >= waterGoalOz && { color: c.accentDeep },
                ]}
              >
                {waterOzDisplay} / {waterGoalOz} oz
              </Text>
              {collapsed['Water'] ? (
                <ChevronDown size={16} color={c.textMuted} />
              ) : (
                <ChevronUp size={16} color={c.textMuted} />
              )}
            </View>
          </Pressable>
          {!collapsed['Water'] && (
          <View style={styles.waterCard}>
            <View style={styles.waterCups}>
              {Array.from({ length: cupCount }, (_, i) => {
                const fillFrac = Math.max(
                  0,
                  Math.min(1, waterOz / waterCupOz - i)
                );
                const isFull = fillFrac >= 1 - 1e-6;
                return (
                  <Pressable
                    key={i}
                    onPress={() => pressCup(i)}
                    style={styles.waterCup}
                    hitSlop={2}
                  >
                    {fillFrac > 0 && (
                      <View
                        style={[
                          styles.waterCupFill,
                          { height: `${Math.round(fillFrac * 100)}%` },
                        ]}
                      />
                    )}
                    <Droplets
                      size={16}
                      color={isFull ? '#ffffff' : c.textFaint}
                    />
                  </Pressable>
                );
              })}
            </View>

            {/* Custom amount — for pours that don't match the cup size */}
            <View style={styles.waterCustomRow}>
              <TextInput
                value={customOz}
                onChangeText={setCustomOz}
                placeholder="Custom oz"
                placeholderTextColor={c.textFaint}
                keyboardType="decimal-pad"
                style={styles.waterInput}
              />
              <Pressable
                onPress={addCustomOz}
                style={[
                  styles.waterAddBtn,
                  !(customVal > 0) && { opacity: 0.4 },
                ]}
              >
                <Plus size={14} color={c.onAccent} />
                <Text style={styles.waterAddText}>Add</Text>
              </Pressable>
            </View>
            <Text style={styles.waterHint}>
              {waterCupOz} oz per cup · tap cups or add an exact amount
            </Text>
          </View>
          )}
        </View>

        {MEALS.map((meal) => {
          const entries = dayEntries.filter((e) => e.meal === meal);
          const mealCalories = entries.reduce((sum, e) => {
            const food = foodById.get(e.foodId);
            return sum + (food?.nutrients?.calories ?? 0) * e.servings;
          }, 0);

          return (
            <View key={meal} style={styles.mealSection}>
              <Pressable
                onPress={() => toggleSection(meal)}
                style={styles.mealHeader}
                hitSlop={4}
              >
                <Text style={styles.mealTitle}>{meal}</Text>
                <View style={styles.sectionHeaderRight}>
                  {mealCalories > 0 && (
                    <Text style={styles.mealCalories}>
                      {Math.round(mealCalories)} kcal
                    </Text>
                  )}
                  {collapsed[meal] ? (
                    <ChevronDown size={16} color={c.textMuted} />
                  ) : (
                    <ChevronUp size={16} color={c.textMuted} />
                  )}
                </View>
              </Pressable>

              {!collapsed[meal] && entries.map((entry) => {
                const food = foodById.get(entry.foodId);
                if (!food) return null;
                const cals = (food.nutrients?.calories ?? 0) * entry.servings;
                return (
                  <View key={entry.id} style={styles.entryRow}>
                    {/* Tap the food itself to view its full nutrition */}
                    <Pressable
                      onPress={() =>
                        (navigation as any).navigate('FoodDetail', {
                          foodId: entry.foodId,
                        })
                      }
                      style={({ pressed }) => [
                        styles.entryInfo,
                        pressed && { opacity: 0.6 },
                      ]}
                    >
                      <Text style={styles.entryName}>{food.name}</Text>
                      <Text style={styles.entryMeta}>
                        {entry.servings} × {food.servingLabel} ·{' '}
                        {Math.round(cals)} kcal
                      </Text>
                    </Pressable>
                    <View style={styles.entryActions}>
                      <Pressable
                        onPress={() =>
                          onUpdateServings(entry.id, entry.servings - 0.5)
                        }
                        style={styles.stepperBtn}
                        hitSlop={4}
                      >
                        <Text style={styles.stepperText}>−</Text>
                      </Pressable>
                      <Text style={styles.servings}>{entry.servings}</Text>
                      <Pressable
                        onPress={() =>
                          onUpdateServings(entry.id, entry.servings + 0.5)
                        }
                        style={styles.stepperBtn}
                        hitSlop={4}
                      >
                        <Text style={styles.stepperText}>+</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => onRemoveEntry(entry.id)}
                        style={styles.removeBtn}
                        hitSlop={4}
                      >
                        <X size={12} color={c.textMuted} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}

              {/* Add food — opens the pantry-first picker screen */}
              {!collapsed[meal] && (
                <Pressable
                  onPress={() =>
                    (navigation as any).navigate('LogFoodPicker', { meal, date })
                  }
                  style={styles.addFoodBtn}
                >
                  <Plus size={14} color={c.textMuted} />
                  <Text style={styles.addFoodText}>Add food</Text>
                </Pressable>
              )}
            </View>
          );
        })}

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
    justifyContent: 'space-between',
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
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.cardAlt,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: c.text,
    fontFamily: 'Barlow Condensed',
    minWidth: 74,
    textAlign: 'center',
  },
  totalsCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: c.card,
    borderWidth: 2,
    borderColor: c.text,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: c.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  totalsCalories: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  totalsCaloriesValue: {
    fontSize: 32,
    fontWeight: '800',
    color: c.text,
    fontFamily: 'Barlow Condensed',
  },
  totalsCaloriesUnit: {
    fontSize: 12,
    color: c.textMuted,
    fontFamily: 'DM Sans',
  },
  totalsMacros: {
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  mealSection: {
    marginBottom: 20,
  },
  waterSection: {
    marginBottom: 20,
  },
  waterCard: {
    borderRadius: 12,
    backgroundColor: c.card,
    borderWidth: 2,
    borderColor: c.text,
    padding: 12,
  },
  waterCups: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  waterCup: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: c.cardAlt,
    borderWidth: 2,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // Bottom-up water level; height set inline as a percentage
  waterCupFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.blue,
  },
  waterCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  waterInput: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: c.surface,
    borderWidth: 2,
    borderColor: c.text,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 13,
    color: c.text,
    fontFamily: 'DM Sans',
  },
  waterAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    backgroundColor: c.accent,
    borderWidth: 2,
    borderColor: c.text,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: c.shadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  waterAddText: {
    fontSize: 12,
    fontWeight: '800',
    color: c.onAccent,
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  waterHint: {
    fontSize: 10,
    color: c.textFaint,
    fontFamily: 'DM Sans',
    marginTop: 8,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  mealTitle: {
    fontSize: 12,
    letterSpacing: 0.8,
    color: c.text,
    fontWeight: '700',
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
  },
  mealCalories: {
    fontSize: 11,
    color: c.textMuted,
    fontFamily: 'Barlow Condensed',
    fontWeight: '600',
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    backgroundColor: c.card,
    borderWidth: 2,
    borderColor: c.text,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 6,
  },
  entryInfo: {
    flex: 1,
    marginRight: 8,
  },
  entryName: {
    fontSize: 14,
    color: c.text,
    fontFamily: 'DM Sans',
  },
  entryMeta: {
    fontSize: 11,
    color: c.textMuted,
    fontFamily: 'DM Sans',
    marginTop: 2,
  },
  entryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.cardAlt,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    fontSize: 14,
    color: c.text,
    fontWeight: '600',
    lineHeight: 18,
  },
  servings: {
    fontSize: 13,
    fontWeight: '700',
    color: c.text,
    fontFamily: 'Barlow Condensed',
    minWidth: 24,
    textAlign: 'center',
  },
  removeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  addFoodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: c.text,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addFoodText: {
    fontSize: 13,
    color: c.textMuted,
    fontFamily: 'DM Sans',
  },
  picker: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: c.text,
    backgroundColor: c.surface,
    overflow: 'hidden',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.cardAlt,
  },
  pickerName: {
    fontSize: 13,
    color: c.text,
    fontFamily: 'DM Sans',
  },
  pickerMeta: {
    fontSize: 11,
    color: c.textMuted,
    fontFamily: 'DM Sans',
    marginTop: 1,
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
  pickerEmpty: {
    fontSize: 12,
    color: c.textMuted,
    fontFamily: 'DM Sans',
    textAlign: 'center',
    padding: 14,
  },
});

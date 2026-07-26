import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { format, parseISO } from 'date-fns';
import { ChevronLeft } from './Icons';
import { NUTRIENT_SECTIONS, nutrientAmount } from '../lib/nutrients';
import { ThemeColors, useThemedStyles } from '../lib/theme';
import { periodMicroCoverage } from '../lib/mealPlanner';
import type { Food, MealPlan, Nutrients } from '../lib/types';

interface MealPlanWeekSummaryPageProps {
  foods: Food[];
  plan: MealPlan | null;
}

// Aggregated nutrition for one week block of the plan. Same shape as
// the meal detail's summary, but totals span the whole block and every
// target is the daily value × the number of days — this is exactly the
// window the generator's weekly pacing optimizes toward 100%.
export default function MealPlanWeekSummaryPage({
  foods,
  plan,
}: MealPlanWeekSummaryPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const navigation = useNavigation();
  const route = useRoute();
  const { weekIndex } = (route.params ?? {}) as { weekIndex?: number };

  const wi = weekIndex ?? 0;
  const weekDays = plan?.days.slice(wi * 7, wi * 7 + 7) ?? [];

  if (!plan || weekDays.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}
          >
            <ChevronLeft size={22} color={c.textMuted} />
          </Pressable>
          <Text style={styles.title}>Week Summary</Text>
        </View>
        <Text style={styles.emptyText}>
          This week is no longer in the current plan.
        </Text>
      </View>
    );
  }

  const foodById = new Map(foods.map((f) => [f.id, f]));
  const numDays = weekDays.length;

  // Totals across every meal of every day in the block.
  const totals: Nutrients = {};
  for (const day of weekDays)
    for (const meal of day.meals)
      for (const it of meal.items) {
        const food = foodById.get(it.foodId);
        if (!food) continue;
        for (const [k, v] of Object.entries(food.nutrients ?? {})) {
          if (typeof v !== 'number') continue;
          (totals as any)[k] = ((totals as any)[k] ?? 0) + v * it.servings;
        }
      }

  const kcal = (totals as any).calories ?? 0;
  const coverage = periodMicroCoverage(weekDays, foodById);

  const first = parseISO(weekDays[0].date);
  const last = parseISO(weekDays[numDays - 1].date);
  const rangeLabel = `${format(first, 'MMM d')} – ${format(last, 'MMM d')}`;

  // Large totals read better with thousands separators.
  const fmtAmount = (v: number) => {
    const rounded = v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
    return rounded.toLocaleString();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ChevronLeft size={22} color={c.textMuted} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Week {wi + 1} Summary</Text>
          <Text style={styles.subtitle}>
            {rangeLabel} · {numDays} day{numDays === 1 ? '' : 's'} · targets =
            daily value × {numDays}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Week hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <View style={styles.heroKcalRow}>
              <Text style={styles.heroKcal}>{fmtAmount(kcal)}</Text>
              <Text style={styles.heroKcalUnit}>kcal</Text>
            </View>
            <Text style={styles.heroSub}>
              ~{fmtAmount(kcal / numDays)} kcal / day
            </Text>
          </View>
          <View style={styles.heroRight}>
            <Text style={styles.heroCoverage}>
              {Math.round(coverage * 100)}%
            </Text>
            <Text style={styles.heroCoverageLabel}>micros</Text>
          </View>
        </View>

        {/* Macro totals */}
        <View style={styles.macroRow}>
          {(
            [
              ['Protein', (totals as any).protein ?? 0],
              ['Carbs', (totals as any).carbs ?? 0],
              ['Fat', (totals as any).fat ?? 0],
            ] as const
          ).map(([label, v]) => (
            <View key={label} style={styles.macroCard}>
              <Text style={styles.macroValue}>{fmtAmount(v)}g</Text>
              <Text style={styles.macroLabel}>{label}</Text>
              <Text style={styles.macroSub}>
                {fmtAmount(v / numDays)}g/day
              </Text>
            </View>
          ))}
        </View>

        {/* Nutrient sections vs weekly targets */}
        {NUTRIENT_SECTIONS.map((section) => (
          <View key={section.title} style={styles.nutrientCard}>
            <Text style={styles.nutrientSectionTitle}>{section.title}</Text>
            {section.items.map((info) => {
              const amount = nutrientAmount(info, totals);
              const weekTarget = info.rda ? info.rda * numDays : null;
              const pct = weekTarget ? amount / weekTarget : null;
              return (
                <View key={info.key} style={styles.nutrientRow}>
                  <Text style={styles.nutrientLabel} numberOfLines={1}>
                    {info.label}
                  </Text>
                  <View style={styles.nutrientRight}>
                    <Text style={styles.nutrientValue}>
                      {fmtAmount(amount)}
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
    heroCard: {
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 20,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    heroLeft: {},
    heroKcalRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
    },
    heroKcal: {
      fontSize: 30,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
    },
    heroKcalUnit: {
      fontSize: 12,
      color: c.textMuted,
      fontFamily: 'DM Sans',
    },
    heroSub: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      marginTop: 2,
    },
    heroRight: {
      alignItems: 'center',
    },
    heroCoverage: {
      fontSize: 24,
      fontWeight: '800',
      color: c.accentDeep,
      fontFamily: 'Barlow Condensed',
    },
    heroCoverageLabel: {
      fontSize: 10,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    macroRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    macroCard: {
      flex: 1,
      borderRadius: 12,
      backgroundColor: c.cardAlt,
      borderWidth: 2,
      borderColor: c.text,
      paddingVertical: 10,
      alignItems: 'center',
    },
    macroValue: {
      fontSize: 15,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
    },
    macroLabel: {
      fontSize: 10,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginTop: 1,
    },
    macroSub: {
      fontSize: 10,
      color: c.textFaint,
      fontFamily: 'DM Sans',
      marginTop: 2,
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
      minWidth: 130,
    },
    nutrientValue: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
    },
    barTrack: {
      width: 130,
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

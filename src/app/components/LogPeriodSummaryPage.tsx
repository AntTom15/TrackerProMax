import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { addDays, format, parseISO, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight } from './Icons';
import { NUTRIENT_SECTIONS, nutrientAmount } from '../lib/nutrients';
import { ThemeColors, useThemedStyles } from '../lib/theme';
import type { Food, LogEntry, NutrientKey, Nutrients } from '../lib/types';

interface LogPeriodSummaryPageProps {
  foods: Food[];
  log: LogEntry[];
}

type Period = 7 | 30;

// What was ACTUALLY eaten over a week or month, with every target
// scaled to the period — the mirror of the meal planner's week summary,
// but sourced from the log instead of a generated plan.
export default function LogPeriodSummaryPage({
  foods,
  log,
}: LogPeriodSummaryPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as { date?: string } | undefined;

  const [period, setPeriod] = useState<Period>(7);
  // How many periods back from today (0 = current).
  const [offset, setOffset] = useState(0);

  const anchor = params?.date ? parseISO(params.date) : new Date();
  const end = subDays(anchor, offset * period);
  const start = subDays(end, period - 1);

  const dayKeys: string[] = [];
  for (let i = 0; i < period; i++) {
    dayKeys.push(format(addDays(start, i), 'yyyy-MM-dd'));
  }
  const dayKeySet = new Set(dayKeys);

  const foodById = new Map(foods.map((f) => [f.id, f]));
  const entries = log.filter((e) => dayKeySet.has(e.date));

  // Totals across the period, plus which days had anything logged —
  // averaging over untracked days would invent deficiencies.
  const totals: Nutrients = {};
  const loggedDays = new Set<string>();
  const perDayCalories: Record<string, number> = {};
  for (const e of entries) {
    const food = foodById.get(e.foodId);
    if (!food) continue;
    loggedDays.add(e.date);
    for (const [k, v] of Object.entries(food.nutrients ?? {})) {
      if (typeof v !== 'number') continue;
      totals[k as NutrientKey] = (totals[k as NutrientKey] ?? 0) + v * e.servings;
    }
    perDayCalories[e.date] =
      (perDayCalories[e.date] ?? 0) + (food.nutrients?.calories ?? 0) * e.servings;
  }

  const daysLogged = loggedDays.size;
  const kcal = (totals as any).calories ?? 0;

  // Targets scale by days actually logged, so a half-tracked week isn't
  // reported as a massive shortfall.
  const scale = Math.max(1, daysLogged);

  // Most-eaten foods by calorie contribution.
  const byFood: Record<string, { name: string; cals: number; count: number }> =
    {};
  for (const e of entries) {
    const food = foodById.get(e.foodId);
    if (!food) continue;
    const rec = (byFood[e.foodId] ??= {
      name: food.name,
      cals: 0,
      count: 0,
    });
    rec.cals += (food.nutrients?.calories ?? 0) * e.servings;
    rec.count += 1;
  }
  const topFoods = Object.values(byFood)
    .sort((a, b) => b.cals - a.cals)
    .slice(0, 6);

  const fmtAmount = (v: number) => {
    const r = v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
    return r.toLocaleString();
  };

  const rangeLabel = `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ChevronLeft size={22} color={c.textMuted} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Logged Summary</Text>
          <Text style={styles.subtitle}>
            {rangeLabel} · targets × {daysLogged || 0} logged day
            {daysLogged === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      {/* Period + paging */}
      <View style={styles.controls}>
        <View style={styles.periodToggle}>
          {([7, 30] as Period[]).map((p) => (
            <Pressable
              key={p}
              onPress={() => {
                setPeriod(p);
                setOffset(0);
              }}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            >
              <Text
                style={[
                  styles.periodBtnText,
                  period === p && styles.periodBtnTextActive,
                ]}
              >
                {p === 7 ? 'Week' : 'Month'}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.pager}>
          <Pressable onPress={() => setOffset((o) => o + 1)} hitSlop={8}>
            <ChevronLeft size={18} color={c.textMuted} />
          </Pressable>
          <Text style={styles.pagerLabel}>
            {offset === 0 ? 'This ' + (period === 7 ? 'week' : 'month') : `${offset} back`}
          </Text>
          <Pressable
            onPress={() => setOffset((o) => Math.max(0, o - 1))}
            hitSlop={8}
            style={offset === 0 && { opacity: 0.3 }}
          >
            <ChevronRight size={18} color={c.textMuted} />
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {daysLogged === 0 ? (
          <Text style={styles.emptyText}>
            Nothing logged in this period.
          </Text>
        ) : (
          <>
            {/* Hero */}
            <View style={styles.heroCard}>
              <View>
                <View style={styles.heroKcalRow}>
                  <Text style={styles.heroKcal}>{fmtAmount(kcal)}</Text>
                  <Text style={styles.heroKcalUnit}>kcal</Text>
                </View>
                <Text style={styles.heroSub}>
                  ~{fmtAmount(kcal / scale)} kcal / logged day
                </Text>
              </View>
              <View style={styles.heroRight}>
                <Text style={styles.heroDays}>
                  {daysLogged}/{period}
                </Text>
                <Text style={styles.heroDaysLabel}>days logged</Text>
              </View>
            </View>

            {/* Macros */}
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
                    {fmtAmount(v / scale)}g/day
                  </Text>
                </View>
              ))}
            </View>

            {/* Most-eaten */}
            {topFoods.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Biggest contributors</Text>
                <View style={styles.card}>
                  {topFoods.map((f) => (
                    <View key={f.name} style={styles.topRow}>
                      <Text style={styles.topName} numberOfLines={1}>
                        {f.name}
                      </Text>
                      <Text style={styles.topMeta}>
                        ×{f.count} · {fmtAmount(f.cals)} kcal
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Nutrients vs period-scaled targets */}
            {NUTRIENT_SECTIONS.map((section) => (
              <View key={section.title}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.card}>
                  {section.items.map((info) => {
                    const amount = nutrientAmount(info, totals);
                    const target = info.rda ? info.rda * scale : null;
                    const pct = target ? amount / target : null;
                    return (
                      <View key={info.key} style={styles.nutrientRow}>
                        <Text style={styles.nutrientLabel} numberOfLines={1}>
                          {info.label}
                        </Text>
                        <View style={styles.nutrientRight}>
                          <Text style={styles.nutrientValue}>
                            {fmtAmount(amount)}
                            {info.unit}
                            {pct != null
                              ? ` · ${Math.round(pct * 100)}%`
                              : ''}
                          </Text>
                          {pct != null && (
                            <View style={styles.barTrack}>
                              <View
                                style={[
                                  styles.barFill,
                                  {
                                    width: `${Math.min(
                                      100,
                                      Math.round(pct * 100)
                                    )}%`,
                                  },
                                  pct >= 1 && {
                                    backgroundColor: c.accentDeep,
                                  },
                                ]}
                              />
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}

            <Text style={styles.footnote}>
              Percentages compare what you logged against the daily target
              multiplied by the number of days you actually logged, so a
              partly-tracked period isn't reported as a deficiency.
            </Text>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
    },
    headerBtn: { padding: 4 },
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
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    periodToggle: {
      flexDirection: 'row',
      gap: 4,
      backgroundColor: c.cardAlt,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: c.text,
      padding: 3,
    },
    periodBtn: {
      paddingHorizontal: 16,
      paddingVertical: 5,
      borderRadius: 8,
    },
    periodBtnActive: { backgroundColor: c.primary },
    periodBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    periodBtnTextActive: { color: c.onPrimary },
    pager: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 8,
    },
    pagerLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
    },
    content: { flex: 1, paddingHorizontal: 20 },
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
    heroKcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
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
    heroRight: { alignItems: 'center' },
    heroDays: {
      fontSize: 22,
      fontWeight: '800',
      color: c.accentDeep,
      fontFamily: 'Barlow Condensed',
    },
    heroDaysLabel: {
      fontSize: 10,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    macroRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
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
    sectionTitle: {
      fontSize: 11,
      letterSpacing: 0.8,
      color: c.text,
      fontWeight: '700',
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    card: {
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      padding: 12,
      marginBottom: 12,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingVertical: 3,
    },
    topName: {
      flex: 1,
      fontSize: 12,
      color: c.text,
      fontFamily: 'DM Sans',
    },
    topMeta: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
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
    nutrientRight: { alignItems: 'flex-end', gap: 2, minWidth: 130 },
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
    barFill: { height: 4, borderRadius: 2, backgroundColor: c.accent },
    emptyText: {
      textAlign: 'center',
      color: c.textMuted,
      fontSize: 13,
      fontFamily: 'DM Sans',
      marginVertical: 24,
    },
    footnote: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      lineHeight: 16,
      marginTop: 4,
    },
  });

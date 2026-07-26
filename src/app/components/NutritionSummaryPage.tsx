import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { format, parseISO, isToday } from 'date-fns';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft } from './Icons';
import { NUTRIENT_SECTIONS } from '../lib/nutrients';
import type { Food, LogEntry, NutrientKey } from '../lib/types';
import { ThemeColors, useThemedStyles } from '../lib/theme';

interface NutritionSummaryPageProps {
  foods: Food[];
  log: LogEntry[];
}

export default function NutritionSummaryPage({
  foods,
  log,
}: NutritionSummaryPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const navigation = useNavigation();
  const route = useRoute();
  const date =
    (route.params as { date?: string } | undefined)?.date ??
    format(new Date(), 'yyyy-MM-dd');

  const foodById = new Map(foods.map((f) => [f.id, f]));
  const dayEntries = log.filter((e) => e.date === date);

  const total = (key: NutrientKey) =>
    dayEntries.reduce((sum, e) => {
      const food = foodById.get(e.foodId);
      return sum + (food?.nutrients?.[key] ?? 0) * e.servings;
    }, 0);

  const dateObj = parseISO(date);
  const dateLabel = isToday(dateObj) ? 'Today' : format(dateObj, 'EEEE, MMM d');

  const fmt = (n: number) =>
    n >= 100 ? Math.round(n).toString() : n >= 10 ? n.toFixed(1) : n.toFixed(2).replace(/\.?0+$/, '');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ChevronLeft size={22} color={c.textMuted} />
        </Pressable>
        <View>
          <Text style={styles.title}>Nutrition Summary</Text>
          <Text style={styles.subtitle}>{dateLabel}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {dayEntries.length === 0 && (
          <Text style={styles.emptyText}>
            Nothing logged for this day yet.
          </Text>
        )}

        {NUTRIENT_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.card}>
              {section.items.map(({ key, label, unit, rda }) => {
                const value = total(key);
                const pct = rda ? Math.min((value / rda) * 100, 100) : null;
                const pctLabel = rda ? Math.round((value / rda) * 100) : null;
                return (
                  <View key={key} style={styles.row}>
                    <View style={styles.rowTop}>
                      <Text style={styles.rowLabel}>{label}</Text>
                      <Text style={styles.rowValue}>
                        {fmt(value)}
                        <Text style={styles.rowUnit}> {unit}</Text>
                        {pctLabel !== null && (
                          <Text style={styles.rowPct}>  {pctLabel}%</Text>
                        )}
                      </Text>
                    </View>
                    {pct !== null && (
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${pct}%` },
                            pctLabel! >= 100 && styles.barFillFull,
                          ]}
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        <Text style={styles.footnote}>
          % values are relative to standard adult daily targets (FDA Daily
          Values). Personalised targets are coming with AI recommendations.
        </Text>

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
    gap: 12,
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
  emptyText: {
    textAlign: 'center',
    color: c.textMuted,
    fontSize: 13,
    fontFamily: 'DM Sans',
    marginVertical: 16,
  },
  section: {
    marginBottom: 16,
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
  card: {
    borderRadius: 12,
    backgroundColor: c.card,
    borderWidth: 2,
    borderColor: c.text,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: c.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 13,
    color: c.text,
    fontFamily: 'DM Sans',
    flex: 1,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '700',
    color: c.text,
    fontFamily: 'Barlow Condensed',
  },
  rowUnit: {
    fontSize: 11,
    fontWeight: '400',
    color: c.textMuted,
  },
  rowPct: {
    fontSize: 11,
    fontWeight: '700',
    color: c.accentDeep,
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    marginTop: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: c.accent,
  },
  barFillFull: {
    backgroundColor: c.accentDeep,
  },
  footnote: {
    fontSize: 11,
    color: c.textMuted,
    fontFamily: 'DM Sans',
    lineHeight: 16,
    marginTop: 4,
  },
});

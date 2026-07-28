import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { format, parseISO, isToday, isYesterday, subDays } from 'date-fns';
import { ChevronLeft, Footprints } from './Icons';
import { ThemeColors, useThemedStyles } from '../lib/theme';
import { useSteps, StepsByDate } from '../lib/steps';

interface StepsPageProps {
  steps: StepsByDate;
  onSnapshot: (patch: StepsByDate) => void;
}

const RANGE = 30;

// Daily step history from the phone's motion chip. The OS only answers
// ~7 days back, so anything older is whatever was snapshotted at the
// time — which is exactly why the snapshots exist.
export default function StepsPage({ steps, onSnapshot }: StepsPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const navigation = useNavigation();

  // Opening this screen re-queries, same as the Overview card does.
  const available = useSteps(onSnapshot);

  const today = new Date();
  const days = Array.from({ length: RANGE }, (_, i) => {
    const date = format(subDays(today, i), 'yyyy-MM-dd');
    return { date, count: steps[date] ?? 0 };
  });
  const tracked = days.filter((d) => d.count > 0);
  const week = days.slice(0, 7).filter((d) => d.count > 0);

  const avg = (arr: { count: number }[]) =>
    arr.length
      ? Math.round(arr.reduce((a, b) => a + b.count, 0) / arr.length)
      : 0;
  const best = tracked.reduce(
    (a, b) => (b.count > a.count ? b : a),
    { date: '', count: 0 }
  );
  const peak = Math.max(1, ...days.map((d) => d.count));

  const todayCount = steps[format(today, 'yyyy-MM-dd')] ?? 0;

  const label = (date: string) => {
    const d = parseISO(date);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'EEE, MMM d');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ChevronLeft size={22} color={c.textMuted} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Steps</Text>
          <Text style={styles.subtitle}>
            Counted by your phone — no wearable needed
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {available === false ? (
          <Text style={styles.emptyText}>
            Step counting isn't available on this device. It needs a phone
            with a motion sensor, and permission to read motion data.
          </Text>
        ) : (
          <>
            {/* Today */}
            <View style={styles.heroCard}>
              <View style={styles.heroIcon}>
                <Footprints size={20} color="#60a5fa" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroValue}>
                  {todayCount.toLocaleString()}
                </Text>
                <Text style={styles.heroLabel}>steps today</Text>
              </View>
            </View>

            <View style={styles.statRow}>
              {(
                [
                  ['7-day avg', avg(week).toLocaleString()],
                  ['30-day avg', avg(tracked).toLocaleString()],
                  [
                    'Best day',
                    best.count > 0 ? best.count.toLocaleString() : '—',
                  ],
                ] as const
              ).map(([lab, value]) => (
                <View key={lab} style={styles.statCard}>
                  <Text style={styles.statValue}>{value}</Text>
                  <Text style={styles.statLabel}>{lab}</Text>
                </View>
              ))}
            </View>

            {/* Daily bars */}
            <Text style={styles.sectionTitle}>Last 30 days</Text>
            {tracked.length === 0 ? (
              <Text style={styles.emptyText}>
                No steps recorded yet. Carry your phone for a while and this
                fills in — history only goes back as far as the app has been
                installed, since the OS itself only remembers about a week.
              </Text>
            ) : (
              <View style={styles.card}>
                {days.map((d) => (
                  <View key={d.date} style={styles.dayRow}>
                    <Text style={styles.dayLabel} numberOfLines={1}>
                      {label(d.date)}
                    </Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${Math.round((d.count / peak) * 100)}%` },
                          d.count === best.count &&
                            d.count > 0 && { backgroundColor: c.accentDeep },
                        ]}
                      />
                    </View>
                    <Text style={styles.dayCount}>
                      {d.count > 0 ? d.count.toLocaleString() : '—'}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.footnote}>
              Steps come from the phone itself, so anything walked while it
              was left behind won't appear, and a paired watch isn't counted.
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
    content: { flex: 1, paddingHorizontal: 20 },
    heroCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 12,
      backgroundColor: c.tintBlue,
      borderWidth: 2,
      borderColor: c.text,
      padding: 16,
      marginBottom: 12,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    heroIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroValue: {
      fontSize: 30,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
    },
    heroLabel: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    statRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    statCard: {
      flex: 1,
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      paddingVertical: 10,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 16,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
    },
    statLabel: {
      fontSize: 10,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginTop: 2,
    },
    sectionTitle: {
      fontSize: 11,
      letterSpacing: 0.8,
      color: c.text,
      fontWeight: '700',
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    card: {
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      padding: 12,
      marginBottom: 12,
    },
    dayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 3,
    },
    dayLabel: {
      width: 92,
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
    },
    barTrack: {
      flex: 1,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.cardAlt,
      overflow: 'hidden',
    },
    barFill: { height: 8, borderRadius: 4, backgroundColor: c.blue },
    dayCount: {
      width: 54,
      textAlign: 'right',
      fontSize: 11,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'Barlow Condensed',
    },
    emptyText: {
      textAlign: 'center',
      color: c.textMuted,
      fontSize: 13,
      fontFamily: 'DM Sans',
      marginVertical: 20,
      lineHeight: 19,
    },
    footnote: {
      fontSize: 11,
      color: c.textFaint,
      fontFamily: 'DM Sans',
      lineHeight: 16,
    },
  });

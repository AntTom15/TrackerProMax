import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { format, parseISO, isToday, isYesterday, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight } from './Icons';
import { ThemeColors, useThemedStyles } from '../lib/theme';
import type { Exercise, WorkoutSession } from '../lib/types';

interface ProgressPageProps {
  exercises: Exercise[];
  sessions: WorkoutSession[];
}

// Front door for training history. SessionDetail and ExerciseHistory
// already existed but were only reachable by drilling through the
// Tracker's calendar or tapping a lift mid-workout — there was no way
// to just ask "how am I progressing?".
export default function ProgressPage({
  exercises,
  sessions,
}: ProgressPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const navigation = useNavigation();

  const exById = new Map(exercises.map((e) => [e.id, e]));
  const finished = sessions
    .filter((s) => s.finishedAt !== null)
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));

  const sessionVolume = (s: WorkoutSession) =>
    (s.exercises ?? []).reduce(
      (sum, se) =>
        sum +
        (se.sets ?? []).reduce((a, set) => a + set.weight * set.reps, 0),
      0
    );

  // ---- headline counts ----
  const weekAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd');
  const thisWeek = finished.filter((s) => s.date >= weekAgo).length;
  const totalVolume = finished.reduce((a, s) => a + sessionVolume(s), 0);

  // ---- personal bests per lift (Epley e1RM, matching ExerciseHistory) ----
  const bests: Record<
    string,
    { name: string; weight: number; reps: number; e1rm: number; date: string }
  > = {};
  finished.forEach((s) => {
    (s.exercises ?? []).forEach((se) => {
      (se.sets ?? []).forEach((set) => {
        if (set.weight <= 0 || set.reps <= 0) return;
        const e1rm = set.weight * (1 + set.reps / 30);
        const cur = bests[se.exerciseId];
        if (!cur || e1rm > cur.e1rm) {
          bests[se.exerciseId] = {
            name: exById.get(se.exerciseId)?.name ?? 'Unknown',
            weight: set.weight,
            reps: set.reps,
            e1rm,
            date: s.date,
          };
        }
      });
    });
  });
  const topLifts = Object.entries(bests)
    .sort((a, b) => b[1].e1rm - a[1].e1rm)
    .slice(0, 8);

  const whenLabel = (s: WorkoutSession) => {
    const ts = s.finishedAt ?? parseISO(s.date).getTime();
    if (isToday(ts)) return `Today ${format(ts, 'h:mm a')}`;
    if (isYesterday(ts)) return 'Yesterday';
    return format(ts, 'EEE, MMM d');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ChevronLeft size={22} color={c.textMuted} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Progress</Text>
          <Text style={styles.subtitle}>
            Every finished session and your best lifts
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {finished.length === 0 ? (
          <Text style={styles.emptyText}>
            No finished workouts yet. Sessions you complete in the Tracker
            show up here with your personal bests.
          </Text>
        ) : (
          <>
            {/* Headline stats */}
            <View style={styles.statRow}>
              {(
                [
                  ['Workouts', String(finished.length)],
                  ['This week', String(thisWeek)],
                  ['Total volume', `${Math.round(totalVolume).toLocaleString()}`],
                ] as const
              ).map(([label, value]) => (
                <View key={label} style={styles.statCard}>
                  <Text style={styles.statValue}>{value}</Text>
                  <Text style={styles.statLabel}>{label}</Text>
                </View>
              ))}
            </View>

            {/* Personal bests — tap through to the per-lift history */}
            {topLifts.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Personal Bests</Text>
                {topLifts.map(([exerciseId, best]) => (
                  <Pressable
                    key={exerciseId}
                    onPress={() =>
                      (navigation as any).navigate('ExerciseHistory', {
                        exerciseId,
                      })
                    }
                    style={({ pressed }) => [
                      styles.row,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {best.name}
                      </Text>
                      <Text style={styles.rowMeta}>
                        {best.weight} × {best.reps} ·{' '}
                        {format(parseISO(best.date), 'MMM d')}
                      </Text>
                    </View>
                    <View style={styles.e1rmBadge}>
                      <Text style={styles.e1rmValue}>
                        {Math.round(best.e1rm)}
                      </Text>
                      <Text style={styles.e1rmLabel}>est 1RM</Text>
                    </View>
                    <ChevronRight size={14} color={c.textMuted} />
                  </Pressable>
                ))}
              </>
            )}

            {/* Session history */}
            <Text style={styles.sectionTitle}>History</Text>
            {finished.slice(0, 30).map((s) => {
              const vol = sessionVolume(s);
              const setCount = (s.exercises ?? []).reduce(
                (a, se) => a + (se.sets ?? []).length,
                0
              );
              return (
                <Pressable
                  key={s.id}
                  onPress={() =>
                    (navigation as any).navigate('SessionDetail', {
                      sessionId: s.id,
                    })
                  }
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {s.name || 'Workout'}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {whenLabel(s)} · {(s.exercises ?? []).length} exercises ·{' '}
                      {setCount} sets
                    </Text>
                  </View>
                  {vol > 0 && (
                    <Text style={styles.volume}>
                      {Math.round(vol).toLocaleString()}
                    </Text>
                  )}
                  <ChevronRight size={14} color={c.textMuted} />
                </Pressable>
              );
            })}
            {finished.length > 30 && (
              <Text style={styles.footnote}>
                Showing the 30 most recent of {finished.length} workouts.
              </Text>
            )}
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
    statRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    statCard: {
      flex: 1,
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      paddingVertical: 12,
      alignItems: 'center',
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    statValue: {
      fontSize: 20,
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
      marginTop: 6,
    },
    row: {
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
    rowName: { fontSize: 14, color: c.text, fontFamily: 'DM Sans' },
    rowMeta: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      marginTop: 2,
    },
    e1rmBadge: { alignItems: 'center' },
    e1rmValue: {
      fontSize: 15,
      fontWeight: '800',
      color: c.accentDeep,
      fontFamily: 'Barlow Condensed',
    },
    e1rmLabel: {
      fontSize: 9,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    volume: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
    },
    emptyText: {
      textAlign: 'center',
      color: c.textMuted,
      fontSize: 13,
      fontFamily: 'DM Sans',
      marginVertical: 24,
      lineHeight: 19,
    },
    footnote: {
      fontSize: 11,
      color: c.textFaint,
      fontFamily: 'DM Sans',
      marginTop: 4,
    },
  });

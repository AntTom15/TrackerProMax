import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { format, parseISO } from 'date-fns';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Check } from './Icons';
import { ThemeColors, useThemedStyles } from '../lib/theme';
import type { Exercise, WorkoutSession } from '../lib/types';

interface SessionDetailPageProps {
  exercises: Exercise[];
  sessions: WorkoutSession[];
}

// Read-only detail view for past workouts. Opened either with a
// sessionId (single workout from History) or a date (all workouts
// performed that day, from the Calendar).
export default function SessionDetailPage({
  exercises,
  sessions,
}: SessionDetailPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as
    | { sessionId?: string; date?: string }
    | undefined;

  const exerciseById = new Map(exercises.map((e) => [e.id, e]));

  const shown = params?.sessionId
    ? sessions.filter((s) => s.id === params.sessionId)
    : sessions
        .filter((s) => s.date === params?.date && s.finishedAt !== null)
        .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));

  const title = params?.sessionId
    ? shown[0]?.name ?? 'Workout'
    : params?.date
      ? format(parseISO(params.date), 'EEE, MMM d')
      : 'Workouts';

  const durationMin = (s: WorkoutSession) =>
    s.finishedAt ? Math.max(1, Math.round((s.finishedAt - s.startedAt) / 60000)) : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ChevronLeft size={22} color={c.textMuted} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {shown.length} workout{shown.length === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {shown.length === 0 && (
          <Text style={styles.emptyText}>No workouts found for this day.</Text>
        )}

        {shown.map((s) => {
          const totalSets = (s.exercises ?? []).reduce(
            (a, se) => a + (se.sets ?? []).length,
            0
          );
          const volume = (s.exercises ?? []).reduce(
            (acc, se) =>
              acc +
              (se.sets ?? []).reduce((a, set) => a + set.weight * set.reps, 0),
            0
          );
          const dur = durationMin(s);

          return (
            <View key={s.id} style={styles.sessionCard}>
              <Text style={styles.sessionName}>{s.name}</Text>
              <Text style={styles.sessionMeta}>
                {format(parseISO(s.date), 'EEE, MMM d, yyyy')} · started{' '}
                {format(s.startedAt, 'HH:mm')}
                {dur !== null && ` · ${dur} min`}
              </Text>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>
                    {(s.exercises ?? []).length}
                  </Text>
                  <Text style={styles.statLabel}>Exercises</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{totalSets}</Text>
                  <Text style={styles.statLabel}>Sets</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{Math.round(volume)}</Text>
                  <Text style={styles.statLabel}>Volume</Text>
                </View>
              </View>

              {(s.exercises ?? []).map((se) => {
                const ex = exerciseById.get(se.exerciseId);
                const isCardio = ex?.kind === 'cardio';
                return (
                  <View key={se.exerciseId} style={styles.exerciseBlock}>
                    <Text style={styles.exerciseName}>
                      {ex?.name ?? 'Unknown exercise'}
                    </Text>
                    {isCardio ? (
                      <Text style={styles.setLine}>
                        Duration: {se.durationMin ?? 0} min
                      </Text>
                    ) : (se.sets ?? []).length === 0 ? (
                      <Text style={styles.setLineMuted}>No sets logged</Text>
                    ) : (
                      (se.sets ?? []).map((set, i) => (
                        <View key={i} style={styles.setRow}>
                          <Text style={styles.setIndex}>Set {i + 1}</Text>
                          <Text style={styles.setLine}>
                            {set.weight} × {set.reps}
                          </Text>
                          {set.done && <Check size={12} color={c.accentDeep} />}
                        </View>
                      ))
                    )}
                  </View>
                );
              })}
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
      marginVertical: 24,
    },
    sessionCard: {
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      padding: 14,
      marginBottom: 12,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    sessionName: {
      fontSize: 17,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    sessionMeta: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      marginTop: 2,
      marginBottom: 10,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 10,
      backgroundColor: c.cardAlt,
      borderWidth: 2,
      borderColor: c.text,
      paddingVertical: 8,
      marginBottom: 10,
    },
    stat: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 16,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
    },
    statLabel: {
      fontSize: 9,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginTop: 1,
    },
    statDivider: {
      width: 2,
      height: 24,
      backgroundColor: c.text,
      opacity: 0.15,
    },
    exerciseBlock: {
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.text,
      padding: 10,
      marginBottom: 6,
    },
    exerciseName: {
      fontSize: 14,
      fontWeight: '600',
      color: c.text,
      fontFamily: 'DM Sans',
      marginBottom: 4,
    },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 2,
    },
    setIndex: {
      fontSize: 10,
      fontWeight: '700',
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      width: 40,
    },
    setLine: {
      fontSize: 13,
      color: c.text,
      fontFamily: 'DM Sans',
    },
    setLineMuted: {
      fontSize: 12,
      color: c.textFaint,
      fontFamily: 'DM Sans',
    },
  });

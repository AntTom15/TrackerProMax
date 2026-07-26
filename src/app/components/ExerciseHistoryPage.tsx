import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { format, parseISO } from 'date-fns';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft } from './Icons';
import { ThemeColors, useThemedStyles } from '../lib/theme';
import type { Exercise, WorkoutSession } from '../lib/types';

interface ExerciseHistoryPageProps {
  exercises: Exercise[];
  sessions: WorkoutSession[];
}

// Complete history for a single exercise: every finished session where it
// was performed, set by set, with the all-time best weight up top.
export default function ExerciseHistoryPage({
  exercises,
  sessions,
}: ExerciseHistoryPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const navigation = useNavigation();
  const route = useRoute();
  const exerciseId = (route.params as { exerciseId?: string } | undefined)
    ?.exerciseId;

  const exercise = exercises.find((e) => e.id === exerciseId) ?? null;
  const isCardio = exercise?.kind === 'cardio';

  // Finished sessions featuring this exercise, newest first.
  const entries = sessions
    .filter(
      (s) =>
        s.finishedAt !== null &&
        (s.exercises ?? []).some((se) => se.exerciseId === exerciseId)
    )
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
    .map((s) => ({
      session: s,
      se: (s.exercises ?? []).find((se) => se.exerciseId === exerciseId)!,
    }));

  // All-time bests across every logged set.
  let bestWeight = 0;
  let bestWeightReps = 0;
  let bestE1RM = 0;
  let totalSets = 0;
  let bestDuration = 0;
  entries.forEach(({ se }) => {
    (se.sets ?? []).forEach((set) => {
      totalSets += 1;
      if (
        set.weight > bestWeight ||
        (set.weight === bestWeight && set.reps > bestWeightReps)
      ) {
        bestWeight = set.weight;
        bestWeightReps = set.reps;
      }
      // Epley estimated one-rep max.
      const e1rm = set.weight * (1 + set.reps / 30);
      if (e1rm > bestE1RM) bestE1RM = e1rm;
    });
    if ((se.durationMin ?? 0) > bestDuration) bestDuration = se.durationMin!;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ChevronLeft size={22} color={c.textMuted} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{exercise?.name ?? 'Exercise'}</Text>
          <Text style={styles.subtitle}>
            {exercise ? exercise.muscles.join(' · ') : ''}
          </Text>
        </View>
      </View>

      {/* Bests */}
      <View style={styles.bestCard}>
        <View style={styles.bestMain}>
          <Text style={styles.bestValue}>
            {isCardio ? bestDuration : Math.round(bestE1RM)}
          </Text>
          <Text style={styles.bestUnit}>{isCardio ? 'min' : 'est. 1RM'}</Text>
        </View>
        <View style={styles.bestStats}>
          {!isCardio && (
            <View style={styles.bestStat}>
              <Text style={styles.bestStatValue}>
                {bestWeight > 0 ? bestWeight : '—'}
              </Text>
              <Text style={styles.bestStatLabel}>Best Weight</Text>
            </View>
          )}
          <View style={styles.bestStat}>
            <Text style={styles.bestStatValue}>{entries.length}</Text>
            <Text style={styles.bestStatLabel}>Sessions</Text>
          </View>
          {!isCardio && (
            <View style={styles.bestStat}>
              <Text style={styles.bestStatValue}>{totalSets}</Text>
              <Text style={styles.bestStatLabel}>Sets</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {entries.length === 0 && (
          <Text style={styles.emptyText}>
            No history yet — finish a session with this exercise and it shows
            up here.
          </Text>
        )}

        {entries.map(({ session, se }) => (
          <View key={session.id} style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <Text style={styles.entryDate}>
                {format(parseISO(session.date), 'EEE, MMM d, yyyy')}
              </Text>
              <Text style={styles.entrySession}>{session.name}</Text>
            </View>
            {isCardio ? (
              <Text style={styles.setLine}>
                Duration: {se.durationMin ?? 0} min
              </Text>
            ) : (se.sets ?? []).length === 0 ? (
              <Text style={styles.setLineMuted}>No sets logged</Text>
            ) : (
              (se.sets ?? []).map((set, i) => {
                const isBest =
                  set.weight === bestWeight &&
                  set.reps === bestWeightReps &&
                  bestWeight > 0;
                return (
                  <View key={i} style={styles.setRow}>
                    <Text style={styles.setIndex}>Set {i + 1}</Text>
                    <Text style={styles.setLine}>
                      {set.weight} × {set.reps}
                    </Text>
                    {isBest && (
                      <View style={styles.bestBadge}>
                        <Text style={styles.bestBadgeText}>Best</Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
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
    bestCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 20,
      marginBottom: 12,
      borderRadius: 12,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 18,
      paddingVertical: 14,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    bestMain: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
      flex: 1,
    },
    bestValue: {
      fontSize: 34,
      fontWeight: '800',
      color: c.onAccent,
      fontFamily: 'Barlow Condensed',
    },
    bestUnit: {
      fontSize: 11,
      fontWeight: '700',
      color: c.onAccent,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    bestStats: {
      flexDirection: 'row',
      gap: 16,
    },
    bestStat: {
      alignItems: 'center',
    },
    bestStatValue: {
      fontSize: 16,
      fontWeight: '800',
      color: c.onAccent,
      fontFamily: 'Barlow Condensed',
    },
    bestStatLabel: {
      fontSize: 9,
      color: c.onAccent,
      fontFamily: 'DM Sans',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      opacity: 0.8,
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
      paddingHorizontal: 10,
    },
    entryCard: {
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      padding: 12,
      marginBottom: 8,
    },
    entryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    entryDate: {
      fontSize: 13,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    entrySession: {
      fontSize: 10,
      color: c.textMuted,
      fontFamily: 'DM Sans',
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
    bestBadge: {
      borderRadius: 6,
      backgroundColor: c.accent,
      borderWidth: 1,
      borderColor: c.text,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    bestBadgeText: {
      fontSize: 8,
      fontWeight: '800',
      color: c.onAccent,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
  });

import { useEffect, useState } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Vibration,
} from 'react-native';
import {
  format,
  parseISO,
  addMonths,
  startOfMonth,
  getDaysInMonth,
  getDay,
} from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Trash,
  Check,
} from './Icons';
import ExercisePicker from './ExercisePicker';
import NumericInput from './components2/NumericInput';
import type {
  Exercise,
  WorkoutPlan,
  WorkoutSession,
  SessionExercise,
} from '../lib/types';
import { ThemeColors, useThemedStyles } from '../lib/theme';

interface WorkoutTrackerPageProps {
  exercises: Exercise[];
  plans: WorkoutPlan[];
  sessions: WorkoutSession[];
  // Rest between sets, in seconds (configurable in Profile).
  restSeconds: number;
  // Remembered "current plan" shown in the start dropdown.
  activePlanId: string | null;
  onSelectPlan: (planId: string) => void;
  onStartSession: (planId: string | null, dayId?: string | null) => void;
  onUpdateSession: (
    sessionId: string,
    patch: Partial<WorkoutSession>
  ) => void;
  onFinishSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export default function WorkoutTrackerPage({
  exercises,
  plans,
  sessions,
  restSeconds,
  activePlanId,
  onSelectPlan,
  onStartSession,
  onUpdateSession,
  onFinishSession,
  onDeleteSession,
}: WorkoutTrackerPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const navigation = useNavigation();
  const [pickerOpen, setPickerOpen] = useState(false);

  // Rest timer: seconds remaining, or null when hidden.
  const [restLeft, setRestLeft] = useState<number | null>(null);

  useEffect(() => {
    if (restLeft === null) return;
    if (restLeft <= 0) {
      // Time's up — buzz and dismiss.
      Vibration.vibrate([0, 300, 150, 300]);
      setRestLeft(null);
      return;
    }
    const t = setTimeout(() => setRestLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [restLeft]);

  const fmtClock = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // Live elapsed clock for the active session (ticks every second).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // "42 seconds" -> "12:34 minutes" -> "1:23:45 hours"; units only
  // appear once they're needed.
  const fmtElapsed = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    if (h > 0) return `${h}:${pad(m)}:${pad(s)} ${h === 1 ? 'hour' : 'hours'}`;
    if (m > 0) return `${m}:${pad(s)} ${m === 1 ? 'minute' : 'minutes'}`;
    return `${s} ${s === 1 ? 'second' : 'seconds'}`;
  };

  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  const active = sessions.find((s) => s.finishedAt === null) ?? null;
  const history = sessions
    .filter((s) => s.finishedAt !== null)
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));

  // Plan dropdown for the start section.
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  // Chevron collapses/expands the selected plan's day list.
  const [daysCollapsed, setDaysCollapsed] = useState(false);
  const activePlan =
    plans.find((p) => p.id === activePlanId) ?? plans[0] ?? null;

  // ---- Calendar: finished workouts per day ----
  const [calMonth, setCalMonth] = useState(() => new Date());
  const workoutsByDate = new Map<string, number>();
  history.forEach((s) => {
    workoutsByDate.set(s.date, (workoutsByDate.get(s.date) ?? 0) + 1);
  });
  const monthStart = startOfMonth(calMonth);
  const daysInMonth = getDaysInMonth(calMonth);
  const leadingBlanks = getDay(monthStart); // 0 = Sunday
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const calCells: { key: string; day?: number; dateKey?: string }[] = [];
  for (let i = 0; i < leadingBlanks; i++) calCells.push({ key: `blank${i}` });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = format(
      new Date(calMonth.getFullYear(), calMonth.getMonth(), d),
      'yyyy-MM-dd'
    );
    calCells.push({ key: dateKey, day: d, dateKey });
  }

  const updateExercises = (next: SessionExercise[]) => {
    if (active) onUpdateSession(active.id, { exercises: next });
  };

  const addExercise = (exercise: Exercise) => {
    if (!active) return;
    if (!active.exercises.some((se) => se.exerciseId === exercise.id)) {
      updateExercises([
        ...active.exercises,
        exercise.kind === 'cardio'
          ? { exerciseId: exercise.id, sets: [], durationMin: 0 }
          : { exerciseId: exercise.id, sets: [{ weight: 0, reps: 0 }] },
      ]);
    }
    setPickerOpen(false);
  };

  const patchExercise = (
    exerciseId: string,
    patch: Partial<SessionExercise>
  ) => {
    if (!active) return;
    updateExercises(
      active.exercises.map((se) =>
        se.exerciseId === exerciseId ? { ...se, ...patch } : se
      )
    );
  };

  const removeExercise = (exerciseId: string) => {
    if (!active) return;
    updateExercises(active.exercises.filter((se) => se.exerciseId !== exerciseId));
  };

  // Most recent finished performance of an exercise (history is sorted
  // newest-first). Used to ghost-fill last weights/reps as placeholders.
  const lastPerformanceFor = (exerciseId: string): SessionExercise | null => {
    for (const s of history) {
      const se = (s.exercises ?? []).find((e) => e.exerciseId === exerciseId);
      if (se && ((se.sets ?? []).length > 0 || (se.durationMin ?? 0) > 0)) {
        return se;
      }
    }
    return null;
  };

  const setVolume = (s: WorkoutSession) =>
    (s.exercises ?? []).reduce(
      (acc, se) =>
        acc + (se.sets ?? []).reduce((a, set) => a + set.weight * set.reps, 0),
      0
    );

  // ---------- Active session view ----------
  if (active) {
    const plan = plans.find((p) => p.id === active.planId) ?? null;
    const day = plan?.days?.find((d) => d.id === active.dayId) ?? null;
    const targetFor = (exerciseId: string) =>
      day?.exercises.find((pe) => pe.exerciseId === exerciseId) ?? null;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <ChevronLeft size={22} color={c.textMuted} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{active.name}</Text>
            <Text style={styles.subtitle}>
              In progress · {fmtElapsed(now - active.startedAt)}
            </Text>
          </View>
          <Pressable
            onPress={() => onFinishSession(active.id)}
            style={styles.finishBtn}
          >
            <Check size={14} color={c.onAccent} />
            <Text style={styles.finishBtnText}>Finish</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sessionHint}>
            Only sets marked ✓ are saved when you finish.
          </Text>
          {active.exercises.map((se) => {
            const ex = exerciseById.get(se.exerciseId);
            if (!ex) return null;
            const target = targetFor(se.exerciseId);
            const isCardio = ex.kind === 'cardio';
            const last = lastPerformanceFor(se.exerciseId);
            const lastSets = last?.sets ?? [];

            return (
              <View key={se.exerciseId} style={styles.exerciseCard}>
                <View style={styles.exerciseCardTop}>
                  {/* Tap the name to see full history for this exercise */}
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() =>
                      (navigation as any).navigate('ExerciseHistory', {
                        exerciseId: se.exerciseId,
                      })
                    }
                  >
                    <Text style={styles.exerciseName}>{ex.name}</Text>
                    <Text style={styles.exerciseMeta}>
                      {target
                        ? isCardio
                          ? `Target: ${target.targetReps} min`
                          : `Target: ${target.targetSets} × ${target.targetReps}`
                        : (
                          <>
                            <Text style={styles.exerciseMetaPrimary}>{ex.muscles[0]}</Text>
                            {ex.muscles.length > 1
                              ? ' · ' + ex.muscles.slice(1).join(' · ')
                              : ''}
                          </>
                        )}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => removeExercise(se.exerciseId)}
                    style={styles.removeBtn}
                    hitSlop={6}
                  >
                    <X size={12} color={c.textMuted} />
                  </Pressable>
                </View>

                {isCardio ? (
                  <View style={styles.cardioRow}>
                    <Text style={styles.setLabel}>Duration</Text>
                    <NumericInput
                      value={se.durationMin ? String(se.durationMin) : ''}
                      onChangeText={(v) =>
                        patchExercise(se.exerciseId, {
                          durationMin: parseFloat(v) || 0,
                        })
                      }
                      placeholder={String(last?.durationMin ?? 0)}
                      placeholderTextColor={c.textMuted}
                      style={styles.setInput}
                    />
                    <Text style={styles.setUnit}>min</Text>
                  </View>
                ) : (
                  <>
                    {se.sets.map((set, i) => (
                      <View
                        key={i}
                        style={[styles.setRow, set.done && styles.setRowDone]}
                      >
                        <Text
                          style={[
                            styles.setLabel,
                            set.done && styles.setLabelDone,
                          ]}
                        >
                          {set.done ? 'Logged' : `Set ${i + 1}`}
                        </Text>
                        <NumericInput
                          value={set.weight ? String(set.weight) : ''}
                          onChangeText={(v) =>
                            patchExercise(se.exerciseId, {
                              sets: se.sets.map((s, j) =>
                                j === i ? { ...s, weight: parseFloat(v) || 0 } : s
                              ),
                            })
                          }
                          placeholder={String(
                            (lastSets[i] ?? lastSets[lastSets.length - 1])
                              ?.weight ?? 0
                          )}
                          placeholderTextColor={c.textMuted}
                          style={styles.setInput}
                        />
                        <Text style={styles.setUnit}>wt</Text>
                        <Text style={styles.setTimes}>×</Text>
                        <NumericInput
                          value={set.reps ? String(set.reps) : ''}
                          onChangeText={(v) =>
                            patchExercise(se.exerciseId, {
                              sets: se.sets.map((s, j) =>
                                j === i
                                  ? { ...s, reps: parseInt(v, 10) || 0 }
                                  : s
                              ),
                            })
                          }
                          placeholder={String(
                            (lastSets[i] ?? lastSets[lastSets.length - 1])
                              ?.reps ?? 0
                          )}
                          placeholderTextColor={c.textMuted}
                          style={styles.setInput}
                        />
                        <Text style={styles.setUnit}>reps</Text>
                        {/* Done tick — starts the rest timer */}
                        <Pressable
                          onPress={() => {
                            const nowDone = !set.done;
                            patchExercise(se.exerciseId, {
                              sets: se.sets.map((s, j) =>
                                j === i ? { ...s, done: nowDone } : s
                              ),
                            });
                            // Plan may override the profile-wide rest default
                            // for this particular exercise.
                            if (nowDone)
                              setRestLeft(target?.restSeconds ?? restSeconds);
                          }}
                          style={[styles.setDone, set.done && styles.setDoneActive]}
                          hitSlop={6}
                        >
                          <Check size={12} color={set.done ? c.onAccent : c.textMuted} />
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            patchExercise(se.exerciseId, {
                              sets: se.sets.filter((_, j) => j !== i),
                            })
                          }
                          style={styles.setRemove}
                          hitSlop={6}
                        >
                          <X size={10} color={c.textMuted} />
                        </Pressable>
                      </View>
                    ))}
                    <Pressable
                      onPress={() =>
                        patchExercise(se.exerciseId, {
                          sets: [
                            ...se.sets,
                            // Pre-fill with the previous set for fast logging
                            se.sets.length > 0
                              ? { ...se.sets[se.sets.length - 1], done: false }
                              : { weight: 0, reps: 0 },
                          ],
                        })
                      }
                      style={styles.addSetBtn}
                    >
                      <Plus size={12} color={c.textMuted} />
                      <Text style={styles.addSetText}>Add set</Text>
                    </Pressable>
                  </>
                )}
              </View>
            );
          })}

          {pickerOpen ? (
            <ExercisePicker
              exercises={exercises}
              onSelect={addExercise}
              onClose={() => setPickerOpen(false)}
            />
          ) : (
            <Pressable onPress={() => setPickerOpen(true)} style={styles.addBtn}>
              <Plus size={16} color={c.textMuted} />
              <Text style={styles.addBtnText}>Add exercise</Text>
            </Pressable>
          )}

          {/* Destructive escape hatch — deliberately far from Finish */}
          <Pressable
            onPress={() =>
              Alert.alert(
                'Cancel workout?',
                'This session and everything logged in it will be discarded.',
                [
                  { text: 'Keep going', style: 'cancel' },
                  {
                    text: 'Cancel workout',
                    style: 'destructive',
                    onPress: () => onDeleteSession(active.id),
                  },
                ]
              )
            }
            style={({ pressed }) => [
              styles.cancelBtn,
              pressed && { opacity: 0.6 },
            ]}
          >
            <X size={14} color={c.danger} />
            <Text style={styles.cancelBtnText}>Cancel workout</Text>
          </Pressable>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Rest timer bar */}
        {restLeft !== null && (
          <View style={styles.restBar}>
            <Text style={styles.restLabel}>Rest</Text>
            <Pressable
              onPress={() => setRestLeft((s) => Math.max(1, (s ?? 0) - 15))}
              style={styles.restAdjustBtn}
              hitSlop={4}
            >
              <Text style={styles.restAdjustText}>−15</Text>
            </Pressable>
            <Text style={styles.restClock}>{fmtClock(restLeft)}</Text>
            <Pressable
              onPress={() => setRestLeft((s) => (s ?? 0) + 15)}
              style={styles.restAdjustBtn}
              hitSlop={4}
            >
              <Text style={styles.restAdjustText}>+15</Text>
            </Pressable>
            <Pressable
              onPress={() => setRestLeft(null)}
              style={styles.restSkip}
              hitSlop={6}
            >
              <X size={14} color={c.onPrimary} />
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  // ---------- Start / history view ----------
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ChevronLeft size={22} color={c.textMuted} />
        </Pressable>
        <Text style={styles.title}>Tracker</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionHeader}>Start a workout</Text>
        {plans.length > 0 && (
          /* Selector + day list live in ONE box so it's clear the
             dropdown controls what's below it. Themed like Freestyle. */
          <View style={styles.planContainer}>
            <View
              style={[
                styles.planSelect,
                (planPickerOpen || (!daysCollapsed && !!activePlan)) &&
                  styles.planSelectDivider,
              ]}
            >
              {/* Tap the chip to switch plans */}
              <Pressable
                onPress={() => setPlanPickerOpen(!planPickerOpen)}
                style={({ pressed }) => [
                  styles.planSelectChip,
                  pressed && { opacity: 0.7 },
                ]}
                hitSlop={6}
              >
                <Text style={styles.planSelectChipText}>Current Plan ▸</Text>
              </Pressable>
              <Text style={styles.planSelectText}>
                {activePlan?.name ?? 'Choose a plan'}
              </Text>
              {/* Chevron collapses / expands the day list */}
              <Pressable
                onPress={() => setDaysCollapsed(!daysCollapsed)}
                hitSlop={10}
              >
                {daysCollapsed ? (
                  <ChevronDown size={20} color={c.text} />
                ) : (
                  <ChevronUp size={20} color={c.text} />
                )}
              </Pressable>
            </View>

            {planPickerOpen ? (
              <View>
                {plans.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      onSelectPlan(p.id);
                      setPlanPickerOpen(false);
                      setDaysCollapsed(false);
                    }}
                    style={[
                      styles.planOption,
                      p.id === activePlan?.id && styles.planOptionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.planOptionText,
                        p.id === activePlan?.id && styles.planOptionTextActive,
                      ]}
                    >
                      {p.name} · {(p.days ?? []).length} day
                      {(p.days ?? []).length === 1 ? '' : 's'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              !daysCollapsed &&
              activePlan && (
                <View style={styles.planDays}>
                  {(activePlan.days ?? []).map((day) => (
                    <Pressable
                      key={day.id}
                      onPress={() => onStartSession(activePlan.id, day.id)}
                      style={styles.dayRow}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dayName}>{day.name}</Text>
                        <Text style={styles.startMeta}>
                          {(day.exercises ?? []).length} exercise
                          {(day.exercises ?? []).length === 1 ? '' : 's'}
                        </Text>
                      </View>
                      <View style={styles.startBadge}>
                        <Text style={styles.startBadgeText}>Start</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )
            )}
          </View>
        )}

        <Pressable
          onPress={() => onStartSession(null, null)}
          style={[styles.startCard, styles.freestyleCard]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.startName}>Freestyle session</Text>
            <Text style={styles.startMeta}>Log as you go, no plan</Text>
          </View>
          <View style={styles.startBadge}>
            <Text style={styles.startBadgeText}>Start</Text>
          </View>
        </Pressable>

        {/* Calendar — training frequency at a glance */}
        <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Calendar</Text>
        <View style={styles.calendarCard}>
          <View style={styles.calHeader}>
            <Pressable
              onPress={() => setCalMonth((m) => addMonths(m, -1))}
              hitSlop={8}
            >
              <ChevronLeft size={18} color={c.textMuted} />
            </Pressable>
            <Text style={styles.calMonth}>{format(calMonth, 'MMMM yyyy')}</Text>
            <Pressable
              onPress={() => setCalMonth((m) => addMonths(m, 1))}
              hitSlop={8}
            >
              <ChevronRight size={18} color={c.textMuted} />
            </Pressable>
          </View>
          <View style={styles.calGrid}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <View key={`wd${i}`} style={styles.calCell}>
                <Text style={styles.calWeekday}>{d}</Text>
              </View>
            ))}
            {calCells.map((cell) => {
              if (cell.day == null) {
                return <View key={cell.key} style={styles.calCell} />;
              }
              const count = workoutsByDate.get(cell.dateKey!) ?? 0;
              return (
                <View key={cell.key} style={styles.calCell}>
                  <Pressable
                    disabled={count === 0}
                    onPress={() =>
                      (navigation as any).navigate('SessionDetail', {
                        date: cell.dateKey,
                      })
                    }
                    style={[
                      styles.calDay,
                      count > 0 && styles.calDayActive,
                      count > 1 && styles.calDayHot,
                      cell.dateKey === todayStr && styles.calDayToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.calDayText,
                        count > 0 && styles.calDayTextActive,
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>

        <Text style={[styles.sectionHeader, { marginTop: 20 }]}>History</Text>
        {history.length === 0 && (
          <Text style={styles.emptyText}>No workouts logged yet.</Text>
        )}
        {history.map((s) => {
          const vol = setVolume(s);
          const totalSets = (s.exercises ?? []).reduce((a, se) => a + (se.sets ?? []).length, 0);
          const cardioMin = (s.exercises ?? []).reduce(
            (a, se) => a + (se.durationMin ?? 0),
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
              style={styles.historyCard}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.startName}>{s.name}</Text>
                <Text style={styles.startMeta}>
                  {format(parseISO(s.date), 'EEE, MMM d')} ·{' '}
                  {s.exercises.length} exercise
                  {s.exercises.length === 1 ? '' : 's'}
                  {totalSets > 0 && ` · ${totalSets} sets`}
                  {vol > 0 && ` · ${Math.round(vol)} vol`}
                  {cardioMin > 0 && ` · ${cardioMin} min cardio`}
                </Text>
              </View>
              <Pressable
                onPress={() => onDeleteSession(s.id)}
                style={styles.headerBtn}
                hitSlop={6}
              >
                <Trash size={16} color={c.textMuted} />
              </Pressable>
            </Pressable>
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
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    backgroundColor: c.accent,
    borderWidth: 2,
    borderColor: c.text,
    shadowColor: c.shadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  finishBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: c.onAccent,
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    fontSize: 10,
    letterSpacing: 0.8,
    color: c.text,
    fontWeight: '700',
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  startCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: c.card,
    borderWidth: 2,
    borderColor: c.text,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    shadowColor: c.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  planCard: {
    borderRadius: 12,
    backgroundColor: c.card,
    borderWidth: 2,
    borderColor: c.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    shadowColor: c.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  planCardName: {
    fontSize: 16,
    fontWeight: '800',
    color: c.text,
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    backgroundColor: c.surface,
    borderWidth: 2,
    borderColor: c.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  dayName: {
    fontSize: 14,
    fontWeight: '600',
    color: c.text,
    fontFamily: 'DM Sans',
  },
  freestyleCard: {
    borderStyle: 'dashed',
    borderColor: c.text,
    backgroundColor: c.tintLimeFaint,
    // Dashed border + hard offset shadow fight each other — keep this
    // one flat so the dotted box reads clean.
    shadowOpacity: 0,
    elevation: 0,
  },
  startName: {
    fontSize: 15,
    fontWeight: '600',
    color: c.text,
    fontFamily: 'DM Sans',
  },
  startMeta: {
    fontSize: 11,
    color: c.textMuted,
    fontFamily: 'DM Sans',
    marginTop: 3,
  },
  startBadge: {
    borderRadius: 10,
    backgroundColor: c.accent,
    borderWidth: 2,
    borderColor: c.text,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  planContainer: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: c.text,
    backgroundColor: c.tintLimeFaint,
    marginBottom: 8,
    overflow: 'hidden',
  },
  planSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  planSelectDivider: {
    borderBottomWidth: 2,
    borderBottomColor: c.text,
  },
  planSelectChip: {
    borderRadius: 8,
    backgroundColor: c.accent,
    borderWidth: 2,
    borderColor: c.text,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: c.shadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  planSelectChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: c.onAccent,
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  planSelectText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
    fontFamily: 'DM Sans',
  },
  planOption: {
    backgroundColor: c.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
  },
  planOptionActive: {
    backgroundColor: c.tintLime,
    borderLeftWidth: 4,
    borderLeftColor: c.accent,
  },
  planOptionText: {
    fontSize: 14,
    color: c.text,
    fontFamily: 'DM Sans',
  },
  planOptionTextActive: {
    fontWeight: '700',
  },
  planDays: {
    padding: 10,
  },
  startBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: c.onAccent,
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  calendarCard: {
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
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  calMonth: {
    fontSize: 15,
    fontWeight: '800',
    color: c.text,
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calCell: {
    width: '14.28%',
    alignItems: 'center',
    marginVertical: 2,
  },
  calWeekday: {
    fontSize: 10,
    fontWeight: '700',
    color: c.textMuted,
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
  },
  calDay: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayActive: {
    backgroundColor: c.accent,
    borderWidth: 2,
    borderColor: c.text,
  },
  calDayHot: {
    backgroundColor: c.accentDeep,
  },
  calDayToday: {
    borderWidth: 2,
    borderColor: c.text,
  },
  calDayText: {
    fontSize: 12,
    color: c.text,
    fontFamily: 'DM Sans',
  },
  calDayTextActive: {
    color: c.onAccent,
    fontWeight: '700',
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: c.surface,
    borderWidth: 2,
    borderColor: c.text,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    shadowColor: c.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  emptyText: {
    textAlign: 'center',
    color: c.textMuted,
    fontSize: 13,
    fontFamily: 'DM Sans',
    marginVertical: 16,
  },
  exerciseCard: {
    borderRadius: 12,
    backgroundColor: c.card,
    borderWidth: 2,
    borderColor: c.text,
    padding: 14,
    marginBottom: 8,
    shadowColor: c.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  exerciseCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: '600',
    color: c.text,
    fontFamily: 'DM Sans',
  },
  exerciseMeta: {
    fontSize: 10,
    color: c.textMuted,
    fontFamily: 'DM Sans',
    marginTop: 2,
  },
  exerciseMetaPrimary: {
    color: c.text,
    fontWeight: '700',
  },
  removeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    // Transparent border reserves space so rows don't jump when logged
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  // Checked = logged: the whole row goes lime so completion is unmissable
  setRowDone: {
    backgroundColor: c.tintLime,
    borderColor: c.accentDeep,
  },
  cardioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  setLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: c.textMuted,
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    width: 44,
  },
  setLabelDone: {
    color: c.accentDeep,
  },
  setInput: {
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
    textAlign: 'center',
  },
  setUnit: {
    fontSize: 10,
    color: c.textMuted,
    fontFamily: 'DM Sans',
    width: 28,
  },
  setTimes: {
    fontSize: 12,
    color: c.textMuted,
  },
  setRemove: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: c.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setDone: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.cardAlt,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setDoneActive: {
    backgroundColor: c.accent,
    borderColor: c.text,
  },
  restBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    backgroundColor: c.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  restLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: c.onPrimary,
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  restClock: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: c.onPrimary,
    fontFamily: 'Barlow Condensed',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  restAdjustBtn: {
    borderRadius: 10,
    backgroundColor: c.onPrimaryFaint,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  restAdjustText: {
    fontSize: 11,
    fontWeight: '700',
    color: c.onPrimary,
    fontFamily: 'Barlow Condensed',
  },
  restSkip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: c.onPrimaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  addSetText: {
    fontSize: 12,
    color: c.textMuted,
    fontFamily: 'DM Sans',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: c.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  addBtnText: {
    fontSize: 13,
    color: c.textMuted,
    fontFamily: 'DM Sans',
  },
  sessionHint: {
    fontSize: 11,
    color: c.textMuted,
    fontFamily: 'DM Sans',
    marginBottom: 10,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: c.danger,
    paddingVertical: 10,
    marginTop: 16,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: c.danger,
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
})
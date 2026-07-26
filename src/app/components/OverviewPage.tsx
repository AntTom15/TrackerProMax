import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { format, parseISO, isToday, isYesterday, subDays } from 'date-fns';
import { Settings, Flame, Footprints, Droplets, Moon } from './Icons';
import { ThemeColors, useThemedStyles } from '../lib/theme';
import { useSteps, StepsByDate } from '../lib/steps';
import type {
  Food,
  LogEntry,
  SleepEntry,
  WorkoutSession,
} from '../lib/types';

interface OverviewPageProps {
  store: {
    foods: Food[];
    log: LogEntry[];
    sessions: WorkoutSession[];
    water: Record<string, number>;
    waterGoalOz: number;
    sleep: SleepEntry[];
    steps: StepsByDate;
    snapshotSteps: (patch: StepsByDate) => void;
  };
}

const fmtDur = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

export default function OverviewPage({ store }: OverviewPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const navigation = useNavigation();
  const { foods, log, sessions, water, waterGoalOz, sleep, steps, snapshotSteps } =
    store;

  // Overview lives directly in the tab navigator, so jumping to a screen
  // inside another tab's stack needs the nested form. The nonce forces
  // params through even when the target screen is already mounted with
  // the same values (e.g. re-tapping the same day twice).
  const goTo = (tab: string, screen: string, params?: Record<string, unknown>) =>
    (navigation as any).navigate(tab, {
      screen,
      params: { ...params, nonce: Date.now() },
    });

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // ---- Steps: live from the phone's pedometer, snapshotted daily ----
  const stepsAvailable = useSteps(snapshotSteps);
  const stepsToday = steps[todayStr];
  const foodById = new Map(foods.map((f) => [f.id, f]));

  // ---- Today's diet ----
  const todayEntries = log.filter((e) => e.date === todayStr);
  const calsToday = Math.round(
    todayEntries.reduce(
      (a, e) =>
        a + (foodById.get(e.foodId)?.nutrients?.calories ?? 0) * e.servings,
      0
    )
  );
  const proteinToday = Math.round(
    todayEntries.reduce(
      (a, e) =>
        a + (foodById.get(e.foodId)?.nutrients?.protein ?? 0) * e.servings,
      0
    )
  );

  // ---- Water today ----
  const waterToday = Math.round((water[todayStr] ?? 0) * 10) / 10;

  // ---- Sleep: most recent logged night ----
  const lastSleep =
    [...sleep].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const sleepSub = lastSleep
    ? lastSleep.date === todayStr
      ? 'Last night'
      : format(parseISO(lastSleep.date), 'EEE, MMM d')
    : 'Log it in Rest';

  // ---- Streak: consecutive days with a meal logged or a workout
  // finished. An empty today doesn't break the chain yet.
  const activeDays = new Set<string>();
  log.forEach((e) => activeDays.add(e.date));
  sessions.forEach((s) => {
    if (s.finishedAt) activeDays.add(format(s.finishedAt, 'yyyy-MM-dd'));
  });
  // Flame lights up as soon as today has at least one entry.
  const litToday = activeDays.has(todayStr);
  let streak = 0;
  let cursor = new Date();
  if (!activeDays.has(todayStr)) cursor = subDays(cursor, 1);
  while (activeDays.has(format(cursor, 'yyyy-MM-dd'))) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // ---- Recent activity: latest real events across the app ----
  const fmtWhen = (ts: number) =>
    isToday(ts)
      ? `Today ${format(ts, 'h:mm a')}`
      : isYesterday(ts)
        ? `Yesterday ${format(ts, 'h:mm a')}`
        : format(ts, 'MMM d');

  // Each event carries its own destination so the row is tappable.
  const events: {
    label: string;
    time: string;
    tag: string;
    ts: number;
    onPress: () => void;
  }[] = [];
  sessions.forEach((s) => {
    if (s.finishedAt)
      events.push({
        label: s.name || 'Workout',
        time: fmtWhen(s.finishedAt),
        tag: 'Exercise',
        ts: s.finishedAt,
        // Straight to that specific workout's summary.
        onPress: () =>
          goTo('ExerciseTab', 'SessionDetail', { sessionId: s.id }),
      });
  });
  log.forEach((e) => {
    const ts = e.loggedAt ?? parseISO(e.date).getTime();
    events.push({
      label: foodById.get(e.foodId)?.name ?? 'Food',
      time: fmtWhen(ts),
      tag: e.meal,
      ts,
      // Logger opened on the day that food was eaten.
      onPress: () => goTo('DietTab', 'Logger', { date: e.date }),
    });
  });
  sleep.forEach((e) => {
    // Sleep has no timestamp; anchor it to 8 AM of its wake date.
    const ts = parseISO(e.date).getTime() + 8 * 3600 * 1000;
    events.push({
      label: `Slept ${fmtDur(e.durationMin)}`,
      time: isToday(ts)
        ? 'This morning'
        : isYesterday(ts)
          ? 'Yesterday'
          : format(ts, 'MMM d'),
      tag: 'Rest',
      ts,
      onPress: () => goTo('ExerciseTab', 'Rest'),
    });
  });
  const activities = events.sort((a, b) => b.ts - a.ts).slice(0, 4);

  const STAT_CARDS = [
    {
      icon: <Flame size={18} color="#fb923c" />,
      label: 'Calories Today',
      value: String(calsToday),
      sub: `${proteinToday}g protein`,
      color: c.tintOrange,
      onPress: () => goTo('DietTab', 'Logger', { date: todayStr }),
    },
    {
      icon: <Footprints size={18} color="#60a5fa" />,
      label: 'Steps',
      value:
        stepsAvailable && stepsToday != null
          ? stepsToday.toLocaleString()
          : '—',
      sub:
        stepsAvailable === false
          ? 'Unavailable on this device'
          : stepsAvailable && stepsToday != null
            ? 'From your phone'
            : 'Reading motion data…',
      color: c.tintBlue,
      // Steps come from the phone's motion chip rather than any logged
      // workout, so there's no exact matching screen — the tracker is
      // the closest movement hub until a steps history page exists.
      onPress: () => goTo('ExerciseTab', 'WorkoutTracker'),
    },
    {
      icon: <Droplets size={18} color="#22d3ee" />,
      label: 'Water',
      value: `${waterToday} oz`,
      sub: `of ${waterGoalOz} oz goal`,
      color: c.tintCyan,
      onPress: () => goTo('DietTab', 'Logger', { date: todayStr }),
    },
    {
      icon: <Moon size={18} color="#a78bfa" />,
      label: 'Sleep',
      value: lastSleep ? fmtDur(lastSleep.durationMin) : '—',
      sub: sleepSub,
      color: c.tintPurple,
      onPress: () => goTo('ExerciseTab', 'Rest'),
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitials}>H</Text>
          </View>
          <View>
            <Text style={styles.branding}>Metamorphosis INC™</Text>
            <Text style={styles.greeting}>{greeting}, Heisenburg</Text>
          </View>
        </View>
        <Pressable style={styles.settingsBtn}>
          <Settings size={20} color={c.textMuted} />
        </Pressable>
      </View>

      {/* Hero streak card */}
      <View style={styles.streakCard}>
        <View>
          <Text style={styles.streakLabel}>Current Streak</Text>
          <Text style={styles.streakValue}>
            {streak} day{streak === 1 ? '' : 's'}
          </Text>
          <Text style={styles.streakSub}>
            {streak > 0
              ? "Keep it going — don't break the chain."
              : 'Log a meal or finish a workout to start one.'}
          </Text>
        </View>
        <Flame size={56} color={litToday ? '#fb923c' : c.onPrimaryFaint} />
      </View>

      {/* Quick stats grid */}
      <View style={styles.statsGrid}>
        {STAT_CARDS.map((card, i) => (
          <Pressable
            key={i}
            onPress={card.onPress}
            style={({ pressed }) => [
              styles.statCard,
              { backgroundColor: card.color },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View style={styles.statIcon}>{card.icon}</View>
            <Text style={styles.statLabel}>{card.label}</Text>
            <Text style={styles.statValue}>{card.value}</Text>
            <Text style={styles.statSub}>{card.sub}</Text>
          </Pressable>
        ))}
      </View>

      {/* Recent activity */}
      <View style={styles.activitySection}>
        <Text style={styles.activityTitle}>Recent Activity</Text>
        {activities.length === 0 ? (
          <Text style={styles.activityEmpty}>
            Nothing yet — meals, workouts, and sleep you log will show up
            here.
          </Text>
        ) : (
          <View style={styles.activityList}>
            {activities.map((item, i) => (
              <Pressable
                key={i}
                onPress={item.onPress}
                style={({ pressed }) => [
                  styles.activityItem,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={styles.activityTextContainer}>
                  <Text style={styles.activityLabel}>{item.label}</Text>
                  <Text style={styles.activityTime}>{item.time}</Text>
                </View>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{item.tag}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
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
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(163,230,53,0.25)',
    borderWidth: 2,
    borderColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 15,
    fontWeight: '800',
    color: c.text,
    fontFamily: 'Barlow Condensed',
  },
  branding: {
    fontSize: 10,
    letterSpacing: 0.8,
    color: c.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
    fontFamily: 'Barlow Condensed',
  },
  greeting: {
    fontSize: 14,
    color: c.text,
    fontWeight: '500',
    fontFamily: 'DM Sans',
  },
  settingsBtn: {
    padding: 8,
  },
  streakCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: c.primary,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streakLabel: {
    fontSize: 10,
    letterSpacing: 0.8,
    color: c.onPrimary,
    opacity: 0.75,
    textTransform: 'uppercase',
    fontWeight: '600',
    fontFamily: 'Barlow Condensed',
    marginBottom: 4,
  },
  streakValue: {
    fontSize: 44,
    color: c.onPrimary,
    fontWeight: '800',
    fontFamily: 'Barlow Condensed',
  },
  streakSub: {
    fontSize: 14,
    color: c.onPrimary,
    opacity: 0.75,
    fontFamily: 'DM Sans',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: c.text,
    padding: 16,
    shadowColor: c.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  statIcon: {
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 10,
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontFamily: 'Barlow Condensed',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 24,
    color: c.text,
    fontWeight: '800',
    fontFamily: 'Barlow Condensed',
    marginTop: 4,
  },
  statSub: {
    fontSize: 11,
    color: c.textMuted,
    fontFamily: 'DM Sans',
    marginTop: 4,
  },
  activitySection: {
    paddingHorizontal: 20,
    marginBottom: 80,
  },
  activityTitle: {
    fontSize: 10,
    letterSpacing: 0.8,
    color: c.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
    fontFamily: 'Barlow Condensed',
    marginBottom: 12,
  },
  activityList: {
    gap: 8,
  },
  activityEmpty: {
    fontSize: 12,
    color: c.textMuted,
    fontFamily: 'DM Sans',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    backgroundColor: c.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: c.text,
  },
  activityTextContainer: {
    flex: 1,
  },
  activityLabel: {
    fontSize: 14,
    color: c.text,
    fontWeight: '500',
    fontFamily: 'DM Sans',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 11,
    color: c.textMuted,
    fontFamily: 'DM Sans',
  },
  tag: {
    backgroundColor: c.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 12,
  },
  tagText: {
    fontSize: 10,
    color: c.onPrimary,
    fontWeight: '700',
    letterSpacing: 0.4,
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
  },
});

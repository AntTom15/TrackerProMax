import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ClipboardList, Timer, Flame, Moon } from './Icons';
import { ThemeColors, useThemedStyles } from '../lib/theme';

const TILES: {
  id: string;
  label: string;
  Icon: typeof ClipboardList;
  desc: string;
  tint: keyof ThemeColors;
}[] = [
  {
    id: 'PlanMaker',
    label: 'Plan Maker',
    Icon: ClipboardList,
    desc: 'Build & edit workout plans',
    tint: 'tintBlue',
  },
  {
    id: 'WorkoutTracker',
    label: 'Tracker',
    Icon: Timer,
    desc: 'Log sets, reps & cardio',
    tint: 'tintLime',
  },
  {
    // The coach moved to its own tab — it reads diet, sleep and pantry
    // too, so filing it under Exercise undersold it. This slot now
    // fronts the workout history that was previously only reachable by
    // drilling into the Tracker.
    id: 'Progress',
    label: 'Progress',
    Icon: Flame,
    desc: 'History, PRs & est. 1RM',
    tint: 'tintPurple',
  },
  {
    id: 'Rest',
    label: 'Rest',
    Icon: Moon,
    desc: 'Sleep calculator & logger',
    tint: 'tintCyan',
  },
];

export default function ExercisePage() {
  const { c, styles } = useThemedStyles(createStyles);
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const tileWidth = (width - 40 - 16) / 2;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.branding}>Metamorphosis INC™</Text>
        <Text style={styles.title}>Exercise</Text>
      </View>

      <View style={styles.centerContent}>
        <View style={styles.grid}>
          {TILES.map(({ id, label, Icon, desc, tint }) => (
            <Pressable
              key={id}
              style={[
                styles.tile,
                { backgroundColor: c[tint], width: tileWidth, height: tileWidth },
              ]}
              onPress={() => navigation.navigate(id as never)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon size={28} color={c.text} />
              <View style={styles.tileContent}>
                <Text style={styles.tileLabel}>{label}</Text>
                <Text style={styles.tileDesc}>{desc}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  branding: {
    fontSize: 10,
    letterSpacing: 0.8,
    color: c.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
    fontFamily: 'Barlow Condensed',
    marginBottom: 4,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: c.text,
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  grid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  tile: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: c.text,
    padding: 16,
    justifyContent: 'space-between',
    shadowColor: c.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  tileContent: {
    marginTop: 8,
  },
  tileLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: c.text,
    fontFamily: 'Barlow Condensed',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tileDesc: {
    fontSize: 11,
    color: c.textMuted,
    fontFamily: 'DM Sans',
  },
});

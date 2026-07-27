import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Image,
  Alert,
} from 'react-native';
import { format, subDays } from 'date-fns';
import { PenLine, Moon, Timer, Droplets, Dumbbell } from './Icons';
import { keyboardAwareScrollProps } from '../lib/keyboard';
import { deleteProfilePhoto, pickProfilePhoto } from '../lib/photo';
import { useThemedStyles, ThemeColors } from '../lib/theme';
import type { Food, LogEntry, WorkoutSession } from '../lib/types';
import type { CoachGoal, CoachProfile, DietStyle } from '../lib/coach';

const GOALS: [CoachGoal, string][] = [
  ['muscle', 'Build muscle'],
  ['strength', 'Get stronger'],
  ['fatloss', 'Lose fat'],
  ['health', 'Health'],
];

const DIETS: [DietStyle, string][] = [
  ['animal', 'Animal-based'],
  ['keto', 'Keto'],
  ['omnivore', 'Omnivore'],
  ['plant', 'Plant-forward'],
];

interface ProfilePageProps {
  foods: Food[];
  log: LogEntry[];
  sessions: WorkoutSession[];
  darkMode: boolean;
  onToggleDarkMode: (on: boolean) => void;
  restSeconds: number;
  onChangeRestSeconds: (seconds: number) => void;
  waterGoalOz: number;
  onChangeWaterGoal: (oz: number) => void;
  waterCupOz: number;
  onChangeWaterCup: (oz: number) => void;
  coachProfile: CoachProfile;
  onChangeCoachProfile: (patch: Partial<CoachProfile>) => void;
  profilePhoto: string | null;
  onChangeProfilePhoto: (uri: string | null) => void;
}

// Consecutive days (ending today) with at least one meal logged.
function logStreak(log: LogEntry[]): number {
  const days = new Set(log.map((e) => e.date));
  let streak = 0;
  let cursor = new Date();
  while (days.has(format(cursor, 'yyyy-MM-dd'))) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }
  return streak;
}

const fmtRest = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function ProfilePage({
  foods,
  log,
  sessions,
  darkMode,
  onToggleDarkMode,
  restSeconds,
  onChangeRestSeconds,
  waterGoalOz,
  onChangeWaterGoal,
  waterCupOz,
  onChangeWaterCup,
  coachProfile,
  onChangeCoachProfile,
  profilePhoto,
  onChangeProfilePhoto,
}: ProfilePageProps) {
  const { c, styles } = useThemedStyles(createStyles);

  const workouts = sessions.filter((s) => s.finishedAt !== null).length;
  const customFoods = foods.filter((f) => f.uploadedBy === 'You').length;
  const streak = logStreak(log);

  // Photo picking is async (permission prompt + copy), so guard against
  // a double tap launching two pickers.
  const [pickingPhoto, setPickingPhoto] = useState(false);

  const choosePhoto = async () => {
    if (pickingPhoto) return;
    setPickingPhoto(true);
    try {
      const res = await pickProfilePhoto(profilePhoto);
      if (res.status === 'ok') onChangeProfilePhoto(res.uri);
      else if (res.status === 'denied') {
        Alert.alert(
          'Photo access needed',
          'Allow photo library access in Settings to set a profile photo.'
        );
      }
    } finally {
      setPickingPhoto(false);
    }
  };

  const onAvatarPress = () => {
    if (!profilePhoto) {
      choosePhoto();
      return;
    }
    Alert.alert('Profile photo', undefined, [
      { text: 'Choose a new photo', onPress: choosePhoto },
      {
        text: 'Remove photo',
        style: 'destructive',
        onPress: () => {
          deleteProfilePhoto(profilePhoto);
          onChangeProfilePhoto(null);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.branding}>Metamorphosis INC™</Text>
        <Text style={styles.title}>Profile</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Identity card */}
        <View style={styles.identityCard}>
          <Pressable
            onPress={onAvatarPress}
            style={({ pressed }) => [
              styles.avatarWrap,
              pressed && { opacity: 0.7 },
            ]}
          >
            <View style={styles.avatar}>
              {profilePhoto ? (
                <Image
                  source={{ uri: profilePhoto }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarInitials}>H</Text>
              )}
            </View>
            <View style={styles.avatarEdit}>
              <PenLine size={11} color={c.onPrimary} />
            </View>
          </Pressable>
          <Text style={styles.name}>Heisenburg</Text>
          <Text style={styles.email}>phonecalculatorclock@gmail.com</Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{workouts}</Text>
              <Text style={styles.statLabel}>Workouts</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{streak}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{customFoods}</Text>
              <Text style={styles.statLabel}>Foods Added</Text>
            </View>
          </View>
        </View>

        {/* Settings */}
        <Text style={styles.sectionHeader}>Settings</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Moon size={18} color={c.textMuted} />
              <Text style={styles.settingLabel}>Dark mode</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={onToggleDarkMode}
              trackColor={{ false: c.border, true: c.accent }}
              thumbColor={c.surface}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Timer size={18} color={c.textMuted} />
              <Text style={styles.settingLabel}>Rest timer</Text>
            </View>
            <View style={styles.stepper}>
              <Pressable
                onPress={() =>
                  onChangeRestSeconds(Math.max(15, restSeconds - 15))
                }
                style={styles.stepperBtn}
                hitSlop={4}
              >
                <Text style={styles.stepperBtnText}>−</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{fmtRest(restSeconds)}</Text>
              <Pressable
                onPress={() =>
                  onChangeRestSeconds(Math.min(600, restSeconds + 15))
                }
                style={styles.stepperBtn}
                hitSlop={4}
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Droplets size={18} color={c.textMuted} />
              <Text style={styles.settingLabel}>Water goal</Text>
            </View>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => onChangeWaterGoal(Math.max(16, waterGoalOz - 8))}
                style={styles.stepperBtn}
                hitSlop={4}
              >
                <Text style={styles.stepperBtnText}>−</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{waterGoalOz} oz</Text>
              <Pressable
                onPress={() =>
                  onChangeWaterGoal(Math.min(256, waterGoalOz + 8))
                }
                style={styles.stepperBtn}
                hitSlop={4}
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Droplets size={18} color={c.textMuted} />
              <Text style={styles.settingLabel}>Cup size</Text>
            </View>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => onChangeWaterCup(Math.max(2, waterCupOz - 2))}
                style={styles.stepperBtn}
                hitSlop={4}
              >
                <Text style={styles.stepperBtnText}>−</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{waterCupOz} oz</Text>
              <Pressable
                onPress={() => onChangeWaterCup(Math.min(64, waterCupOz + 2))}
                style={styles.stepperBtn}
                hitSlop={4}
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

          {/* Mocked-out rows */}
          {(['Units (kg / lb)', 'Notifications', 'Account & data'] as const).map(
            (label) => (
              <View key={label} style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: c.textFaint }]}>
                  {label}
                </Text>
                <View style={styles.soonBadge}>
                  <Text style={styles.soonBadgeText}>Soon</Text>
                </View>
              </View>
            )
          )}
        </View>

        {/* Coach profile — tunes the rules engine and personalizes AI */}
        <Text style={[styles.sectionHeader, { marginTop: 24 }]}>
          Coach Profile
        </Text>
        <View style={styles.settingsCard}>
          <Text style={styles.coachLabel}>Goal</Text>
          <View style={styles.chipsRow}>
            {GOALS.map(([id, label]) => (
              <Pressable
                key={id}
                onPress={() => onChangeCoachProfile({ goal: id })}
                style={[
                  styles.chip,
                  coachProfile.goal === id && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    coachProfile.goal === id && styles.chipTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.coachLabel}>Diet style</Text>
          <View style={styles.chipsRow}>
            {DIETS.map(([id, label]) => (
              <Pressable
                key={id}
                onPress={() => onChangeCoachProfile({ dietStyle: id })}
                style={[
                  styles.chip,
                  coachProfile.dietStyle === id && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    coachProfile.dietStyle === id && styles.chipTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <PenLine size={18} color={c.textMuted} />
              <Text style={styles.settingLabel}>Body weight</Text>
            </View>
            <View style={styles.stepper}>
              <Pressable
                onPress={() =>
                  onChangeCoachProfile({
                    bodyWeightLb:
                      coachProfile.bodyWeightLb <= 60
                        ? 0
                        : coachProfile.bodyWeightLb - 5,
                  })
                }
                style={styles.stepperBtn}
                hitSlop={4}
              >
                <Text style={styles.stepperBtnText}>−</Text>
              </Pressable>
              <Text style={styles.stepperValue}>
                {coachProfile.bodyWeightLb > 0
                  ? `${coachProfile.bodyWeightLb} lb`
                  : '—'}
              </Text>
              <Pressable
                onPress={() =>
                  onChangeCoachProfile({
                    bodyWeightLb:
                      coachProfile.bodyWeightLb === 0
                        ? 150
                        : Math.min(400, coachProfile.bodyWeightLb + 5),
                  })
                }
                style={styles.stepperBtn}
                hitSlop={4}
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Dumbbell size={18} color={c.textMuted} />
              <Text style={styles.settingLabel}>Workouts / week</Text>
            </View>
            <View style={styles.stepper}>
              <Pressable
                onPress={() =>
                  onChangeCoachProfile({
                    weeklyWorkoutTarget: Math.max(
                      1,
                      coachProfile.weeklyWorkoutTarget - 1
                    ),
                  })
                }
                style={styles.stepperBtn}
                hitSlop={4}
              >
                <Text style={styles.stepperBtnText}>−</Text>
              </Pressable>
              <Text style={styles.stepperValue}>
                {coachProfile.weeklyWorkoutTarget}
              </Text>
              <Pressable
                onPress={() =>
                  onChangeCoachProfile({
                    weeklyWorkoutTarget: Math.min(
                      7,
                      coachProfile.weeklyWorkoutTarget + 1
                    ),
                  })
                }
                style={styles.stepperBtn}
                hitSlop={4}
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <Text style={styles.footnote}>
          Profile editing and account sync are on the roadmap.
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
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
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
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    identityCard: {
      alignItems: 'center',
      borderRadius: 16,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      paddingVertical: 24,
      paddingHorizontal: 16,
      marginBottom: 20,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    avatarWrap: {
      marginBottom: 12,
    },
    avatar: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: 'rgba(163,230,53,0.25)',
      borderWidth: 2,
      borderColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    avatarInitials: {
      fontSize: 34,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
    },
    avatarEdit: {
      position: 'absolute',
      bottom: 0,
      right: -2,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: c.primary,
      borderWidth: 2,
      borderColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      fontSize: 20,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
    },
    email: {
      fontSize: 12,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      marginTop: 2,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 18,
    },
    stat: {
      flex: 1,
      alignItems: 'center',
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
    statDivider: {
      width: 1,
      height: 28,
      backgroundColor: c.border,
    },
    sectionHeader: {
      fontSize: 10,
      letterSpacing: 0.8,
      color: c.text,
      fontWeight: '700',
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    settingsCard: {
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 16,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
    },
    settingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    settingLabel: {
      fontSize: 14,
      color: c.text,
      fontFamily: 'DM Sans',
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    stepperBtn: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: c.cardAlt,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperBtnText: {
      fontSize: 15,
      color: c.text,
      fontWeight: '600',
      lineHeight: 18,
    },
    stepperValue: {
      fontSize: 14,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      minWidth: 42,
      textAlign: 'center',
    },
    soonBadge: {
      borderRadius: 10,
      backgroundColor: c.cardAlt,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    soonBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    coachLabel: {
      fontSize: 9,
      letterSpacing: 0.6,
      color: c.textMuted,
      fontWeight: '600',
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      marginBottom: 6,
      marginTop: 2,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 12,
    },
    chip: {
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.border,
      backgroundColor: c.cardAlt,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    chipActive: {
      backgroundColor: c.accent,
      borderColor: c.text,
    },
    chipText: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    chipTextActive: {
      color: c.onAccent,
    },
    footnote: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      textAlign: 'center',
      marginTop: 14,
    },
  });

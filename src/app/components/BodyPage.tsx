import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { format, parseISO, isToday, differenceInDays } from 'date-fns';
import { ChevronLeft, ChevronDown, ChevronUp, Trash } from './Icons';
import { keyboardAwareScrollProps } from '../lib/keyboard';
import { ThemeColors, useThemedStyles } from '../lib/theme';
import NumericInput from './components2/NumericInput';
import type { BodyEntry, MeasurementKey } from '../lib/types';

interface BodyPageProps {
  bodyLog: BodyEntry[];
  onAddEntry: (entry: Omit<BodyEntry, 'id'>) => void;
  onDeleteEntry: (entryId: string) => void;
  // Body weight drives the coach's protein and calorie maths, so a
  // weigh-in updates the profile rather than leaving two sources of truth.
  onChangeBodyWeight: (lb: number) => void;
  profileWeightLb: number;
}

const MEASUREMENTS: { key: MeasurementKey; label: string }[] = [
  { key: 'neck', label: 'Neck' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'chest', label: 'Chest' },
  { key: 'arms', label: 'Arms' },
  { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' },
  { key: 'thighs', label: 'Thighs' },
  { key: 'calves', label: 'Calves' },
];

const todayKey = () => format(new Date(), 'yyyy-MM-dd');

export default function BodyPage({
  bodyLog,
  onAddEntry,
  onDeleteEntry,
  onChangeBodyWeight,
  profileWeightLb,
}: BodyPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const navigation = useNavigation();

  const sorted = [...bodyLog].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0] ?? null;

  // ---- entry form ----
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [measureOpen, setMeasureOpen] = useState(false);
  const [measures, setMeasures] = useState<Record<string, string>>({});

  const num = (t: string) => {
    const v = parseFloat(t);
    return isFinite(v) && v > 0 ? v : null;
  };

  const save = () => {
    const w = num(weight);
    const bf = num(bodyFat);
    const m: Partial<Record<MeasurementKey, number>> = {};
    for (const { key } of MEASUREMENTS) {
      const v = num(measures[key] ?? '');
      if (v != null) m[key] = v;
    }
    if (w == null && bf == null && Object.keys(m).length === 0) {
      Alert.alert('Nothing to save', 'Enter a weight or a measurement first.');
      return;
    }
    onAddEntry({
      date: todayKey(),
      weightLb: w,
      bodyFatPct: bf,
      measurements: Object.keys(m).length > 0 ? m : undefined,
    });
    if (w != null) onChangeBodyWeight(w);
    setWeight('');
    setBodyFat('');
    setMeasures({});
    setMeasureOpen(false);
  };

  // ---- trend: latest weight vs the oldest within ~30 days ----
  const weighIns = sorted.filter((e) => (e.weightLb ?? 0) > 0);
  const current = weighIns[0] ?? null;
  const priorWindow = weighIns.find(
    (e) =>
      current != null &&
      differenceInDays(parseISO(current.date), parseISO(e.date)) >= 7
  );
  const delta =
    current && priorWindow
      ? (current.weightLb ?? 0) - (priorWindow.weightLb ?? 0)
      : null;
  const deltaDays =
    current && priorWindow
      ? differenceInDays(parseISO(current.date), parseISO(priorWindow.date))
      : 0;

  const confirmDelete = (entry: BodyEntry) =>
    Alert.alert('Delete entry?', format(parseISO(entry.date), 'EEE, MMM d'), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onDeleteEntry(entry.id),
      },
    ]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ChevronLeft size={22} color={c.textMuted} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Body</Text>
          <Text style={styles.subtitle}>Weight, body fat & measurements</Text>
        </View>
      </View>

      <ScrollView
        {...keyboardAwareScrollProps}
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Current */}
        <View style={styles.heroCard}>
          <View>
            <View style={styles.heroRow}>
              <Text style={styles.heroValue}>
                {current?.weightLb ?? (profileWeightLb > 0 ? profileWeightLb : '—')}
              </Text>
              <Text style={styles.heroUnit}>lb</Text>
            </View>
            <Text style={styles.heroSub}>
              {current
                ? isToday(parseISO(current.date))
                  ? 'Logged today'
                  : `Last weighed ${format(parseISO(current.date), 'MMM d')}`
                : 'No weigh-ins yet'}
            </Text>
          </View>
          {delta != null && (
            <View style={styles.deltaWrap}>
              <Text
                style={[
                  styles.deltaValue,
                  delta > 0 ? styles.deltaUp : styles.deltaDown,
                ]}
              >
                {delta > 0 ? '+' : ''}
                {Math.round(delta * 10) / 10}
              </Text>
              <Text style={styles.deltaLabel}>lb / {deltaDays}d</Text>
            </View>
          )}
        </View>

        {/* Log today */}
        <Text style={styles.sectionTitle}>Log today</Text>
        <View style={styles.formCard}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Weight</Text>
            <NumericInput
              value={weight}
              onChangeText={setWeight}
              placeholder={
                current?.weightLb ? String(current.weightLb) : 'e.g. 180'
              }
              placeholderTextColor={c.textFaint}
              style={styles.fieldInput}
            />
            <Text style={styles.fieldUnit}>lb</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Body fat</Text>
            <NumericInput
              value={bodyFat}
              onChangeText={setBodyFat}
              placeholder="optional"
              placeholderTextColor={c.textFaint}
              style={styles.fieldInput}
            />
            <Text style={styles.fieldUnit}>%</Text>
          </View>

          <Pressable
            onPress={() => setMeasureOpen((o) => !o)}
            style={styles.measureToggle}
            hitSlop={4}
          >
            <Text style={styles.measureToggleText}>Measurements (inches)</Text>
            {measureOpen ? (
              <ChevronUp size={16} color={c.textMuted} />
            ) : (
              <ChevronDown size={16} color={c.textMuted} />
            )}
          </Pressable>
          {measureOpen && (
            <View style={styles.measureGrid}>
              {MEASUREMENTS.map(({ key, label }) => (
                <View key={key} style={styles.measureItem}>
                  <Text style={styles.measureLabel}>{label}</Text>
                  <NumericInput
                    value={measures[key] ?? ''}
                    onChangeText={(t: string) =>
                      setMeasures((m) => ({ ...m, [key]: t }))
                    }
                    placeholder="—"
                    placeholderTextColor={c.textFaint}
                    style={styles.measureInput}
                  />
                </View>
              ))}
            </View>
          )}

          <Pressable onPress={save} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>Save</Text>
          </Pressable>
          <Text style={styles.hint}>
            Saving a weight also updates your Coach Profile, which is what
            the coach uses for protein and calorie targets.
          </Text>
        </View>

        {/* History */}
        {sorted.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>History</Text>
            {sorted.map((entry) => {
              const m = entry.measurements ?? {};
              const mKeys = Object.keys(m) as MeasurementKey[];
              return (
                <View key={entry.id} style={styles.entryRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.entryDate}>
                      {format(parseISO(entry.date), 'EEE, MMM d')}
                    </Text>
                    <Text style={styles.entryMeta}>
                      {[
                        entry.weightLb ? `${entry.weightLb} lb` : null,
                        entry.bodyFatPct ? `${entry.bodyFatPct}% bf` : null,
                        mKeys.length
                          ? mKeys
                              .map(
                                (k) =>
                                  `${
                                    MEASUREMENTS.find((x) => x.key === k)
                                      ?.label ?? k
                                  } ${m[k]}"`
                              )
                              .join(' · ')
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => confirmDelete(entry)}
                    style={styles.deleteBtn}
                    hitSlop={6}
                  >
                    <Trash size={14} color={c.textMuted} />
                  </Pressable>
                </View>
              );
            })}
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
      justifyContent: 'space-between',
      borderRadius: 12,
      backgroundColor: c.tintOrange,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 20,
      paddingVertical: 16,
      marginBottom: 16,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    heroValue: {
      fontSize: 32,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
    },
    heroUnit: { fontSize: 13, color: c.textMuted, fontFamily: 'DM Sans' },
    heroSub: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      marginTop: 2,
    },
    deltaWrap: { alignItems: 'flex-end' },
    deltaValue: { fontSize: 20, fontWeight: '800', fontFamily: 'Barlow Condensed' },
    deltaUp: { color: c.accentDeep },
    deltaDown: { color: c.blue },
    deltaLabel: {
      fontSize: 10,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
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
    formCard: {
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      padding: 12,
      marginBottom: 16,
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    fieldLabel: {
      flex: 1,
      fontSize: 13,
      color: c.text,
      fontFamily: 'DM Sans',
    },
    fieldInput: {
      width: 96,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 10,
      paddingVertical: 7,
      fontSize: 14,
      color: c.text,
      fontFamily: 'DM Sans',
      textAlign: 'center',
    },
    fieldUnit: {
      width: 22,
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
    },
    measureToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 10,
      backgroundColor: c.cardAlt,
      borderWidth: 2,
      borderColor: c.border,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginTop: 4,
    },
    measureToggleText: {
      fontSize: 12,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    measureGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10,
    },
    measureItem: { width: '47%' },
    measureLabel: {
      fontSize: 10,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 2,
    },
    measureInput: {
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 8,
      paddingVertical: 6,
      fontSize: 13,
      color: c.text,
      fontFamily: 'DM Sans',
      textAlign: 'center',
    },
    saveBtn: {
      marginTop: 12,
      borderRadius: 10,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.text,
      paddingVertical: 10,
      alignItems: 'center',
      shadowColor: c.shadow,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    saveBtnText: {
      fontSize: 13,
      fontWeight: '800',
      color: c.onAccent,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    hint: {
      fontSize: 10,
      color: c.textFaint,
      fontFamily: 'DM Sans',
      marginTop: 8,
      lineHeight: 14,
    },
    entryRow: {
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
    entryDate: {
      fontSize: 13,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    entryMeta: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      marginTop: 2,
    },
    deleteBtn: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: c.cardAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

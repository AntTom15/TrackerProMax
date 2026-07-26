import { useState, type ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { format, parseISO, addDays, isToday } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Moon, Sun, Trash } from './Icons';
import type { SleepEntry } from '../lib/types';
import { ThemeColors, useThemedStyles } from '../lib/theme';

interface RestPageProps {
  sleep: SleepEntry[];
  onAddSleep: (entry: Omit<SleepEntry, 'id'>) => void;
  onDeleteSleep: (entryId: string) => void;
}

// Sleep-cycle math: humans sleep in ~90-minute cycles and take about
// 15 minutes to fall asleep. Waking at a cycle boundary feels lighter
// than waking mid-cycle, which is the whole trick behind the calculator.
const CYCLE_MIN = 90;
const FALL_ASLEEP_MIN = 15;
const CYCLE_OPTIONS = [6, 5, 4, 3];

const wrap = (m: number) => ((m % 1440) + 1440) % 1440;

const fmt12 = (mins: number) => {
  const m = wrap(mins);
  const h24 = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm} ${h24 < 12 ? 'AM' : 'PM'}`;
};

const fmtDur = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const hhmm = (mins: number) => {
  const m = wrap(mins);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(
    m % 60
  ).padStart(2, '0')}`;
};

const fromHHMM = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const todayKey = () => format(new Date(), 'yyyy-MM-dd');

export default function RestPage({
  sleep,
  onAddSleep,
  onDeleteSleep,
}: RestPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const navigation = useNavigation();

  const [tab, setTab] = useState<'calc' | 'log'>('calc');

  // ---- Calculator state ----
  const [calcMode, setCalcMode] = useState<'wake' | 'now'>('wake');
  const [wakeAt, setWakeAt] = useState(7 * 60); // 7:00 AM

  // ---- Logger state ----
  const [logDate, setLogDate] = useState(todayKey());
  const [bed, setBed] = useState(23 * 60); // 11:00 PM
  const [wakeT, setWakeT] = useState(7 * 60);
  const [quality, setQuality] = useState(3);

  const logDuration = wrap(wakeT - bed);
  const existing = sleep.find((e) => e.date === logDate) ?? null;
  const logDateObj = parseISO(logDate);
  const logDateLabel = isToday(logDateObj)
    ? 'Today'
    : format(logDateObj, 'EEE, MMM d');

  const history = [...sleep].sort((a, b) => b.date.localeCompare(a.date));
  const recent = history.slice(0, 7);
  const avgDur =
    recent.length > 0
      ? recent.reduce((a, e) => a + e.durationMin, 0) / recent.length
      : 0;
  const avgQuality =
    recent.length > 0
      ? recent.reduce((a, e) => a + e.quality, 0) / recent.length
      : 0;

  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();

  const saveSleep = () => {
    if (logDuration === 0) return;
    onAddSleep({
      date: logDate,
      bedTime: hhmm(bed),
      wakeTime: hhmm(wakeT),
      durationMin: logDuration,
      quality,
    });
  };

  // Compact time adjuster: -1h / -15 / value / +15 / +1h
  const TimeField = ({
    label,
    icon,
    value,
    onChange,
  }: {
    label: string;
    icon: ReactNode;
    value: number;
    onChange: (v: number) => void;
  }) => (
    <View style={styles.timeField}>
      <View style={styles.timeFieldLeft}>
        {icon}
        <Text style={styles.timeFieldLabel}>{label}</Text>
      </View>
      <View style={styles.timeControls}>
        <Pressable
          onPress={() => onChange(wrap(value - 60))}
          style={styles.timeBtn}
          hitSlop={4}
        >
          <Text style={styles.timeBtnText}>−1h</Text>
        </Pressable>
        <Pressable
          onPress={() => onChange(wrap(value - 15))}
          style={styles.timeBtn}
          hitSlop={4}
        >
          <Text style={styles.timeBtnText}>−15</Text>
        </Pressable>
        <Text style={styles.timeValue}>{fmt12(value)}</Text>
        <Pressable
          onPress={() => onChange(wrap(value + 15))}
          style={styles.timeBtn}
          hitSlop={4}
        >
          <Text style={styles.timeBtnText}>+15</Text>
        </Pressable>
        <Pressable
          onPress={() => onChange(wrap(value + 60))}
          style={styles.timeBtn}
          hitSlop={4}
        >
          <Text style={styles.timeBtnText}>+1h</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ChevronLeft size={22} color={c.textMuted} />
        </Pressable>
        <View>
          <Text style={styles.title}>Rest</Text>
          <Text style={styles.subtitle}>Sleep calculator & log</Text>
        </View>
      </View>

      {/* Segment toggle */}
      <View style={styles.segments}>
        {(
          [
            ['calc', 'Calculator'],
            ['log', 'Sleep Log'],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={[styles.segment, tab === key && styles.segmentActive]}
          >
            <Text
              style={[
                styles.segmentText,
                tab === key && styles.segmentTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {tab === 'calc' ? (
          <>
            {/* Mode chips */}
            <View style={styles.modeRow}>
              {(
                [
                  ['wake', 'I want to wake at…'],
                  ['now', 'If I sleep now…'],
                ] as const
              ).map(([key, label]) => (
                <Pressable
                  key={key}
                  onPress={() => setCalcMode(key)}
                  style={[
                    styles.modeChip,
                    calcMode === key && styles.modeChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.modeChipText,
                      calcMode === key && styles.modeChipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {calcMode === 'wake' ? (
              <>
                <View style={styles.calcCard}>
                  <TimeField
                    label="Wake up"
                    icon={<Sun size={16} color={c.text} />}
                    value={wakeAt}
                    onChange={setWakeAt}
                  />
                </View>
                <Text style={styles.resultsHeader}>Go to bed at</Text>
                {CYCLE_OPTIONS.map((n) => {
                  const bedAt = wrap(wakeAt - n * CYCLE_MIN - FALL_ASLEEP_MIN);
                  const rec = n >= 5;
                  return (
                    <View
                      key={n}
                      style={[styles.resultRow, rec && styles.resultRowRec]}
                    >
                      <Text style={styles.resultTime}>{fmt12(bedAt)}</Text>
                      <View style={styles.resultRight}>
                        <Text style={styles.resultMeta}>
                          {n} cycles · {fmtDur(n * CYCLE_MIN)} asleep
                        </Text>
                        {rec && (
                          <View style={styles.recBadge}>
                            <Text style={styles.recBadgeText}>Best</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </>
            ) : (
              <>
                <View style={styles.calcCard}>
                  <View style={styles.nowRow}>
                    <Moon size={16} color={c.text} />
                    <Text style={styles.nowText}>
                      Heading to bed now ({fmt12(nowMins)})
                    </Text>
                  </View>
                </View>
                <Text style={styles.resultsHeader}>Set your alarm for</Text>
                {[...CYCLE_OPTIONS].reverse().map((n) => {
                  const wake = wrap(nowMins + FALL_ASLEEP_MIN + n * CYCLE_MIN);
                  const rec = n >= 5;
                  return (
                    <View
                      key={n}
                      style={[styles.resultRow, rec && styles.resultRowRec]}
                    >
                      <Text style={styles.resultTime}>{fmt12(wake)}</Text>
                      <View style={styles.resultRight}>
                        <Text style={styles.resultMeta}>
                          {n} cycles · {fmtDur(n * CYCLE_MIN)} asleep
                        </Text>
                        {rec && (
                          <View style={styles.recBadge}>
                            <Text style={styles.recBadgeText}>Best</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            <Text style={styles.footnote}>
              Based on 90-minute sleep cycles plus ~15 minutes to fall
              asleep. Waking between cycles feels lighter than waking
              mid-cycle.
            </Text>
          </>
        ) : (
          <>
            {/* Quick logger */}
            <View style={styles.logCard}>
              <View style={styles.logDateRow}>
                <Text style={styles.logCardTitle}>Log sleep</Text>
                <View style={styles.dateNav}>
                  <Pressable
                    onPress={() =>
                      setLogDate(
                        format(addDays(logDateObj, -1), 'yyyy-MM-dd')
                      )
                    }
                    hitSlop={8}
                  >
                    <ChevronLeft size={16} color={c.textMuted} />
                  </Pressable>
                  <Text style={styles.dateLabel}>{logDateLabel}</Text>
                  <Pressable
                    onPress={() =>
                      !isToday(logDateObj) &&
                      setLogDate(format(addDays(logDateObj, 1), 'yyyy-MM-dd'))
                    }
                    hitSlop={8}
                  >
                    <ChevronRight
                      size={16}
                      color={isToday(logDateObj) ? c.textFaint : c.textMuted}
                    />
                  </Pressable>
                </View>
              </View>

              <TimeField
                label="Bed"
                icon={<Moon size={16} color={c.text} />}
                value={bed}
                onChange={setBed}
              />
              <TimeField
                label="Wake"
                icon={<Sun size={16} color={c.text} />}
                value={wakeT}
                onChange={setWakeT}
              />

              <View style={styles.qualityRow}>
                <Text style={styles.qualityLabel}>Quality</Text>
                <View style={styles.qualityMoons}>
                  {[1, 2, 3, 4, 5].map((q) => (
                    <Pressable key={q} onPress={() => setQuality(q)} hitSlop={4}>
                      <Moon
                        size={20}
                        color={q <= quality ? c.blue : c.textFaint}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.saveRow}>
                <Text style={styles.durationText}>
                  {logDuration > 0 ? fmtDur(logDuration) : '—'}
                </Text>
                <Pressable
                  onPress={saveSleep}
                  style={[
                    styles.saveBtn,
                    logDuration === 0 && { opacity: 0.4 },
                  ]}
                >
                  <Text style={styles.saveBtnText}>
                    {existing ? 'Update' : 'Save'}
                  </Text>
                </Pressable>
              </View>
              {existing && (
                <Text style={styles.replaceHint}>
                  Already logged {fmtDur(existing.durationMin)} for this day —
                  saving replaces it.
                </Text>
              )}
            </View>

            {/* Weekly summary */}
            {recent.length > 0 && (
              <View style={styles.summaryCard}>
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryValue}>{fmtDur(Math.round(avgDur))}</Text>
                  <Text style={styles.summaryLabel}>
                    Avg · last {recent.length} night
                    {recent.length === 1 ? '' : 's'}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryValue}>
                    {avgQuality.toFixed(1)}/5
                  </Text>
                  <Text style={styles.summaryLabel}>Avg quality</Text>
                </View>
              </View>
            )}

            {/* History */}
            {history.length === 0 ? (
              <Text style={styles.emptyText}>
                No nights logged yet. Log last night above.
              </Text>
            ) : (
              history.map((e) => (
                <View key={e.id} style={styles.entryRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.entryDate}>
                      {format(parseISO(e.date), 'EEE, MMM d')}
                    </Text>
                    <Text style={styles.entryMeta}>
                      {fmt12(fromHHMM(e.bedTime))} →{' '}
                      {fmt12(fromHHMM(e.wakeTime))}
                    </Text>
                  </View>
                  <View style={styles.entryRight}>
                    <Text style={styles.entryDuration}>
                      {fmtDur(e.durationMin)}
                    </Text>
                    <View style={styles.entryMoons}>
                      {[1, 2, 3, 4, 5].map((q) => (
                        <Moon
                          key={q}
                          size={10}
                          color={q <= e.quality ? c.blue : c.textFaint}
                        />
                      ))}
                    </View>
                  </View>
                  <Pressable
                    onPress={() => onDeleteSleep(e.id)}
                    style={styles.entryDelete}
                    hitSlop={6}
                  >
                    <Trash size={14} color={c.textMuted} />
                  </Pressable>
                </View>
              ))
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
    segments: {
      flexDirection: 'row',
      marginHorizontal: 20,
      marginBottom: 14,
      borderRadius: 12,
      backgroundColor: c.cardAlt,
      borderWidth: 2,
      borderColor: c.text,
      padding: 3,
      gap: 3,
    },
    segment: {
      flex: 1,
      borderRadius: 9,
      paddingVertical: 8,
      alignItems: 'center',
    },
    segmentActive: {
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.text,
    },
    segmentText: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    segmentTextActive: {
      color: c.onAccent,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    modeRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    modeChip: {
      flex: 1,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.border,
      backgroundColor: c.card,
      paddingVertical: 9,
      alignItems: 'center',
    },
    modeChipActive: {
      backgroundColor: c.tintCyan,
      borderColor: c.text,
    },
    modeChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    modeChipTextActive: {
      color: c.text,
    },
    calcCard: {
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      padding: 12,
      marginBottom: 16,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    nowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 4,
    },
    nowText: {
      fontSize: 13,
      color: c.text,
      fontFamily: 'DM Sans',
    },
    resultsHeader: {
      fontSize: 10,
      letterSpacing: 0.8,
      color: c.text,
      fontWeight: '700',
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 8,
    },
    resultRowRec: {
      backgroundColor: c.tintLime,
      borderColor: c.text,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    resultTime: {
      fontSize: 20,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
    },
    resultRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    resultMeta: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
    },
    recBadge: {
      borderRadius: 8,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    recBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      color: c.onAccent,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    footnote: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      lineHeight: 16,
      marginTop: 8,
    },
    timeField: {
      marginBottom: 10,
    },
    timeFieldLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    timeFieldLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    timeControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    timeBtn: {
      borderRadius: 8,
      backgroundColor: c.cardAlt,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    timeBtnText: {
      fontSize: 11,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
    },
    timeValue: {
      flex: 1,
      textAlign: 'center',
      fontSize: 17,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
    },
    logCard: {
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      padding: 14,
      marginBottom: 14,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    logDateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    logCardTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    dateNav: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.cardAlt,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    dateLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      minWidth: 70,
      textAlign: 'center',
    },
    qualityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 2,
      marginBottom: 12,
    },
    qualityLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    qualityMoons: {
      flexDirection: 'row',
      gap: 10,
    },
    saveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    durationText: {
      fontSize: 22,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
    },
    saveBtn: {
      borderRadius: 10,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 22,
      paddingVertical: 9,
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
    replaceHint: {
      fontSize: 10,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      marginTop: 8,
    },
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      backgroundColor: c.tintCyan,
      borderWidth: 2,
      borderColor: c.text,
      paddingVertical: 14,
      marginBottom: 14,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    summaryStat: {
      flex: 1,
      alignItems: 'center',
    },
    summaryValue: {
      fontSize: 20,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
    },
    summaryLabel: {
      fontSize: 10,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      marginTop: 2,
    },
    summaryDivider: {
      width: 2,
      alignSelf: 'stretch',
      backgroundColor: c.text,
      opacity: 0.15,
    },
    emptyText: {
      textAlign: 'center',
      color: c.textMuted,
      fontSize: 13,
      fontFamily: 'DM Sans',
      marginVertical: 16,
    },
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 6,
    },
    entryDate: {
      fontSize: 13,
      fontWeight: '600',
      color: c.text,
      fontFamily: 'DM Sans',
    },
    entryMeta: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      marginTop: 2,
    },
    entryRight: {
      alignItems: 'flex-end',
      marginRight: 10,
    },
    entryDuration: {
      fontSize: 15,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
    },
    entryMoons: {
      flexDirection: 'row',
      gap: 2,
      marginTop: 3,
    },
    entryDelete: {
      padding: 4,
    },
  });

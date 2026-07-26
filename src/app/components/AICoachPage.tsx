import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { format } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Sparkles, Check } from './Icons';
import {
  buildCoachContext,
  generateSuggestions,
  testProvider,
  type CoachCache,
  type CoachProfile,
  type CoachProviderId,
  type CoachSettings,
} from '../lib/coach';
import type {
  Exercise,
  Food,
  LogEntry,
  SleepEntry,
  WorkoutSession,
} from '../lib/types';
import { ThemeColors, useThemedStyles } from '../lib/theme';

interface AICoachPageProps {
  store: {
    foods: Food[];
    log: LogEntry[];
    sessions: WorkoutSession[];
    exercises: Exercise[];
    sleep: SleepEntry[];
    water: Record<string, number>;
    waterGoalOz: number;
    coachProvider: CoachProviderId;
    setCoachProvider: (p: CoachProviderId) => void;
    coachClaudeKey: string;
    setCoachClaudeKey: (v: string) => void;
    coachClaudeModel: string;
    setCoachClaudeModel: (v: string) => void;
    coachOllamaUrl: string;
    setCoachOllamaUrl: (v: string) => void;
    coachOllamaModel: string;
    setCoachOllamaModel: (v: string) => void;
    coachCache: CoachCache | null;
    setCoachCache: (c: CoachCache | null) => void;
    coachProfile: CoachProfile;
    coachBriefing: string;
  };
}

export default function AICoachPage({ store }: AICoachPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const navigation = useNavigation();

  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(!store.coachCache);

  const settings: CoachSettings = {
    provider: store.coachProvider,
    claudeKey: store.coachClaudeKey,
    claudeModel: store.coachClaudeModel,
    ollamaUrl: store.coachOllamaUrl,
    ollamaModel: store.coachOllamaModel,
  };

  const providerReady =
    store.coachProvider === 'rules'
      ? true
      : store.coachProvider === 'claude'
        ? store.coachClaudeKey.trim().length > 0
        : store.coachOllamaUrl.trim().length > 0;

  const onGenerate = async () => {
    if (loading || !providerReady) return;
    setLoading(true);
    setError(null);
    try {
      const ctx = buildCoachContext({
        foods: store.foods,
        log: store.log,
        sessions: store.sessions,
        exercises: store.exercises,
        sleep: store.sleep,
        water: store.water,
        waterGoalOz: store.waterGoalOz,
        profile: store.coachProfile,
      });
      const suggestions = await generateSuggestions(
        settings,
        ctx,
        store.coachBriefing
      );
      store.setCoachCache({
        suggestions,
        provider:
          store.coachProvider === 'rules'
            ? 'Rules engine'
            : store.coachProvider === 'claude'
              ? `Claude (${store.coachClaudeModel.trim()})`
              : `Ollama (${store.coachOllamaModel.trim()})`,
        generatedAt: Date.now(),
      });
      setShowSettings(false);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const onTest = async () => {
    if (testing) return;
    setTesting(true);
    setTestMsg(null);
    setError(null);
    try {
      setTestMsg(await testProvider(settings));
    } catch (e: any) {
      setTestMsg(`✗ ${e?.message ?? 'Connection failed'}`);
    } finally {
      setTesting(false);
    }
  };

  const cache = store.coachCache;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ChevronLeft size={22} color={c.textMuted} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>AI Coach</Text>
          <Text style={styles.subtitle}>
            Suggestions from your real workouts, meals, sleep & water
          </Text>
        </View>
        <Pressable
          onPress={() => setShowSettings((s) => !s)}
          style={[styles.gearBtn, showSettings && styles.gearBtnActive]}
          hitSlop={6}
        >
          <Text
            style={[
              styles.gearBtnText,
              showSettings && styles.gearBtnTextActive,
            ]}
          >
            {showSettings ? 'Done' : 'Setup'}
          </Text>
        </Pressable>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {showSettings && (
          <View style={styles.settingsCard}>
            <Text style={styles.settingsTitle}>Provider</Text>
            <View style={styles.providerRow}>
              {(
                [
                  ['claude', 'Claude'],
                  ['ollama', 'Ollama'],
                  ['rules', 'Rules'],
                ] as const
              ).map(([id, label]) => (
                <Pressable
                  key={id}
                  onPress={() => {
                    store.setCoachProvider(id);
                    setTestMsg(null);
                  }}
                  style={[
                    styles.providerChip,
                    store.coachProvider === id && styles.providerChipActive,
                  ]}
                >
                  {store.coachProvider === id && (
                    <Check size={12} color={c.onAccent} />
                  )}
                  <Text
                    style={[
                      styles.providerChipText,
                      store.coachProvider === id &&
                        styles.providerChipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {store.coachProvider === 'rules' ? (
              <Text style={styles.fieldHint}>
                Deterministic analysis that runs entirely on your phone — free,
                instant, offline. Tune it via your Coach Profile in the Profile
                tab (goal, diet style, body weight, weekly target).
              </Text>
            ) : store.coachProvider === 'claude' ? (
              <>
                <Text style={styles.fieldLabel}>Anthropic API key</Text>
                <TextInput
                  value={store.coachClaudeKey}
                  onChangeText={store.setCoachClaudeKey}
                  placeholder="sk-ant-…"
                  placeholderTextColor={c.textFaint}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.fieldInput}
                />
                <Text style={styles.fieldLabel}>Model</Text>
                <TextInput
                  value={store.coachClaudeModel}
                  onChangeText={store.setCoachClaudeModel}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.fieldInput}
                />
                <Text style={styles.fieldHint}>
                  Your key is stored on this device only and sent directly to
                  Anthropic.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>Server URL</Text>
                <TextInput
                  value={store.coachOllamaUrl}
                  onChangeText={store.setCoachOllamaUrl}
                  placeholder="http://192.168.1.50:11434"
                  placeholderTextColor={c.textFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  style={styles.fieldInput}
                />
                <Text style={styles.fieldLabel}>Model</Text>
                <TextInput
                  value={store.coachOllamaModel}
                  onChangeText={store.setCoachOllamaModel}
                  placeholder="llama3.1"
                  placeholderTextColor={c.textFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.fieldInput}
                />
                <Text style={styles.fieldHint}>
                  Use your PC's local IP on the same Wi-Fi (not localhost —
                  that's the phone itself). Works with anything
                  OpenAI-compatible: Ollama, LM Studio, etc.
                </Text>
              </>
            )}

            <Pressable
              onPress={onTest}
              style={[styles.testBtn, testing && { opacity: 0.5 }]}
            >
              {testing ? (
                <ActivityIndicator size="small" color={c.text} />
              ) : (
                <Text style={styles.testBtnText}>Test connection</Text>
              )}
            </Pressable>
            {testMsg && (
              <Text
                style={[
                  styles.testMsg,
                  testMsg.startsWith('✗') && { color: c.danger },
                ]}
              >
                {testMsg}
              </Text>
            )}
          </View>
        )}

        {/* Briefing — read before every suggestion batch and chat reply */}
        <Pressable
          onPress={() => (navigation as any).navigate('CoachBriefing')}
          style={styles.briefingRow}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.briefingTitle}>Coach Briefing</Text>
            <Text style={styles.briefingSub}>
              {store.coachBriefing.trim()
                ? `${store.coachBriefing.trim().length} chars · read before every reply`
                : 'Teach your coach your philosophy & standing instructions'}
            </Text>
          </View>
          <ChevronRight size={18} color={c.textFaint} />
        </Pressable>

        {/* Generate / refresh */}
        <Pressable
          onPress={onGenerate}
          style={[
            styles.generateBtn,
            (!providerReady || loading) && { opacity: 0.45 },
          ]}
        >
          {loading ? (
            <>
              <ActivityIndicator size="small" color={c.onAccent} />
              <Text style={styles.generateBtnText}>Thinking…</Text>
            </>
          ) : (
            <>
              <Sparkles size={16} color={c.onAccent} />
              <Text style={styles.generateBtnText}>
                {cache ? 'Refresh suggestions' : 'Generate suggestions'}
              </Text>
            </>
          )}
        </Pressable>
        {!providerReady && (
          <Text style={styles.notReadyText}>
            {store.coachProvider === 'claude'
              ? 'Add your Anthropic API key in Setup first.'
              : 'Set your Ollama server URL in Setup first.'}
          </Text>
        )}
        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Suggestions */}
        {cache && (
          <>
            <Text style={styles.metaLine}>
              {cache.provider} · {format(cache.generatedAt, 'MMM d, h:mm a')}
            </Text>
            {cache.suggestions.map((s, i) => (
              <View
                key={`${s.title}${i}`}
                style={[styles.card, { backgroundColor: c[s.tint] }]}
              >
                <View style={styles.cardHeader}>
                  <Sparkles size={16} color={c.text} />
                  <Text style={styles.cardTag}>{s.tag}</Text>
                </View>
                <Text style={styles.cardTitle}>{s.title}</Text>
                <Text style={styles.cardBody}>{s.body}</Text>
              </View>
            ))}
          </>
        )}

        {!cache && !loading && (
          <View style={styles.emptyBox}>
            <Sparkles size={20} color={c.textMuted} />
            <Text style={styles.emptyText}>
              No suggestions yet. Pick a provider in Setup, then hit Generate —
              the coach reads your last two weeks of data.
            </Text>
          </View>
        )}

        {/* Chat with the coach */}
        <Pressable
          onPress={() => (navigation as any).navigate('CoachChat')}
          style={styles.askBox}
        >
          <Text style={styles.askPlaceholder}>Ask your coach anything…</Text>
          <View style={[styles.askBadge, { backgroundColor: c.accent }]}>
            <Text style={[styles.askBadgeText, { color: c.onAccent }]}>
              Chat
            </Text>
          </View>
        </Pressable>

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
    gearBtn: {
      borderRadius: 10,
      backgroundColor: c.cardAlt,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    gearBtnActive: {
      backgroundColor: c.accent,
    },
    gearBtnText: {
      fontSize: 12,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    gearBtnTextActive: {
      color: c.onAccent,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    settingsCard: {
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
    settingsTitle: {
      fontSize: 10,
      letterSpacing: 0.8,
      color: c.text,
      fontWeight: '700',
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    providerRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    providerChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.border,
      backgroundColor: c.cardAlt,
      paddingVertical: 9,
    },
    providerChipActive: {
      backgroundColor: c.accent,
      borderColor: c.text,
    },
    providerChipText: {
      fontSize: 13,
      fontWeight: '800',
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    providerChipTextActive: {
      color: c.onAccent,
    },
    fieldLabel: {
      fontSize: 9,
      letterSpacing: 0.6,
      color: c.textMuted,
      fontWeight: '600',
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    fieldInput: {
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 13,
      color: c.text,
      fontFamily: 'DM Sans',
      marginBottom: 10,
    },
    fieldHint: {
      fontSize: 10,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      lineHeight: 14,
      marginBottom: 10,
    },
    testBtn: {
      alignSelf: 'flex-start',
      borderRadius: 10,
      backgroundColor: c.cardAlt,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 14,
      paddingVertical: 7,
      minHeight: 32,
      justifyContent: 'center',
    },
    testBtnText: {
      fontSize: 11,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    testMsg: {
      fontSize: 11,
      color: c.accentDeep,
      fontFamily: 'DM Sans',
      marginTop: 8,
    },
    generateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 12,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.text,
      paddingVertical: 13,
      marginBottom: 10,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    generateBtnText: {
      fontSize: 14,
      fontWeight: '800',
      color: c.onAccent,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    notReadyText: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      textAlign: 'center',
      marginBottom: 10,
    },
    errorText: {
      fontSize: 11,
      color: c.danger,
      fontFamily: 'DM Sans',
      marginBottom: 10,
      lineHeight: 15,
    },
    briefingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 14,
      paddingVertical: 11,
      marginBottom: 10,
    },
    briefingTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    briefingSub: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      marginTop: 2,
    },
    metaLine: {
      fontSize: 10,
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    card: {
      borderRadius: 12,
      borderWidth: 2,
      borderColor: c.text,
      padding: 16,
      marginBottom: 10,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    cardTag: {
      fontSize: 10,
      letterSpacing: 0.8,
      color: c.textSoft,
      fontWeight: '700',
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'DM Sans',
      marginBottom: 4,
    },
    cardBody: {
      fontSize: 12,
      color: c.textSoft,
      fontFamily: 'DM Sans',
      lineHeight: 17,
    },
    emptyBox: {
      alignItems: 'center',
      gap: 10,
      borderRadius: 12,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: c.text,
      paddingHorizontal: 20,
      paddingVertical: 24,
      marginBottom: 10,
    },
    emptyText: {
      fontSize: 12,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      textAlign: 'center',
      lineHeight: 17,
    },
    askBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginTop: 6,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    askPlaceholder: {
      flex: 1,
      fontSize: 13,
      color: c.textFaint,
      fontFamily: 'DM Sans',
    },
    askBadge: {
      borderRadius: 10,
      backgroundColor: c.border,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    askBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: c.textSoft,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
  });

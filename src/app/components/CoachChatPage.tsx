import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Trash, Check, X, Sparkles } from './Icons';
import {
  buildCoachContext,
  chatWithCoach,
  proposeBriefingUpdate,
  type CoachCache,
  type CoachChatMessage,
  type CoachProfile,
  type CoachProviderId,
  type CoachSettings,
} from '../lib/coach';
import type {
  Exercise,
  Food,
  LogEntry,
  SleepEntry,
  WorkoutPlan,
  WorkoutSession,
} from '../lib/types';
import { ThemeColors, useThemedStyles } from '../lib/theme';

interface CoachChatPageProps {
  store: {
    foods: Food[];
    log: LogEntry[];
    sessions: WorkoutSession[];
    exercises: Exercise[];
    sleep: SleepEntry[];
    water: Record<string, number>;
    waterGoalOz: number;
    plans: WorkoutPlan[];
    pantryIds: string[];
    steps: Record<string, number>;
    coachProvider: CoachProviderId;
    coachClaudeKey: string;
    coachClaudeModel: string;
    coachOllamaUrl: string;
    coachOllamaModel: string;
    coachProfile: CoachProfile;
    coachBriefing: string;
    setCoachBriefing: (t: string) => void;
    coachChat: CoachChatMessage[];
    setCoachChat: (m: CoachChatMessage[]) => void;
    coachCache: CoachCache | null;
  };
}

export default function CoachChatPage({ store }: CoachChatPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const navigation = useNavigation();
  const scrollRef = useRef<ScrollView>(null);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Briefing proposal flow: null = chatting; string = reviewing a draft.
  const [proposal, setProposal] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);

  const settings: CoachSettings = {
    provider: store.coachProvider,
    claudeKey: store.coachClaudeKey,
    claudeModel: store.coachClaudeModel,
    ollamaUrl: store.coachOllamaUrl,
    ollamaModel: store.coachOllamaModel,
  };

  const isLLM = store.coachProvider !== 'rules';
  const providerLabel =
    store.coachProvider === 'claude'
      ? 'Claude'
      : store.coachProvider === 'ollama'
        ? 'Ollama'
        : 'Rules engine';

  const messages = store.coachChat;

  useEffect(() => {
    const t = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      80
    );
    return () => clearTimeout(t);
  }, [messages.length, sending]);

  const buildCtx = () =>
    buildCoachContext({
      foods: store.foods,
      log: store.log,
      sessions: store.sessions,
      exercises: store.exercises,
      sleep: store.sleep,
      water: store.water,
      waterGoalOz: store.waterGoalOz,
      profile: store.coachProfile,
      plans: store.plans,
      pantryIds: store.pantryIds,
      steps: store.steps,
    });

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !isLLM) return;
    setError(null);
    const userMsg: CoachChatMessage = {
      id: `m${Date.now()}`,
      role: 'user',
      content: text,
      ts: Date.now(),
    };
    const next = [...messages, userMsg];
    store.setCoachChat(next);
    setInput('');
    setSending(true);
    try {
      const reply = await chatWithCoach(
        settings,
        buildCtx(),
        store.coachBriefing,
        next
      );
      store.setCoachChat([
        ...next,
        {
          id: `m${Date.now()}a`,
          role: 'assistant',
          content: reply,
          ts: Date.now(),
        },
      ]);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong');
    } finally {
      setSending(false);
    }
  };

  const saveTakeaways = async () => {
    if (proposing || messages.length < 2 || !isLLM) return;
    setProposing(true);
    setError(null);
    try {
      setProposal(
        await proposeBriefingUpdate(settings, store.coachBriefing, messages)
      );
    } catch (e: any) {
      setError(e?.message ?? 'Could not draft an update');
    } finally {
      setProposing(false);
    }
  };

  const clearChat = () =>
    Alert.alert('Clear conversation?', 'The thread will be deleted.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => store.setCoachChat([]),
      },
    ]);

  // ---------- Briefing proposal review ----------
  if (proposal !== null) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => setProposal(null)}
            style={styles.headerBtn}
            hitSlop={6}
          >
            <X size={20} color={c.textMuted} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Proposed Briefing</Text>
            <Text style={styles.subtitle}>
              Edit freely — nothing saves until you approve
            </Text>
          </View>
          <Text style={styles.counter}>{proposal.length} / 2000</Text>
        </View>
        <ScrollView
          style={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TextInput
            value={proposal}
            onChangeText={(t) => setProposal(t.slice(0, 4000))}
            multiline
            textAlignVertical="top"
            style={styles.proposalEditor}
          />
          <View style={styles.proposalActions}>
            <Pressable
              onPress={() => setProposal(null)}
              style={styles.discardBtn}
            >
              <Text style={styles.discardBtnText}>Discard</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                store.setCoachBriefing(proposal.trim());
                setProposal(null);
              }}
              style={styles.approveBtn}
            >
              <Check size={14} color={c.onAccent} />
              <Text style={styles.approveBtnText}>Approve & save</Text>
            </Pressable>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ---------- Chat ----------
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ChevronLeft size={22} color={c.textMuted} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Coach Chat</Text>
          <Text style={styles.subtitle}>{providerLabel}</Text>
        </View>
        {messages.length >= 2 && isLLM && (
          <Pressable
            onPress={saveTakeaways}
            style={[styles.takeawaysBtn, proposing && { opacity: 0.5 }]}
            hitSlop={4}
          >
            {proposing ? (
              <ActivityIndicator size="small" color={c.text} />
            ) : (
              <Text style={styles.takeawaysBtnText}>Save takeaways</Text>
            )}
          </Pressable>
        )}
        {messages.length > 0 && (
          <Pressable onPress={clearChat} style={styles.headerBtn} hitSlop={6}>
            <Trash size={18} color={c.textMuted} />
          </Pressable>
        )}
      </View>

      {!isLLM && (
        <View style={styles.rulesBanner}>
          <Text style={styles.rulesBannerText}>
            Chat needs an LLM — switch to Claude or Ollama in AI Coach → Setup.
            The rules engine only generates suggestion cards.
          </Text>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 && isLLM && (
          <View style={styles.emptyBox}>
            <Sparkles size={20} color={c.textMuted} />
            <Text style={styles.emptyText}>
              Talk through your approach — the coach knows your briefing and
              your last two weeks of data. Agree on something worth keeping?
              Hit "Save takeaways" to fold it into your briefing.
            </Text>
          </View>
        )}

        {messages.map((m) => (
          <View
            key={m.id}
            style={[
              styles.bubble,
              m.role === 'user' ? styles.userBubble : styles.coachBubble,
            ]}
          >
            <Text
              style={
                m.role === 'user' ? styles.userBubbleText : styles.coachBubbleText
              }
            >
              {m.content}
            </Text>
          </View>
        ))}

        {sending && (
          <View style={[styles.bubble, styles.coachBubble, styles.typingRow]}>
            <ActivityIndicator size="small" color={c.textMuted} />
            <Text style={styles.typingText}>Thinking…</Text>
          </View>
        )}
        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={{ height: 16 }} />
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={isLLM ? 'Message your coach…' : 'Chat unavailable'}
          placeholderTextColor={c.textFaint}
          editable={isLLM && !sending}
          multiline
          style={styles.input}
        />
        <Pressable
          onPress={send}
          style={[
            styles.sendBtn,
            (!input.trim() || sending || !isLLM) && { opacity: 0.4 },
          ]}
          hitSlop={4}
        >
          <Text style={styles.sendBtnText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
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
      gap: 10,
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
    counter: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
    },
    takeawaysBtn: {
      borderRadius: 10,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 10,
      paddingVertical: 6,
      minHeight: 30,
      justifyContent: 'center',
    },
    takeawaysBtnText: {
      fontSize: 11,
      fontWeight: '800',
      color: c.onAccent,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    rulesBanner: {
      marginHorizontal: 20,
      marginBottom: 10,
      borderRadius: 12,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: c.text,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    rulesBannerText: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      lineHeight: 16,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
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
      marginTop: 8,
    },
    emptyText: {
      fontSize: 12,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      textAlign: 'center',
      lineHeight: 17,
    },
    bubble: {
      maxWidth: '86%',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 8,
    },
    userBubble: {
      alignSelf: 'flex-end',
      backgroundColor: c.primary,
    },
    coachBubble: {
      alignSelf: 'flex-start',
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      shadowColor: c.shadow,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 2,
    },
    userBubbleText: {
      fontSize: 13,
      color: c.onPrimary,
      fontFamily: 'DM Sans',
      lineHeight: 19,
    },
    coachBubbleText: {
      fontSize: 13,
      color: c.text,
      fontFamily: 'DM Sans',
      lineHeight: 19,
    },
    typingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    typingText: {
      fontSize: 12,
      color: c.textMuted,
      fontFamily: 'DM Sans',
    },
    errorText: {
      fontSize: 11,
      color: c.danger,
      fontFamily: 'DM Sans',
      marginTop: 4,
      lineHeight: 15,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
      borderTopWidth: 2,
      borderTopColor: c.divider,
      backgroundColor: c.surface,
    },
    input: {
      flex: 1,
      maxHeight: 110,
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 13,
      color: c.text,
      fontFamily: 'DM Sans',
    },
    sendBtn: {
      borderRadius: 12,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 16,
      paddingVertical: 11,
      shadowColor: c.shadow,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    sendBtnText: {
      fontSize: 13,
      fontWeight: '800',
      color: c.onAccent,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    proposalEditor: {
      minHeight: 280,
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      padding: 14,
      fontSize: 13,
      color: c.text,
      fontFamily: 'DM Sans',
      lineHeight: 19,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    proposalActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
    },
    discardBtn: {
      flex: 1,
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 2,
      borderColor: c.danger,
      paddingVertical: 11,
    },
    discardBtnText: {
      fontSize: 13,
      fontWeight: '800',
      color: c.danger,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    approveBtn: {
      flex: 1.4,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 12,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.text,
      paddingVertical: 11,
      shadowColor: c.shadow,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    approveBtnText: {
      fontSize: 13,
      fontWeight: '800',
      color: c.onAccent,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
  });

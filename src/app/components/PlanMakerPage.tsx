import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Check, Plus, Save, Timer, Trash, X } from './Icons';
import ExercisePicker from './ExercisePicker';
import NumericInput from './components2/NumericInput';
import { MAX_PLAN_DAYS } from '../lib/constants';
import type { Exercise, PlanDay, WorkoutPlan } from '../lib/types';
import { ThemeColors, useThemedStyles } from '../lib/theme';

// What the editor works on before the user explicitly saves.
interface PlanDraft {
  name: string;
  days: PlanDay[];
}

interface PlanMakerPageProps {
  plans: WorkoutPlan[];
  exercises: Exercise[];
  // Profile-wide rest default — seeds the per-exercise rest editor.
  restSeconds: number;
  onSavePlan: (draft: PlanDraft) => WorkoutPlan;
  onUpdatePlan: (planId: string, patch: Partial<WorkoutPlan>) => void;
  onDeletePlan: (planId: string) => void;
}

const fmtRest = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const newDay = (n: number): PlanDay => ({
  id: `d${Date.now()}_${n}`,
  name: `Day ${n}`,
  exercises: [],
});

export default function PlanMakerPage({
  plans,
  exercises,
  restSeconds,
  onSavePlan,
  onUpdatePlan,
  onDeletePlan,
}: PlanMakerPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const navigation = useNavigation();

  // Draft being edited (nothing persists until Save is pressed).
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  // Set when editing an existing plan; null while creating a new one.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newPlanName, setNewPlanName] = useState('');
  // Which day's exercise picker is open.
  const [pickerDayId, setPickerDayId] = useState<string | null>(null);
  // Which exercise's rest editor is expanded ("dayId:exerciseId").
  const [restEditorKey, setRestEditorKey] = useState<string | null>(null);

  const exerciseById = new Map(exercises.map((e) => [e.id, e]));

  const startNewDraft = () => {
    const name = newPlanName.trim();
    if (!name) return;
    setDraft({ name, days: [newDay(1)] });
    setEditingId(null);
    setNewPlanName('');
  };

  const startEditDraft = (plan: WorkoutPlan) => {
    // Deep copy so edits never touch the stored plan until Save.
    setDraft({
      name: plan.name,
      days: (plan.days ?? []).map((d) => ({
        ...d,
        exercises: d.exercises.map((pe) => ({ ...pe })),
      })),
    });
    setEditingId(plan.id);
  };

  const closeDraft = () => {
    setDraft(null);
    setEditingId(null);
    setPickerDayId(null);
    setRestEditorKey(null);
  };

  const patchDay = (dayId: string, patch: Partial<PlanDay>) => {
    setDraft((d) =>
      d
        ? {
            ...d,
            days: d.days.map((day) =>
              day.id === dayId ? { ...day, ...patch } : day
            ),
          }
        : d
    );
  };

  const addDay = () => {
    setDraft((d) =>
      d && d.days.length < MAX_PLAN_DAYS
        ? { ...d, days: [...d.days, newDay(d.days.length + 1)] }
        : d
    );
  };

  const removeDay = (dayId: string) => {
    setDraft((d) =>
      d && d.days.length > 1
        ? { ...d, days: d.days.filter((day) => day.id !== dayId) }
        : d
    );
  };

  const addExerciseToDay = (dayId: string, exercise: Exercise) => {
    const day = draft?.days.find((d) => d.id === dayId);
    if (!day) return;
    if (!day.exercises.some((pe) => pe.exerciseId === exercise.id)) {
      patchDay(dayId, {
        exercises: [
          ...day.exercises,
          {
            exerciseId: exercise.id,
            targetSets: 3,
            targetReps: exercise.kind === 'cardio' ? '20' : '8-12',
          },
        ],
      });
    }
    setPickerDayId(null);
  };

  const removeExerciseFromDay = (dayId: string, exerciseId: string) => {
    const day = draft?.days.find((d) => d.id === dayId);
    if (!day) return;
    patchDay(dayId, {
      exercises: day.exercises.filter((pe) => pe.exerciseId !== exerciseId),
    });
  };

  const updateTarget = (
    dayId: string,
    exerciseId: string,
    patch: {
      targetSets?: number;
      targetReps?: string;
      restSeconds?: number | undefined;
    }
  ) => {
    const day = draft?.days.find((d) => d.id === dayId);
    if (!day) return;
    patchDay(dayId, {
      exercises: day.exercises.map((pe) =>
        pe.exerciseId === exerciseId ? { ...pe, ...patch } : pe
      ),
    });
  };

  const canSave = !!draft && draft.name.trim().length > 0;

  const saveDraft = () => {
    if (!draft || !canSave) return;
    const clean = { ...draft, name: draft.name.trim() };
    if (editingId) {
      onUpdatePlan(editingId, { name: clean.name, days: clean.days });
    } else {
      onSavePlan(clean);
    }
    closeDraft();
  };

  // ---------- Draft editor ----------
  if (draft) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={closeDraft} style={styles.headerBtn}>
            <ChevronLeft size={22} color={c.textMuted} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {editingId ? 'Edit Plan' : 'New Plan'}
            </Text>
            <Text style={styles.subtitle}>
              {draft.days.length}/{MAX_PLAN_DAYS} days · unsaved
            </Text>
          </View>
          {/* Add another day — top right */}
          <Pressable
            onPress={addDay}
            style={[
              styles.addDayBtn,
              draft.days.length >= MAX_PLAN_DAYS && { opacity: 0.35 },
            ]}
            hitSlop={6}
          >
            <Plus size={16} color={c.text} />
            <Text style={styles.addDayText}>Day</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.fieldLabel}>Plan name</Text>
          <TextInput
            value={draft.name}
            onChangeText={(name) => setDraft((d) => (d ? { ...d, name } : d))}
            placeholder="e.g. Push / Pull / Legs"
            placeholderTextColor={c.textMuted}
            style={styles.nameInput}
          />

          {draft.days.map((day, di) => (
            <View key={day.id} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayIndex}>{di + 1}</Text>
                <TextInput
                  value={day.name}
                  onChangeText={(name) => patchDay(day.id, { name })}
                  placeholder={`Day ${di + 1} name`}
                  placeholderTextColor={c.textMuted}
                  style={styles.dayNameInput}
                />
                {draft.days.length > 1 && (
                  <Pressable
                    onPress={() => removeDay(day.id)}
                    style={styles.removeBtn}
                    hitSlop={6}
                  >
                    <Trash size={14} color={c.textMuted} />
                  </Pressable>
                )}
              </View>

              {day.exercises.length === 0 && (
                <Text style={styles.emptyDayText}>
                  No exercises in this day yet.
                </Text>
              )}
              {day.exercises.map((pe) => {
                const ex = exerciseById.get(pe.exerciseId);
                if (!ex) return null;
                const isCardio = ex.kind === 'cardio';
                return (
                  <View key={pe.exerciseId} style={styles.exerciseCard}>
                    <View style={styles.exerciseCardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.exerciseName}>{ex.name}</Text>
                        <Text style={styles.exerciseMeta}>
                          <Text style={styles.exerciseMetaPrimary}>
                            {ex.muscles[0]}
                          </Text>
                          {ex.muscles.length > 1
                            ? ' · ' + ex.muscles.slice(1).join(' · ')
                            : ''}{' '}
                          · {ex.equipment}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() =>
                          removeExerciseFromDay(day.id, pe.exerciseId)
                        }
                        style={styles.removeBtn}
                        hitSlop={6}
                      >
                        <X size={12} color={c.textMuted} />
                      </Pressable>
                    </View>
                    <View style={styles.targetsRow}>
                      {!isCardio && (
                        <View style={styles.targetField}>
                          <Text style={styles.targetLabel}>Sets</Text>
                          <NumericInput
                            value={String(pe.targetSets)}
                            onChangeText={(v) =>
                              updateTarget(day.id, pe.exerciseId, {
                                targetSets: parseInt(v, 10) || 0,
                              })
                            }
                            style={styles.targetInput}
                          />
                        </View>
                      )}
                      <View style={[styles.targetField, { flex: 1 }]}>
                        <Text style={styles.targetLabel}>
                          {isCardio ? 'Minutes' : 'Reps'}
                        </Text>
                        <TextInput
                          value={pe.targetReps}
                          onChangeText={(v) =>
                            updateTarget(day.id, pe.exerciseId, {
                              targetReps: v,
                            })
                          }
                          placeholder={isCardio ? '20' : '8-12'}
                          placeholderTextColor={c.textMuted}
                          style={styles.targetInput}
                        />
                      </View>
                    </View>

                    {!isCardio &&
                      (restEditorKey === `${day.id}:${pe.exerciseId}` ? (
                        <View style={styles.restEditor}>
                          <Timer size={13} color={c.text} />
                          <Pressable
                            onPress={() =>
                              updateTarget(day.id, pe.exerciseId, {
                                restSeconds: Math.max(
                                  15,
                                  (pe.restSeconds ?? restSeconds) - 15
                                ),
                              })
                            }
                            style={styles.restStepBtn}
                            hitSlop={4}
                          >
                            <Text style={styles.restStepText}>−15</Text>
                          </Pressable>
                          <Text style={styles.restValue}>
                            {fmtRest(pe.restSeconds ?? restSeconds)}
                          </Text>
                          <Pressable
                            onPress={() =>
                              updateTarget(day.id, pe.exerciseId, {
                                restSeconds: Math.min(
                                  600,
                                  (pe.restSeconds ?? restSeconds) + 15
                                ),
                              })
                            }
                            style={styles.restStepBtn}
                            hitSlop={4}
                          >
                            <Text style={styles.restStepText}>+15</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              updateTarget(day.id, pe.exerciseId, {
                                restSeconds: undefined,
                              });
                              setRestEditorKey(null);
                            }}
                            style={styles.restResetBtn}
                            hitSlop={4}
                          >
                            <Text style={styles.restResetText}>Default</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => setRestEditorKey(null)}
                            style={styles.restDoneBtn}
                            hitSlop={4}
                          >
                            <Check size={13} color={c.onAccent} />
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable
                          onPress={() =>
                            setRestEditorKey(`${day.id}:${pe.exerciseId}`)
                          }
                          style={styles.restChip}
                          hitSlop={6}
                        >
                          <Timer
                            size={12}
                            color={pe.restSeconds != null ? c.text : c.textFaint}
                          />
                          <Text
                            style={[
                              styles.restChipText,
                              pe.restSeconds != null && styles.restChipTextSet,
                            ]}
                          >
                            {pe.restSeconds != null
                              ? `Rest ${fmtRest(pe.restSeconds)}`
                              : 'Rest · default'}
                          </Text>
                        </Pressable>
                      ))}
                  </View>
                );
              })}

              {pickerDayId === day.id ? (
                <ExercisePicker
                  exercises={exercises}
                  onSelect={(ex) => addExerciseToDay(day.id, ex)}
                  onClose={() => setPickerDayId(null)}
                />
              ) : (
                <Pressable
                  onPress={() => setPickerDayId(day.id)}
                  style={styles.addBtn}
                >
                  <Plus size={16} color={c.textMuted} />
                  <Text style={styles.addBtnText}>Add exercise</Text>
                </Pressable>
              )}
            </View>
          ))}

          <View style={{ height: 110 }} />
        </ScrollView>

        {/* Save — circular FAB bottom right; the ONLY way a plan persists */}
        <Pressable
          onPress={saveDraft}
          style={({ pressed }) => [
            styles.saveFab,
            !canSave && { opacity: 0.35 },
            pressed && canSave && { opacity: 0.7 },
          ]}
        >
          <Save size={24} color={c.onAccent} />
        </Pressable>
      </View>
    );
  }

  // ---------- List view ----------
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ChevronLeft size={22} color={c.textMuted} />
        </Pressable>
        <Text style={styles.title}>Plan Maker</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* New plan input */}
        <View style={styles.newPlanRow}>
          <TextInput
            placeholder="New plan name (e.g. PPL Split)"
            value={newPlanName}
            onChangeText={setNewPlanName}
            onSubmitEditing={startNewDraft}
            placeholderTextColor={c.textMuted}
            style={styles.newPlanInput}
          />
          <Pressable
            onPress={startNewDraft}
            style={[styles.createBtn, !newPlanName.trim() && { opacity: 0.4 }]}
          >
            <Plus size={16} color={c.onAccent} />
          </Pressable>
        </View>

        {plans.length === 0 && (
          <Text style={styles.emptyText}>
            No plans yet. Name one above to get started.
          </Text>
        )}

        {plans.map((plan) => {
          // Legacy plans (pre multi-day) may lack `days`.
          const days = plan.days ?? [];
          const exerciseCount = days.reduce(
            (a, d) => a + (d.exercises ?? []).length,
            0
          );
          return (
            <Pressable
              key={plan.id}
              onPress={() => startEditDraft(plan)}
              style={styles.planCard}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planMeta}>
                  {days.length} day{days.length === 1 ? '' : 's'} ·{' '}
                  {exerciseCount} exercise{exerciseCount === 1 ? '' : 's'} ·{' '}
                  {days
                    .slice(0, 3)
                    .map((d) => d.name)
                    .join(', ')}
                  {days.length > 3 ? '…' : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => onDeletePlan(plan.id)}
                style={styles.deleteBtn}
                hitSlop={6}
              >
                <Trash size={16} color={c.textMuted} />
              </Pressable>
              <ChevronRight size={18} color={c.textFaint} />
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
    addDayBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 10,
      backgroundColor: c.cardAlt,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    addDayText: {
      fontSize: 12,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    newPlanRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
    },
    newPlanInput: {
      flex: 1,
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: c.text,
      fontFamily: 'DM Sans',
    },
    createBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.text,
      shadowColor: c.shadow,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
      alignItems: 'center',
      justifyContent: 'center',
    },
    planCard: {
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
    planName: {
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
      fontFamily: 'DM Sans',
    },
    planMeta: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      marginTop: 3,
    },
    deleteBtn: {
      padding: 4,
    },
    emptyText: {
      textAlign: 'center',
      color: c.textMuted,
      fontSize: 13,
      fontFamily: 'DM Sans',
      marginVertical: 16,
    },
    fieldLabel: {
      fontSize: 10,
      letterSpacing: 0.8,
      color: c.text,
      fontWeight: '700',
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    nameInput: {
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
      fontFamily: 'DM Sans',
      marginBottom: 16,
    },
    dayCard: {
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      padding: 12,
      marginBottom: 12,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    dayHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    dayIndex: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.text,
      textAlign: 'center',
      lineHeight: 22,
      fontSize: 13,
      fontWeight: '800',
      color: c.onAccent,
      fontFamily: 'Barlow Condensed',
      overflow: 'hidden',
    },
    dayNameInput: {
      flex: 1,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 12,
      paddingVertical: 7,
      fontSize: 14,
      fontWeight: '600',
      color: c.text,
      fontFamily: 'DM Sans',
    },
    emptyDayText: {
      fontSize: 12,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      marginBottom: 8,
    },
    exerciseCard: {
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.text,
      padding: 12,
      marginBottom: 8,
    },
    exerciseCardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
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
    targetsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 10,
    },
    targetField: {
      width: 90,
    },
    targetLabel: {
      fontSize: 9,
      letterSpacing: 0.6,
      color: c.textMuted,
      fontWeight: '600',
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      marginBottom: 3,
    },
    targetInput: {
      borderRadius: 10,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 10,
      paddingVertical: 7,
      fontSize: 13,
      color: c.text,
      fontFamily: 'DM Sans',
    },
    // Quiet by default — faint chip that expands into a stepper.
    restChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      marginTop: 10,
      paddingVertical: 2,
    },
    restChipText: {
      fontSize: 10,
      fontWeight: '700',
      color: c.textFaint,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    restChipTextSet: {
      color: c.text,
    },
    restEditor: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10,
    },
    restStepBtn: {
      borderRadius: 8,
      backgroundColor: c.cardAlt,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    restStepText: {
      fontSize: 11,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
    },
    restValue: {
      minWidth: 42,
      textAlign: 'center',
      fontSize: 13,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'DM Sans',
    },
    restResetBtn: {
      borderRadius: 8,
      borderWidth: 2,
      borderColor: c.border,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    restResetText: {
      fontSize: 10,
      fontWeight: '700',
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    restDoneBtn: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
  
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 10,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: c.text,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginTop: 2,
    },
    addBtnText: {
      fontSize: 13,
      color: c.textMuted,
      fontFamily: 'DM Sans',
    },
    saveFab: {
      position: 'absolute',
      bottom: 24,
      right: 20,
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.text,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 5,
    },
  });

import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Dumbbell, Utensils, User } from './src/app/components/Icons';

import { usePersistedState, STORAGE_KEYS } from './src/app/lib/storage';
import { DEFAULT_PLANNER_SETTINGS } from './src/app/lib/mealPlanner';
import { LEGACY_DAIRY_EGGS, splitDairyEggs } from './src/app/lib/constants';
import { SEED_FOODS, SEED_PANTRY_IDS } from './src/app/lib/seedData';
import { SEED_EXERCISES } from './src/app/lib/exerciseSeed';
import { ThemeProvider, LIGHT, DARK, useThemeColors } from './src/app/lib/theme';
import { format } from 'date-fns';

// Pages
import OverviewPage from './src/app/components/OverviewPage';
import DietPage from './src/app/components/DietPage';
import PantryPage from './src/app/components/PantryPage';
import FoodAdderPage from './src/app/components/FoodAdderPage';
import FoodEntryPage from './src/app/components/FoodEntryPage';
import FoodDetailPage from './src/app/components/FoodDetailPage';
import LoggerPage from './src/app/components/LoggerPage';
import NutritionSummaryPage from './src/app/components/NutritionSummaryPage';
import LogFoodPickerPage from './src/app/components/LogFoodPickerPage';
import MealPlannerPage from './src/app/components/MealPlannerPage';
import MealPlanDetailPage from './src/app/components/MealPlanDetailPage';
import ExercisePage from './src/app/components/ExercisePage';
import PlanMakerPage from './src/app/components/PlanMakerPage';
import WorkoutTrackerPage from './src/app/components/WorkoutTrackerPage';
import AICoachPage from './src/app/components/AICoachPage';
import RestPage from './src/app/components/RestPage';
import CoachChatPage from './src/app/components/CoachChatPage';
import CoachBriefingPage from './src/app/components/CoachBriefingPage';
import SessionDetailPage from './src/app/components/SessionDetailPage';
import ExerciseHistoryPage from './src/app/components/ExerciseHistoryPage';
import ProfilePage from './src/app/components/ProfilePage';
import BlankPage from './src/app/components/BlankPage';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function DietStack({ store }) {
  const {
    foods,
    pantryIds,
    pantryOrder,
    myVotes,
    log,
    addToPantry,
    removeFromPantry,
    reorderPantry,
    addCustomFood,
    vote,
    addLogEntry,
    removeLogEntry,
    updateLogEntryServings,
  } = store;

  const pantryFoods = foods.filter((f) => pantryIds.includes(f.id));

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="DietMain"
    >
      <Stack.Screen name="DietMain" options={{ title: 'Diet' }}>
        {() => <DietPage />}
      </Stack.Screen>
      <Stack.Screen name="Pantry" options={{ title: 'Pantry' }}>
        {() => (
          <PantryPage
            foods={pantryFoods}
            customOrder={pantryOrder}
            onRemoveItem={removeFromPantry}
            onReorderItem={reorderPantry}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="FoodAdder" options={{ title: 'Add to Pantry' }}>
        {() => (
          <FoodAdderPage
            foods={foods}
            pantryIds={pantryIds}
            myVotes={myVotes}
            onVote={vote}
            onAddFood={addToPantry}
            onRemoveFood={removeFromPantry}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="FoodEntry" options={{ title: 'Add Food Entry' }}>
        {() => <FoodEntryPage onSave={addCustomFood} />}
      </Stack.Screen>
      <Stack.Screen name="FoodDetail" options={{ title: 'Food Details' }}>
        {() => (
          <FoodDetailPage
            foods={foods}
            pantryIds={pantryIds}
            myVotes={myVotes}
            onVote={vote}
            onAddFood={addToPantry}
            onRemoveFood={removeFromPantry}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Logger" options={{ title: 'Logger' }}>
        {() => (
          <LoggerPage
            foods={foods}
            pantryIds={pantryIds}
            log={log}
            water={store.water}
            waterGoalOz={store.waterGoalOz}
            waterCupOz={store.waterCupOz}
            onSetWater={store.setWaterForDate}
            onAddEntry={addLogEntry}
            onRemoveEntry={removeLogEntry}
            onUpdateServings={updateLogEntryServings}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="LogFoodPicker" options={{ title: 'Add Food' }}>
        {() => (
          <LogFoodPickerPage
            foods={foods}
            pantryIds={pantryIds}
            onAddEntry={addLogEntry}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="NutritionSummary"
        options={{ title: 'Nutrition Summary' }}
      >
        {() => <NutritionSummaryPage foods={foods} log={log} />}
      </Stack.Screen>
      <Stack.Screen name="MealPresets" options={{ title: 'Meal Planner' }}>
        {() => (
          <MealPlannerPage
            foods={foods}
            pantryIds={pantryIds}
            settings={store.plannerSettings}
            onChangeSettings={store.updatePlannerSettings}
            plan={store.mealPlan}
            onSetPlan={store.setMealPlan}
            onAddEntry={addLogEntry}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="PlanMealDetail" options={{ title: 'Planned Meal' }}>
        {() => (
          <MealPlanDetailPage
            foods={foods}
            pantryIds={pantryIds}
            plan={store.mealPlan}
            onSetPlan={store.setMealPlan}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="DietRecs" options={{ title: 'Diet Recommendations' }}>
        {() => <BlankPage title="Diet Recommendations" />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function ExerciseStack({ store }) {
  const {
    exercises,
    plans,
    sessions,
    addPlan,
    updatePlan,
    deletePlan,
    startSession,
    updateSession,
    finishSession,
    deleteSession,
  } = store;

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="ExerciseMain"
    >
      <Stack.Screen name="ExerciseMain" options={{ title: 'Exercise' }}>
        {() => <ExercisePage />}
      </Stack.Screen>
      <Stack.Screen name="PlanMaker" options={{ title: 'Plan Maker' }}>
        {() => (
          <PlanMakerPage
            plans={plans}
            exercises={exercises}
            restSeconds={store.restSeconds}
            onSavePlan={addPlan}
            onUpdatePlan={updatePlan}
            onDeletePlan={deletePlan}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="WorkoutTracker" options={{ title: 'Tracker' }}>
        {() => (
          <WorkoutTrackerPage
            exercises={exercises}
            plans={plans}
            sessions={sessions}
            restSeconds={store.restSeconds}
            activePlanId={store.activePlanId}
            onSelectPlan={store.setActivePlanId}
            onStartSession={startSession}
            onUpdateSession={updateSession}
            onFinishSession={finishSession}
            onDeleteSession={deleteSession}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="AICoach" options={{ title: 'AI Coach' }}>
        {() => <AICoachPage store={store} />}
      </Stack.Screen>
      <Stack.Screen name="CoachChat" options={{ title: 'Coach Chat' }}>
        {() => <CoachChatPage store={store} />}
      </Stack.Screen>
      <Stack.Screen name="CoachBriefing" options={{ title: 'Coach Briefing' }}>
        {() => (
          <CoachBriefingPage
            briefing={store.coachBriefing}
            onChange={store.setCoachBriefing}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Rest" options={{ title: 'Rest' }}>
        {() => (
          <RestPage
            sleep={store.sleep}
            onAddSleep={store.addSleepEntry}
            onDeleteSleep={store.deleteSleepEntry}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="SessionDetail" options={{ title: 'Workout Details' }}>
        {() => (
          <SessionDetailPage exercises={exercises} sessions={sessions} />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="ExerciseHistory"
        options={{ title: 'Exercise History' }}
      >
        {() => (
          <ExerciseHistoryPage exercises={exercises} sessions={sessions} />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

// Owns all persisted app state and exposes handlers for it.
function useAppStore() {
  const [foods, setFoods, foodsHydrated] = usePersistedState(
    STORAGE_KEYS.foods,
    SEED_FOODS
  );

  // Self-heal: if the bundled seed foods ever gain richer data than what's
  // persisted on-device (e.g. the full nutrition profiles), refresh the
  // seed entries in place. User-created foods are never touched.
  useEffect(() => {
    if (!foodsHydrated) return;
    const seedIds = new Set(SEED_FOODS.map((f) => f.id));
    const stale = SEED_FOODS.some((sf) => {
      const cur = foods.find((f) => f.id === sf.id);
      return (
        !cur ||
        Object.keys(cur.nutrients ?? {}).length <
          Object.keys(sf.nutrients).length ||
        // Category renames (e.g. Dairy & Eggs split) also refresh seeds.
        cur.category !== sf.category
      );
    });
    if (stale) {
      setFoods((prev) => [
        ...SEED_FOODS,
        ...prev.filter((f) => !seedIds.has(f.id)),
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foodsHydrated]);

  // Self-heal: user-created foods still on the retired 'Dairy & Eggs'
  // category migrate to 'Dairy'/'Eggs' (egg-in-name heuristic).
  useEffect(() => {
    if (!foodsHydrated) return;
    if (foods.some((f) => f.category === LEGACY_DAIRY_EGGS)) {
      setFoods((prev) =>
        prev.map((f) =>
          f.category === LEGACY_DAIRY_EGGS
            ? { ...f, category: splitDairyEggs(f.category, f.name) }
            : f
        )
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foodsHydrated]);
  const [pantryIds, setPantryIds] = usePersistedState(
    STORAGE_KEYS.pantry,
    SEED_PANTRY_IDS
  );
  const [pantryOrder, setPantryOrder] = usePersistedState(
    STORAGE_KEYS.pantryOrder,
    {}
  );
  const [myVotes, setMyVotes] = usePersistedState(STORAGE_KEYS.votes, {});
  const [log, setLog] = usePersistedState(STORAGE_KEYS.log, []);

  const addToPantry = (foodId) => {
    setPantryIds((prev) => (prev.includes(foodId) ? prev : [...prev, foodId]));
  };

  const removeFromPantry = (foodId) => {
    setPantryIds((prev) => prev.filter((id) => id !== foodId));
  };

  const reorderPantry = (category, orderedIds) => {
    setPantryOrder((prev) => ({ ...prev, [category]: orderedIds }));
  };

  // draft: { name, category, servingLabel, servingWeightGrams, nutrients }
  const addCustomFood = (draft) => {
    const newFood = {
      ...draft,
      id: `f${Date.now()}`,
      uploadedBy: 'You',
      upvotes: 0,
      downvotes: 0,
    };
    setFoods((prev) => [...prev, newFood]);
    return newFood;
  };

  // Toggle-style voting that actually updates the food's counts.
  // Tapping the same direction again removes the vote; tapping the other
  // direction switches it.
  const vote = (foodId, direction) => {
    const previous = myVotes[foodId] ?? null;
    const next = previous === direction ? null : direction;

    setMyVotes((prev) => {
      const copy = { ...prev };
      if (next === null) delete copy[foodId];
      else copy[foodId] = next;
      return copy;
    });

    setFoods((prev) =>
      prev.map((f) => {
        if (f.id !== foodId) return f;
        let { upvotes, downvotes } = f;
        if (previous === 'up') upvotes -= 1;
        if (previous === 'down') downvotes -= 1;
        if (next === 'up') upvotes += 1;
        if (next === 'down') downvotes += 1;
        return { ...f, upvotes, downvotes };
      })
    );
  };

  // entry: { date, meal, foodId, servings }
  const addLogEntry = (entry) => {
    setLog((prev) => [
      ...prev,
      { ...entry, id: `l${Date.now()}`, loggedAt: Date.now() },
    ]);
  };

  const removeLogEntry = (entryId) => {
    setLog((prev) => prev.filter((e) => e.id !== entryId));
  };

  const updateLogEntryServings = (entryId, servings) => {
    if (servings <= 0) {
      removeLogEntry(entryId);
      return;
    }
    setLog((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, servings } : e))
    );
  };

  // ---- Exercise ----
  // Exercise database is static seed for now; community uploads later.
  const exercises = SEED_EXERCISES;

  const [plans, setPlans, plansHydrated] = usePersistedState(
    STORAGE_KEYS.plans,
    []
  );
  const [sessions, setSessions] = usePersistedState(STORAGE_KEYS.sessions, []);

  // Self-heal: migrate legacy single-day plans (which had `exercises`
  // directly on the plan, no `days`) into the multi-day shape.
  useEffect(() => {
    if (!plansHydrated) return;
    if (plans.some((p) => !Array.isArray(p.days))) {
      setPlans((prev) =>
        prev.map((p) =>
          Array.isArray(p.days)
            ? p
            : {
                ...p,
                days: [
                  { id: `d_${p.id}`, name: 'Day 1', exercises: p.exercises ?? [] },
                ],
                exercises: undefined,
              }
        )
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plansHydrated]);

  // draft: { name, days } — plans only persist via the explicit Save button
  // in the Plan Maker; there is no autosave.
  const addPlan = (draft) => {
    const plan = { ...draft, id: `p${Date.now()}`, createdAt: Date.now() };
    setPlans((prev) => [...prev, plan]);
    return plan;
  };

  const updatePlan = (planId, patch) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === planId ? { ...p, ...patch } : p))
    );
  };

  const deletePlan = (planId) => {
    setPlans((prev) => prev.filter((p) => p.id !== planId));
  };

  const startSession = (planId, dayId) => {
    // Only one active session at a time.
    if (sessions.some((s) => s.finishedAt === null)) return;
    const plan = planId ? plans.find((p) => p.id === planId) : null;
    const day = plan?.days?.find((d) => d.id === dayId) ?? null;
    const session = {
      id: `s${Date.now()}`,
      date: format(new Date(), 'yyyy-MM-dd'),
      name: plan ? (day ? `${plan.name} · ${day.name}` : plan.name) : 'Freestyle',
      planId: plan ? plan.id : null,
      dayId: day ? day.id : null,
      exercises: (day?.exercises ?? []).map((pe) => {
        const ex = exercises.find((e) => e.id === pe.exerciseId);
        return ex?.kind === 'cardio'
          ? { exerciseId: pe.exerciseId, sets: [], durationMin: 0 }
          : { exerciseId: pe.exerciseId, sets: [{ weight: 0, reps: 0 }] };
      }),
      startedAt: Date.now(),
      finishedAt: null,
    };
    setSessions((prev) => [...prev, session]);
    return session;
  };

  const updateSession = (sessionId, patch) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, ...patch } : s))
    );
  };

  // Finishing keeps only sets marked done (✓) — unchecked sets were
  // never completed, so they don't enter history. Exercises left with
  // nothing logged are dropped entirely.
  const finishSession = (sessionId) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        const exercises = (s.exercises ?? [])
          .map((se) => ({
            ...se,
            sets: (se.sets ?? []).filter((set) => set.done),
          }))
          .filter(
            (se) => se.sets.length > 0 || (se.durationMin ?? 0) > 0
          );
        return { ...s, exercises, finishedAt: Date.now() };
      })
    );
  };

  const deleteSession = (sessionId) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  // Remembered "current plan" for the Tracker's start dropdown.
  const [activePlanId, setActivePlanId] = usePersistedState(
    STORAGE_KEYS.activePlan,
    null
  );

  // ---- Settings ----
  const [darkMode, setDarkMode] = usePersistedState(
    STORAGE_KEYS.darkMode,
    false
  );
  const [restSeconds, setRestSeconds] = usePersistedState(
    STORAGE_KEYS.restSeconds,
    90
  );

  // ---- Water (oz per day, keyed by yyyy-MM-dd) ----
  const [water, setWater] = usePersistedState(STORAGE_KEYS.water, {});
  const [waterGoalOz, setWaterGoalOz] = usePersistedState(
    STORAGE_KEYS.waterGoalOz,
    80
  );
  const [waterCupOz, setWaterCupOz] = usePersistedState(
    STORAGE_KEYS.waterCupOz,
    10
  );
  const setWaterForDate = (date, oz) =>
    setWater((prev) => ({ ...prev, [date]: Math.max(0, oz) }));

  // ---- Meal planner: day template settings + last generated plan ----
  const [plannerSettings, setPlannerSettings, plannerHydrated] =
    usePersistedState(STORAGE_KEYS.plannerSettings, DEFAULT_PLANNER_SETTINGS);
  const updatePlannerSettings = (patch) =>
    setPlannerSettings((prev) => ({ ...prev, ...patch }));

  // Self-heal: replace the retired 'Dairy & Eggs' category with
  // 'Dairy' + 'Eggs' anywhere it appears in planner settings.
  useEffect(() => {
    if (!plannerHydrated) return;
    const splitList = (cats) =>
      (cats ?? []).flatMap((cat) =>
        cat === LEGACY_DAIRY_EGGS ? ['Dairy', 'Eggs'] : [cat]
      );
    const touched =
      (plannerSettings.slots ?? []).some((s) =>
        (s.categories ?? []).includes(LEGACY_DAIRY_EGGS)
      ) ||
      (plannerSettings.restrictedDays ?? []).some((r) =>
        (r.allowedCategories ?? []).includes(LEGACY_DAIRY_EGGS)
      );
    if (touched) {
      setPlannerSettings((prev) => ({
        ...prev,
        slots: (prev.slots ?? []).map((s) =>
          s.categories ? { ...s, categories: splitList(s.categories) } : s
        ),
        restrictedDays: (prev.restrictedDays ?? []).map((r) => ({
          ...r,
          allowedCategories: splitList(r.allowedCategories),
        })),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plannerHydrated]);
  const [mealPlan, setMealPlan] = usePersistedState(
    STORAGE_KEYS.mealPlan,
    null
  );

  // ---- Steps (daily totals snapshotted from the phone's pedometer) ----
  const [steps, setSteps] = usePersistedState(STORAGE_KEYS.steps, {});
  // patch: { 'yyyy-MM-dd': count, ... } — merged over what's stored so
  // days older than the OS's ~7-day window keep their snapshot.
  const snapshotSteps = (patch) => setSteps((prev) => ({ ...prev, ...patch }));

  // ---- Sleep log (one entry per wake date) ----
  const [sleep, setSleep] = usePersistedState(STORAGE_KEYS.sleep, []);
  const addSleepEntry = (entry) =>
    setSleep((prev) => [
      { ...entry, id: `sl${Date.now()}` },
      // Re-logging a date replaces that night
      ...prev.filter((e) => e.date !== entry.date),
    ]);
  const deleteSleepEntry = (entryId) =>
    setSleep((prev) => prev.filter((e) => e.id !== entryId));

  // ---- AI Coach: provider settings + cached suggestions ----
  const [coachProvider, setCoachProvider] = usePersistedState(
    STORAGE_KEYS.coachProvider,
    'claude'
  );
  const [coachClaudeKey, setCoachClaudeKey] = usePersistedState(
    STORAGE_KEYS.coachClaudeKey,
    ''
  );
  const [coachClaudeModel, setCoachClaudeModel] = usePersistedState(
    STORAGE_KEYS.coachClaudeModel,
    'claude-haiku-4-5-20251001'
  );
  const [coachOllamaUrl, setCoachOllamaUrl] = usePersistedState(
    STORAGE_KEYS.coachOllamaUrl,
    'http://localhost:11434'
  );
  const [coachOllamaModel, setCoachOllamaModel] = usePersistedState(
    STORAGE_KEYS.coachOllamaModel,
    'llama3.1'
  );
  const [coachCache, setCoachCache] = usePersistedState(
    STORAGE_KEYS.coachCache,
    null
  );
  // Coach profile: drives rule thresholds and personalizes LLM prompts.
  const [coachProfile, setCoachProfile] = usePersistedState(
    STORAGE_KEYS.coachProfile,
    { goal: 'muscle', dietStyle: 'omnivore', bodyWeightLb: 0, weeklyWorkoutTarget: 3 }
  );
  const updateCoachProfile = (patch) =>
    setCoachProfile((prev) => ({ ...prev, ...patch }));
  // Briefing: user-authored context the coach reads before every reply.
  const [coachBriefing, setCoachBriefing] = usePersistedState(
    STORAGE_KEYS.coachBriefing,
    ''
  );
  const [coachChat, setCoachChat] = usePersistedState(
    STORAGE_KEYS.coachChat,
    []
  );

  return {
    foods,
    pantryIds,
    pantryOrder,
    myVotes,
    log,
    addToPantry,
    removeFromPantry,
    reorderPantry,
    addCustomFood,
    vote,
    addLogEntry,
    removeLogEntry,
    updateLogEntryServings,
    exercises,
    plans,
    sessions,
    addPlan,
    updatePlan,
    deletePlan,
    startSession,
    updateSession,
    finishSession,
    deleteSession,
    activePlanId,
    setActivePlanId,
    darkMode,
    setDarkMode,
    restSeconds,
    setRestSeconds,
    water,
    setWaterForDate,
    waterGoalOz,
    setWaterGoalOz,
    waterCupOz,
    setWaterCupOz,
    steps,
    snapshotSteps,
    plannerSettings,
    updatePlannerSettings,
    mealPlan,
    setMealPlan,
    sleep,
    addSleepEntry,
    deleteSleepEntry,
    coachProvider,
    setCoachProvider,
    coachClaudeKey,
    setCoachClaudeKey,
    coachClaudeModel,
    setCoachClaudeModel,
    coachOllamaUrl,
    setCoachOllamaUrl,
    coachOllamaModel,
    setCoachOllamaModel,
    coachCache,
    setCoachCache,
    coachProfile,
    updateCoachProfile,
    coachBriefing,
    setCoachBriefing,
    coachChat,
    setCoachChat,
  };
}

function TabNavigator({ store }) {
  const c = useThemeColors();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopWidth: 2,
          borderTopColor: c.text,
        },
        tabBarLabelStyle: {
          fontFamily: 'Barlow Condensed',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        },
      }}
    >
      <Tab.Screen
        name="OverviewTab"
        options={{
          tabBarLabel: 'Overview',
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      >
        {() => <OverviewPage store={store} />}
      </Tab.Screen>
      <Tab.Screen
        name="ExerciseTab"
        options={{
          tabBarLabel: 'Exercise',
          tabBarIcon: ({ color }) => <Dumbbell size={24} color={color} />,
        }}
      >
        {() => <ExerciseStack store={store} />}
      </Tab.Screen>
      <Tab.Screen
        name="DietTab"
        options={{
          tabBarLabel: 'Diet',
          tabBarIcon: ({ color }) => <Utensils size={24} color={color} />,
        }}
      >
        {() => <DietStack store={store} />}
      </Tab.Screen>
      <Tab.Screen
        name="ProfileTab"
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <User size={24} color={color} />,
        }}
      >
        {() => (
          <ProfilePage
            foods={store.foods}
            log={store.log}
            sessions={store.sessions}
            darkMode={store.darkMode}
            onToggleDarkMode={store.setDarkMode}
            restSeconds={store.restSeconds}
            onChangeRestSeconds={store.setRestSeconds}
            waterGoalOz={store.waterGoalOz}
            onChangeWaterGoal={store.setWaterGoalOz}
            waterCupOz={store.waterCupOz}
            onChangeWaterCup={store.setWaterCupOz}
            coachProfile={store.coachProfile}
            onChangeCoachProfile={store.updateCoachProfile}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  const store = useAppStore();
  const palette = store.darkMode ? DARK : LIGHT;

  const navTheme = store.darkMode
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: DARK.surface,
          card: DARK.surface,
          border: DARK.border,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: LIGHT.surface,
          card: LIGHT.surface,
          border: LIGHT.border,
        },
      };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={palette}>
          <SafeAreaView
            style={{ flex: 1, backgroundColor: palette.surface }}
            edges={['top']}
          >
            <NavigationContainer theme={navTheme}>
              <TabNavigator store={store} />
            </NavigationContainer>
            <StatusBar style={store.darkMode ? 'light' : 'dark'} />
          </SafeAreaView>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

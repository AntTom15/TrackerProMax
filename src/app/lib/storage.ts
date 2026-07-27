import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@trackerpromax/';

export const STORAGE_KEYS = {
  // v2: seed foods gained complete nutrition profiles
  foods: `${PREFIX}foods_v2`,
  pantry: `${PREFIX}pantry`,
  pantryOrder: `${PREFIX}pantryOrder`,
  votes: `${PREFIX}votes`,
  log: `${PREFIX}log`,
  // v2: plans became multi-day
  plans: `${PREFIX}plans_v2`,
  sessions: `${PREFIX}sessions`,
  activePlan: `${PREFIX}activePlan`,
  darkMode: `${PREFIX}darkMode`,
  restSeconds: `${PREFIX}restSeconds`,
  // Water tracking: oz-per-day map plus goal/cup-size settings
  water: `${PREFIX}water`,
  waterGoalOz: `${PREFIX}waterGoalOz`,
  waterCupOz: `${PREFIX}waterCupOz`,
  sleep: `${PREFIX}sleep`,
  // Daily step-count snapshots (the OS only remembers ~7 days)
  steps: `${PREFIX}steps`,
  // Meal planner: day template + last generated plan
  plannerSettings: `${PREFIX}plannerSettings`,
  mealPlan: `${PREFIX}mealPlan`,
  // Recipes: ingredients only — nutrients are always derived
  recipes: `${PREFIX}recipes`,
  // AI Coach: provider settings + cached suggestions
  coachProvider: `${PREFIX}coachProvider`,
  coachClaudeKey: `${PREFIX}coachClaudeKey`,
  coachClaudeModel: `${PREFIX}coachClaudeModel`,
  coachOllamaUrl: `${PREFIX}coachOllamaUrl`,
  coachOllamaModel: `${PREFIX}coachOllamaModel`,
  coachCache: `${PREFIX}coachCache`,
  coachProfile: `${PREFIX}coachProfile`,
  // Coach briefing (user-authored context doc) + persisted chat thread
  coachBriefing: `${PREFIX}coachBriefing`,
  coachChat: `${PREFIX}coachChat`,
} as const;

/**
 * useState that hydrates from AsyncStorage on mount and writes back on
 * every change after hydration. Falls back to `initial` when nothing is
 * stored yet (first launch).
 */
export function usePersistedState<T>(
  key: string,
  initial: T
): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (cancelled) return;
        if (raw != null) {
          try {
            setValue(JSON.parse(raw) as T);
          } catch {
            // Corrupt entry — keep the initial value.
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          hydratedRef.current = true;
          setHydrated(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {
      // Persistence is best-effort; ignore write failures.
    });
  }, [key, value]);

  return [value, setValue, hydrated];
}

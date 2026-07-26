// Deterministic meal-plan generator.
//
// Given the user's pantry, a day template (meal slots with macro
// archetypes), and a calorie target, this builds concrete meals with
// real serving amounts. Design goals, in priority order:
//   1. Hit the day's calorie target tightly (±~3%).
//   2. Respect each slot's archetype (carb+lean AM, fatty PM, ...).
//   3. Maximize micronutrient coverage — foods are picked by how much
//      new %RDA they add per calorie, which also naturally favors
//      variety within a day (diminishing returns on repeats).
//   4. Rotate foods across days so a week doesn't repeat itself.
//   5. Softly steer toward optional macro % targets (wide tolerance —
//      calories are the hard constraint, macros are directional).
//
// Fully deterministic per (settings, pantry, date, seed): regenerating
// with a new seed rerolls the plan; the same seed reproduces it.
// No fiber/carb rewards exist here — diet steering is by omission,
// same philosophy as the coach rules engine.

import { format, addDays } from 'date-fns';
import type {
  Food,
  MealPlan,
  MealSlot,
  NutrientKey,
  PlannedDay,
  PlannedItem,
  PlannedMeal,
  PlannerSettings,
} from './types';
import { NUTRIENT_SECTIONS } from './nutrients';

// ---------------------------------------------------------------- defaults

export const DEFAULT_PLANNER_SETTINGS: PlannerSettings = {
  calorieTarget: 0, // 0 = unset; generation requires a real value
  proteinPct: null,
  carbPct: null,
  fatPct: null,
  slots: [
    { id: 'slot1', name: 'Breakfast', meal: 'Breakfast', archetype: 'carb-lean' },
    { id: 'slot2', name: 'Lunch', meal: 'Lunch', archetype: 'balanced' },
    { id: 'slot3', name: 'Dinner', meal: 'Dinner', archetype: 'fatty' },
  ],
};

export const ARCHETYPE_LABELS: Record<MealSlot['archetype'], string> = {
  'carb-lean': 'Carbs + Lean',
  fatty: 'Fatty',
  'high-protein': 'High Protein',
  balanced: 'Balanced',
};

// -------------------------------------------------------------- seeded rng

// mulberry32 — tiny, fast, good enough for tie-breaking jitter.
const mulberry32 = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const hashStr = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

// ---------------------------------------------------- micronutrient scoring

// Micronutrients that count toward coverage: vitamins, minerals and
// omega-3 with an established RDA. Sodium/chloride are excluded (easy
// to overshoot, not a win) and fiber/sugars are deliberately absent —
// steering by omission.
const MICRO_RDA: { key: NutrientKey; rda: number }[] = (() => {
  const wanted = new Set(['Vitamins', 'Major Minerals', 'Trace Minerals']);
  const out: { key: NutrientKey; rda: number }[] = [];
  for (const section of NUTRIENT_SECTIONS) {
    if (!wanted.has(section.title)) continue;
    for (const item of section.items) {
      if (!item.rda) continue;
      if (item.key === 'sodium' || item.key === 'chloride') continue;
      out.push({ key: item.key, rda: item.rda });
    }
  }
  out.push({ key: 'omega3', rda: 1600 });
  return out;
})();

type Totals = Partial<Record<NutrientKey, number>>;

const addToTotals = (totals: Totals, food: Food, servings: number) => {
  for (const [k, v] of Object.entries(food.nutrients ?? {})) {
    if (typeof v !== 'number') continue;
    totals[k as NutrientKey] = (totals[k as NutrientKey] ?? 0) + v * servings;
  }
};

// Marginal %RDA coverage gained by adding `servings` of `food` on top
// of `totals`, capped at 100% per nutrient (diminishing returns).
const microGain = (totals: Totals, food: Food, servings: number) => {
  let gain = 0;
  for (const { key, rda } of MICRO_RDA) {
    const per = food.nutrients?.[key] ?? 0;
    if (per <= 0) continue;
    const cur = totals[key] ?? 0;
    gain +=
      Math.min(1, (cur + per * servings) / rda) - Math.min(1, cur / rda);
  }
  return gain;
};

// ------------------------------------------------------------ archetype fit

interface MacroShape {
  cal: number;
  pFrac: number; // fraction of calories from protein
  cFrac: number; // ...from carbs
  fFrac: number; // ...from fat
}

const macroShape = (food: Food): MacroShape => {
  const n = food.nutrients ?? {};
  const cal = n.calories ?? 0;
  if (cal <= 0) return { cal: 0, pFrac: 0, cFrac: 0, fFrac: 0 };
  return {
    cal,
    pFrac: ((n.protein ?? 0) * 4) / cal,
    cFrac: ((n.carbs ?? 0) * 4) / cal,
    fFrac: ((n.fat ?? 0) * 9) / cal,
  };
};

// 0 = excluded from this slot; otherwise a 0..1.2 multiplier.
const archetypeFit = (shape: MacroShape, archetype: MealSlot['archetype']) => {
  const { pFrac, cFrac, fFrac } = shape;
  switch (archetype) {
    case 'carb-lean': {
      // Wants carb sources and lean protein; fat-heavy foods excluded.
      if (fFrac >= 0.55) return 0;
      if (cFrac >= 0.5) return 1.2; // carb source
      if (pFrac >= 0.4 && fFrac <= 0.4) return 1.1; // lean protein
      return 0.5;
    }
    case 'fatty': {
      // Wants fat-dominant foods; carb-heavy foods excluded.
      if (cFrac >= 0.4) return 0;
      if (fFrac >= 0.55) return 1.2;
      if (fFrac >= 0.35) return 1.0; // fatty-enough protein
      return 0.4;
    }
    case 'high-protein': {
      if (pFrac >= 0.45) return 1.2;
      if (pFrac >= 0.3) return 0.9;
      return 0.4;
    }
    case 'balanced':
      return 1;
  }
};

// ---------------------------------------------------------------- planning

export interface GenerateResult {
  plan: MealPlan;
  warnings: string[];
}

interface Candidate {
  food: Food;
  shape: MacroShape;
}

const round25 = (x: number) => Math.max(0.25, Math.round(x * 4) / 4);

// Sanity bounds: nothing below ~25 kcal/serving can anchor a meal
// (stops "64x lemon juice" filler), and no single food exceeds 4
// servings in one meal.
const MIN_CAL_PER_SERVING = 25;
const MAX_SERVINGS = 4;

// Soft macro steering: how far the day's macro fractions sit outside a
// wide tolerance band around the targets. Lower is better.
const macroDeviation = (
  totals: Totals,
  settings: PlannerSettings
): number => {
  const cal = totals.calories ?? 0;
  if (cal <= 0) return 0;
  const TOLERANCE = 0.07; // ±7 percentage points is "close enough"
  let dev = 0;
  const checks: [number | null, number][] = [
    [settings.proteinPct, ((totals.protein ?? 0) * 4) / cal],
    [settings.carbPct, ((totals.carbs ?? 0) * 4) / cal],
    [settings.fatPct, ((totals.fat ?? 0) * 9) / cal],
  ];
  for (const [target, actual] of checks) {
    if (target == null) continue;
    const d = Math.abs(actual - target / 100) - TOLERANCE;
    if (d > 0) dev += d;
  }
  return dev;
};

const buildMeal = (
  slot: MealSlot,
  budget: number,
  candidates: Candidate[],
  dayTotals: Totals,
  settings: PlannerSettings,
  recentUse: Map<string, number>,
  planUse: Map<string, number>,
  dayUsed: Set<string>,
  rng: () => number
): PlannedItem[] => {
  const items: PlannedItem[] = [];
  const usedHere = new Set<string>();
  let remaining = budget;
  // 2–4 foods is the sweet spot; the serving cap can force extra picks.
  const targetItems = budget < 350 ? 2 : budget < 650 ? 3 : 4;

  for (let pick = 0; pick < 6 && remaining > 60; pick++) {
    const isLast = pick >= targetItems - 1;
    // Last pick absorbs the remainder; earlier picks take a chunk but
    // may stretch to 60% of what's left.
    const chunk = isLast
      ? remaining
      : Math.min(
          remaining * 0.6,
          remaining / Math.max(1, targetItems - pick) + 80
        );

    let best: { cand: Candidate; servings: number; score: number } | null =
      null;

    for (const cand of candidates) {
      if (usedHere.has(cand.food.id)) continue;
      if (cand.shape.cal < MIN_CAL_PER_SERVING) continue;
      const fit = archetypeFit(cand.shape, slot.archetype);
      if (fit <= 0) continue;

      const servings = Math.min(round25(chunk / cand.shape.cal), MAX_SERVINGS);
      const cals = servings * cand.shape.cal;
      // Don't blow the budget: allow modest overshoot only.
      if (cals > remaining * 1.25 + 40) continue;

      // Micronutrient value per calorie — the core objective.
      const gain = microGain(dayTotals, cand.food, servings);
      let score = (gain / Math.max(cals, 50)) * 1000;

      // Slot archetype fit.
      score *= fit;

      // Rotation: heavy penalty for yesterday's foods, lighter for the
      // rest of the recent window, mild within the same plan.
      const recent = recentUse.get(cand.food.id) ?? 0;
      const inPlan = planUse.get(cand.food.id) ?? 0;
      score *= Math.pow(0.55, recent) * Math.pow(0.8, inPlan);
      // Strongly avoid serving the same food twice in one day.
      if (dayUsed.has(cand.food.id)) score *= 0.1;

      // Optional macro targets: penalize picks that worsen deviation.
      if (
        settings.proteinPct != null ||
        settings.carbPct != null ||
        settings.fatPct != null
      ) {
        const before = macroDeviation(dayTotals, settings);
        const trial: Totals = { ...dayTotals };
        addToTotals(trial, cand.food, servings);
        const after = macroDeviation(trial, settings);
        const worsened = after - before;
        if (worsened > 0) score *= 1 / (1 + 8 * worsened);
      }

      // Seeded jitter so equal-ish foods trade places between rerolls.
      score *= 0.85 + rng() * 0.3;

      if (!best || score > best.score) best = { cand, servings, score };
    }

    if (!best) break;
    items.push({ foodId: best.cand.food.id, servings: best.servings });
    usedHere.add(best.cand.food.id);
    dayUsed.add(best.cand.food.id);
    addToTotals(dayTotals, best.cand.food, best.servings);
    remaining -= best.servings * best.cand.shape.cal;
  }

  return items;
};

// Nudge the day's biggest item by quarter-servings until the day total
// sits within ±3% of target (or we run out of room to adjust).
const trueUpCalories = (
  day: PlannedDay,
  foodById: Map<string, Food>,
  target: number
) => {
  const dayCals = () =>
    day.meals.reduce(
      (a, m) =>
        a +
        m.items.reduce(
          (b, it) =>
            b +
            (foodById.get(it.foodId)?.nutrients?.calories ?? 0) * it.servings,
          0
        ),
      0
    );

  for (let guard = 0; guard < 40; guard++) {
    const total = dayCals();
    const diff = target - total;
    if (Math.abs(diff) <= target * 0.03) break;

    // Adjust the item whose per-quarter-serving step best fits the gap.
    let bestItem: PlannedItem | null = null;
    let bestStep = 0;
    for (const meal of day.meals) {
      for (const it of meal.items) {
        const cal = foodById.get(it.foodId)?.nutrients?.calories ?? 0;
        if (cal <= 0) continue;
        const step = cal * 0.25;
        const dir = diff > 0 ? 1 : -1;
        if (dir < 0 && it.servings <= 0.25) continue; // can't shrink further
        if (dir > 0 && it.servings >= MAX_SERVINGS) continue; // capped
        if (step > Math.abs(diff) * 1.5) continue; // too coarse a step
        if (!bestItem || step > bestStep) {
          bestItem = it;
          bestStep = step * dir;
        }
      }
    }
    if (!bestItem) break;
    bestItem.servings = Math.round((bestItem.servings + (bestStep > 0 ? 0.25 : -0.25)) * 100) / 100;
  }
};

export function generatePlan(
  foods: Food[],
  pantryIds: string[],
  settings: PlannerSettings,
  startDate: Date,
  numDays: number,
  seed: number,
  // Food usage in the days immediately before the plan (e.g. from the
  // real log), so day 1 doesn't repeat what was just eaten. Optional.
  priorUse?: Map<string, number>
): GenerateResult {
  const warnings: string[] = [];
  const pantrySet = new Set(pantryIds);
  const pool = foods.filter(
    (f) => pantrySet.has(f.id) && (f.nutrients?.calories ?? 0) > 0
  );

  const candidates: Candidate[] = pool.map((food) => ({
    food,
    shape: macroShape(food),
  }));

  if (settings.calorieTarget < 800) {
    warnings.push('Set a daily calorie target (at least 800) to generate.');
    return {
      plan: { id: `mp${Date.now()}`, createdAt: Date.now(), seed, days: [] },
      warnings,
    };
  }
  const usable = candidates.filter(
    (cd) => cd.shape.cal >= MIN_CAL_PER_SERVING
  ).length;
  if (usable < 9) {
    warnings.push(
      'Your pantry is thin — stock more foods for better plans (9+ recommended).'
    );
  }
  if (settings.slots.length === 0) {
    warnings.push('Add at least one meal slot to your day template.');
    return {
      plan: { id: `mp${Date.now()}`, createdAt: Date.now(), seed, days: [] },
      warnings,
    };
  }

  const foodById = new Map(foods.map((f) => [f.id, f]));
  const perSlotBudget = settings.calorieTarget / settings.slots.length;

  const days: PlannedDay[] = [];
  // Rolling usage counts for rotation (last-2-days window + whole plan).
  const planUse = new Map<string, number>();
  let prevDayFoods = new Set<string>();
  let prevPrevDayFoods = new Set<string>();
  if (priorUse) {
    // Treat recently-logged foods as if they appeared on "day 0".
    prevDayFoods = new Set(priorUse.keys());
  }

  for (let d = 0; d < numDays; d++) {
    const date = format(addDays(startDate, d), 'yyyy-MM-dd');
    const rng = mulberry32(hashStr(`${date}|${seed}`));
    const dayTotals: Totals = {};
    const meals: PlannedMeal[] = [];

    const recentUse = new Map<string, number>();
    for (const id of prevDayFoods)
      recentUse.set(id, (recentUse.get(id) ?? 0) + 2);
    for (const id of prevPrevDayFoods)
      recentUse.set(id, (recentUse.get(id) ?? 0) + 1);

    const dayUsed = new Set<string>();
    for (const slot of settings.slots) {
      const items = buildMeal(
        slot,
        perSlotBudget,
        candidates,
        dayTotals,
        settings,
        recentUse,
        planUse,
        dayUsed,
        rng
      );
      meals.push({ slotId: slot.id, slotName: slot.name, meal: slot.meal, items });
    }

    const day: PlannedDay = { date, meals };
    trueUpCalories(day, foodById, settings.calorieTarget);
    days.push(day);

    const todayFoods = new Set<string>();
    for (const m of meals)
      for (const it of m.items) {
        todayFoods.add(it.foodId);
        planUse.set(it.foodId, (planUse.get(it.foodId) ?? 0) + 1);
      }
    prevPrevDayFoods = prevDayFoods;
    prevDayFoods = todayFoods;
  }

  const emptyMeals = days.some((day) => day.meals.some((m) => m.items.length === 0));
  if (emptyMeals) {
    warnings.push(
      'Some meals came out empty — your pantry may not have foods matching every slot archetype.'
    );
  }

  return {
    plan: { id: `mp${Date.now()}`, createdAt: Date.now(), seed, days },
    warnings,
  };
}

// ------------------------------------------------------------ plan helpers

export const mealTotals = (meal: PlannedMeal, foodById: Map<string, Food>) => {
  const t = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const it of meal.items) {
    const n = foodById.get(it.foodId)?.nutrients ?? {};
    t.calories += (n.calories ?? 0) * it.servings;
    t.protein += (n.protein ?? 0) * it.servings;
    t.carbs += (n.carbs ?? 0) * it.servings;
    t.fat += (n.fat ?? 0) * it.servings;
  }
  return t;
};

export const dayTotals = (day: PlannedDay, foodById: Map<string, Food>) => {
  const t = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const meal of day.meals) {
    const mt = mealTotals(meal, foodById);
    t.calories += mt.calories;
    t.protein += mt.protein;
    t.carbs += mt.carbs;
    t.fat += mt.fat;
  }
  return t;
};

// Micronutrient coverage for a day: average capped %RDA across the
// scored micronutrient set (0..1).
export const dayMicroCoverage = (
  day: PlannedDay,
  foodById: Map<string, Food>
) => {
  const totals: Totals = {};
  for (const meal of day.meals)
    for (const it of meal.items) {
      const food = foodById.get(it.foodId);
      if (food) addToTotals(totals, food, it.servings);
    }
  let sum = 0;
  for (const { key, rda } of MICRO_RDA)
    sum += Math.min(1, (totals[key] ?? 0) / rda);
  return sum / MICRO_RDA.length;
};

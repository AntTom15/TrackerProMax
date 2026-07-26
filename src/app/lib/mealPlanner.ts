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

import { format, addDays, getDay } from 'date-fns';
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
  restrictedDays: [],
  includeRecommendations: false,
};

// Non-pantry foods must beat pantry foods by a clear margin (1/0.75 ≈
// 1.33×) before they get recommended — the pantry is what the user
// actually owns.
const RECOMMENDATION_HANDICAP = 0.75;

// Effective calorie share per slot. Explicit caloriePct values are
// honored; slots left on "auto" split whatever percent is unclaimed.
// If explicit shares alone exceed 100 they're scaled down (and auto
// slots get nothing) — generatePlan warns when that happens.
export const effectiveSlotPcts = (
  slots: PlannerSettings['slots']
): number[] => {
  const explicit = slots.map((s) =>
    typeof s.caloriePct === 'number' && s.caloriePct > 0
      ? Math.min(100, s.caloriePct)
      : null
  );
  const explicitSum = explicit.reduce((a: number, p) => a + (p ?? 0), 0);
  const autoCount = explicit.filter((p) => p == null).length;
  const autoShare =
    autoCount > 0 ? Math.max(0, 100 - explicitSum) / autoCount : 0;
  let pcts = explicit.map((p) => p ?? autoShare);
  const total = pcts.reduce((a, b) => a + b, 0);
  if (total > 0) pcts = pcts.map((p) => (p / total) * 100);
  return pcts;
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

// Marginal micronutrient value of adding `servings` of `food`.
// Two horizons blend:
//   - daily: capped at 100% of RDA for today (in-day variety);
//   - weekly pace: capped at `pace` × RDA for the running 7-day window
//     (pace = how many RDA-days should be covered by tonight). A
//     nutrient already at week-pace earns nothing, so multi-day plans
//     chase the week's laggards toward TRUE 100% weekly fulfillment
//     instead of repeating the same 90% every day.
// weekPrev holds finalized totals from earlier days in the window;
// today's running totals are added on top.
const microGain = (
  dayTotals: Totals,
  weekPrev: Totals,
  pace: number,
  food: Food,
  servings: number
) => {
  let gain = 0;
  for (const { key, rda } of MICRO_RDA) {
    const per = food.nutrients?.[key] ?? 0;
    if (per <= 0) continue;
    const add = per * servings;
    const d0 = dayTotals[key] ?? 0;
    const dailyGain =
      Math.min(1, (d0 + add) / rda) - Math.min(1, d0 / rda);
    const w0 = (weekPrev[key] ?? 0) + d0;
    const weekTarget = rda * pace;
    // Scaled by pace so a given milligram counts the same on both axes.
    const weekGain =
      (Math.min(1, (w0 + add) / weekTarget) -
        Math.min(1, w0 / weekTarget)) *
      pace;
    gain += 0.5 * dailyGain + 0.5 * weekGain;
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
  inPantry: boolean;
}

const round25 = (x: number) => Math.max(0.25, Math.round(x * 4) / 4);

// Sanity bounds: nothing below ~25 kcal/serving can anchor a meal
// (stops "64x lemon juice" filler), no single food exceeds 4 servings
// in one meal, and — when the serving weight is known — no item
// exceeds ~450g (stops "960g coconut water" portions).
const MIN_CAL_PER_SERVING = 25;
const MAX_SERVINGS = 4;
const MAX_GRAMS_PER_ITEM = 450;

const maxServingsFor = (food: Food): number => {
  const g = food.servingWeightGrams;
  if (g && g > 0) {
    return Math.max(
      0.25,
      Math.min(MAX_SERVINGS, Math.floor((MAX_GRAMS_PER_ITEM / g) * 4) / 4)
    );
  }
  return MAX_SERVINGS;
};

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
  weekPrev: Totals,
  pace: number,
  settings: PlannerSettings,
  recentUse: Map<string, number>,
  planUse: Map<string, number>,
  dayUsed: Set<string>,
  rng: () => number,
  // Composition: pick #i must come from slotCategories[i]; after the
  // list is exhausted, top-up picks may come from any of them. Empty =
  // no composition (free pick).
  slotCategories: string[] = []
): PlannedItem[] => {
  const items: PlannedItem[] = [];
  const usedHere = new Set<string>();
  let remaining = budget;
  const compositional = slotCategories.length > 0;
  const catSet = new Set(slotCategories);
  // Free mode: 2–4 foods by budget. Compositional: one per category
  // (plus up to 2 top-ups if calories remain).
  const targetItems = compositional
    ? slotCategories.length
    : budget < 350
      ? 2
      : budget < 650
        ? 3
        : 4;
  const maxPicks = compositional
    ? Math.min(slotCategories.length + 2, 7)
    : 6;

  for (let pick = 0; pick < maxPicks && remaining > 60; pick++) {
    // The category this pick is bound to (compositional mode only).
    const requiredCat = compositional && pick < slotCategories.length
      ? slotCategories[pick]
      : null;
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

    // Pass 0 excludes foods already planned today; if that produces
    // nothing (tiny pantry / tight restriction), pass 1 permits them.
    for (let pass = 0; pass < 2 && !best; pass++) {
    for (const cand of candidates) {
      if (usedHere.has(cand.food.id)) continue;
      if (cand.shape.cal < MIN_CAL_PER_SERVING) continue;
      // No food twice in one day (hard rule unless nothing else fits).
      if (pass === 0 && dayUsed.has(cand.food.id)) continue;
      if (requiredCat && cand.food.category !== requiredCat) continue;
      // Top-up picks in compositional mode stay within the chosen set.
      if (compositional && !requiredCat && !catSet.has(cand.food.category))
        continue;
      let fit = archetypeFit(cand.shape, slot.archetype);
      // When the user names categories explicitly, the archetype only
      // steers — it must never veto a category they asked for.
      if (compositional) fit = Math.max(fit, 0.3);
      if (fit <= 0) continue;

      const servings = Math.min(
        round25(chunk / cand.shape.cal),
        maxServingsFor(cand.food)
      );
      const cals = servings * cand.shape.cal;
      // Don't blow the budget: allow modest overshoot only.
      if (cals > remaining * 1.25 + 40) continue;

      // Micronutrient value per calorie — the core objective.
      const gain = microGain(dayTotals, weekPrev, pace, cand.food, servings);
      let score = (gain / Math.max(cals, 50)) * 1000;

      // Slot archetype fit.
      score *= fit;

      // Rotation: heavy penalty for yesterday's foods, lighter for the
      // rest of the recent window, firmer within the same plan.
      const recent = recentUse.get(cand.food.id) ?? 0;
      const inPlan = planUse.get(cand.food.id) ?? 0;
      score *= Math.pow(0.55, recent) * Math.pow(0.7, inPlan);

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

      // Recommendations: outside-the-pantry foods carry a handicap.
      if (!cand.inPantry) score *= RECOMMENDATION_HANDICAP;

      // Seeded jitter so equal-ish foods trade places between rerolls.
      score *= 0.85 + rng() * 0.3;

      if (!best || score > best.score) best = { cand, servings, score };
    }
    }

    if (!best) {
      // In compositional mode a missing category shouldn't abort the
      // rest of the meal — move on to the next category.
      if (requiredCat) continue;
      break;
    }
    items.push({
      foodId: best.cand.food.id,
      servings: best.servings,
      ...(best.cand.inPantry ? {} : { recommended: true }),
    });
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
        const itemFood = foodById.get(it.foodId);
        if (dir > 0 && itemFood && it.servings >= maxServingsFor(itemFood))
          continue; // capped
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
  const withRecs = !!settings.includeRecommendations;
  const pool = foods.filter(
    (f) =>
      (pantrySet.has(f.id) || withRecs) && (f.nutrients?.calories ?? 0) > 0
  );

  const candidates: Candidate[] = pool.map((food) => ({
    food,
    shape: macroShape(food),
    inPantry: pantrySet.has(food.id),
  }));

  if (settings.calorieTarget < 800) {
    warnings.push('Set a daily calorie target (at least 800) to generate.');
    return {
      plan: { id: `mp${Date.now()}`, createdAt: Date.now(), seed, days: [] },
      warnings,
    };
  }
  const usable = candidates.filter(
    (cd) => cd.inPantry && cd.shape.cal >= MIN_CAL_PER_SERVING
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

  // Per-slot calorie budgets from explicit % + auto split.
  const slotPcts = effectiveSlotPcts(settings.slots);
  const explicitSum = settings.slots.reduce(
    (a, s) =>
      a +
      (typeof s.caloriePct === 'number' && s.caloriePct > 0
        ? Math.min(100, s.caloriePct)
        : 0),
    0
  );
  if (explicitSum > 100) {
    warnings.push(
      `Meal sizes add up to ${Math.round(explicitSum)}% — scaled down to fit 100%.`
    );
  }
  const slotBudgets = slotPcts.map(
    (p) => (settings.calorieTarget * p) / 100
  );

  // Restricted days (legacy stored settings may lack the field).
  const restrictedDays = settings.restrictedDays ?? [];
  const rulesForWeekday = (weekday: number) =>
    restrictedDays.filter(
      (r) => r.weekdays.includes(weekday) && r.allowedCategories.length > 0
    );
  // Warn up-front about restrictions that leave the pantry too thin.
  for (const rule of restrictedDays) {
    if (rule.weekdays.length === 0 || rule.allowedCategories.length === 0)
      continue;
    const allowed = new Set(rule.allowedCategories);
    const usableCount = candidates.filter(
      (cd) =>
        cd.inPantry &&
        allowed.has(cd.food.category) &&
        cd.shape.cal >= MIN_CAL_PER_SERVING
    ).length;
    if (usableCount < 6) {
      warnings.push(
        `"${rule.name}" leaves only ${usableCount} usable pantry foods — stock more from its allowed categories.`
      );
    }
  }

  const days: PlannedDay[] = [];
  // Rolling usage counts for rotation (last-2-days window + whole plan).
  const planUse = new Map<string, number>();
  // Finalized totals for the running 7-day window (weekly micro pacing).
  let weekPrev: Totals = {};
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
    // New 7-day window → reset the weekly accumulator.
    if (d % 7 === 0) weekPrev = {};
    const pace = (d % 7) + 1;

    const recentUse = new Map<string, number>();
    for (const id of prevDayFoods)
      recentUse.set(id, (recentUse.get(id) ?? 0) + 2);
    for (const id of prevPrevDayFoods)
      recentUse.set(id, (recentUse.get(id) ?? 0) + 1);

    // Apply any dietary restriction matching this weekday. Multiple
    // rules must all be satisfied → intersect their whitelists.
    const rules = rulesForWeekday(getDay(addDays(startDate, d)));
    let allowed: Set<string> | null = null;
    let restrictionName: string | undefined;
    if (rules.length > 0) {
      allowed = new Set(rules[0].allowedCategories);
      for (const rule of rules.slice(1)) {
        const next = new Set(rule.allowedCategories);
        allowed = new Set([...allowed].filter((cat) => next.has(cat)));
      }
      restrictionName = rules.map((r) => r.name).join(' + ');
    }
    const dayCandidates = allowed
      ? candidates.filter((cd) => allowed!.has(cd.food.category))
      : candidates;

    const dayUsed = new Set<string>();
    for (let si = 0; si < settings.slots.length; si++) {
      const slot = settings.slots[si];
      // Slot categories that survive the day's restriction; if none
      // do, the slot falls back to a free pick from the allowed pool.
      const slotCats = allowed
        ? (slot.categories ?? []).filter((cat) => allowed!.has(cat))
        : slot.categories ?? [];
      const items = buildMeal(
        slot,
        slotBudgets[si],
        dayCandidates,
        dayTotals,
        weekPrev,
        pace,
        settings,
        recentUse,
        planUse,
        dayUsed,
        rng,
        slotCats
      );
      meals.push({
        slotId: slot.id,
        slotName: slot.name,
        meal: slot.meal,
        items,
      });
    }

    const day: PlannedDay = { date, meals, restrictionName };
    trueUpCalories(day, foodById, settings.calorieTarget);
    days.push(day);

    const todayFoods = new Set<string>();
    for (const m of meals)
      for (const it of m.items) {
        todayFoods.add(it.foodId);
        planUse.set(it.foodId, (planUse.get(it.foodId) ?? 0) + 1);
        // Finalize into the weekly accumulator using post-true-up
        // amounts, so weekly pacing sees what's actually planned.
        const food = foodById.get(it.foodId);
        if (food) addToTotals(weekPrev, food, it.servings);
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

// Coverage across a multi-day block (a week, or a month's tail):
// average capped % of (RDA × block length). This is the number the
// weekly pacing optimizes toward 100%.
export const periodMicroCoverage = (
  days: PlannedDay[],
  foodById: Map<string, Food>
) => {
  if (days.length === 0) return 0;
  const totals: Totals = {};
  for (const day of days)
    for (const meal of day.meals)
      for (const it of meal.items) {
        const food = foodById.get(it.foodId);
        if (food) addToTotals(totals, food, it.servings);
      }
  let sum = 0;
  for (const { key, rda } of MICRO_RDA)
    sum += Math.min(1, (totals[key] ?? 0) / (rda * days.length));
  return sum / MICRO_RDA.length;
};

// Practical amount label: total grams when the serving weight is
// known ("150g"), otherwise servings × label ("1.5 × 1 cup").
export const fmtPlannedAmount = (food: Food, servings: number) => {
  const g = food.servingWeightGrams;
  if (g && g > 0) {
    const grams = servings * g;
    // Round to the nearest 5g — nobody weighs out 148g.
    return `${Math.max(5, Math.round(grams / 5) * 5)}g`;
  }
  return `${Math.round(servings * 100) / 100} × ${food.servingLabel}`;
};

// Replacement for a plan item the user rejected (starred rec's X flow,
// or any future swap UI). Finds the best alternative with a similar
// calorie contribution, honoring the day's restriction, the slot's
// composition, and the no-repeat-in-a-day rule.
// pantryOnly=true  → "No": swap in something the user owns.
// pantryOnly=false → "Yes": next-optimal overall (handicap applies, so
//                     the result may well be a pantry food — then it
//                     simply isn't starred).
export function suggestReplacement(
  foods: Food[],
  pantryIds: string[],
  settings: PlannerSettings,
  plan: MealPlan,
  date: string,
  slotId: string,
  currentFoodId: string,
  excludeIds: string[],
  pantryOnly: boolean
): PlannedItem | null {
  const day = plan.days.find((dd) => dd.date === date);
  const meal = day?.meals.find((m) => m.slotId === slotId);
  const item = meal?.items.find((it) => it.foodId === currentFoodId);
  const oldFood = foods.find((f) => f.id === currentFoodId);
  if (!day || !meal || !item || !oldFood) return null;

  const slot = settings.slots.find((s) => s.id === slotId);
  const pantrySet = new Set(pantryIds);
  const oldCals = (oldFood.nutrients?.calories ?? 0) * item.servings;

  // Day totals without the item being replaced; other foods today are
  // off-limits.
  const dayTotals: Totals = {};
  const dayUsed = new Set<string>();
  for (const m of day.meals)
    for (const it of m.items) {
      if (m.slotId === slotId && it.foodId === currentFoodId) continue;
      const food = foods.find((f) => f.id === it.foodId);
      if (food) {
        addToTotals(dayTotals, food, it.servings);
        dayUsed.add(it.foodId);
      }
    }

  // Restriction whitelist for this date's weekday.
  const weekday = getDay(new Date(`${date}T12:00:00`));
  const rules = (settings.restrictedDays ?? []).filter(
    (r) => r.weekdays.includes(weekday) && r.allowedCategories.length > 0
  );
  let allowed: Set<string> | null = null;
  if (rules.length > 0) {
    allowed = new Set(rules[0].allowedCategories);
    for (const rule of rules.slice(1)) {
      const next = new Set(rule.allowedCategories);
      allowed = new Set([...allowed].filter((cat) => next.has(cat)));
    }
  }

  // Keep the slot's composition: if the outgoing food filled one of
  // the slot's chosen categories, the replacement must too.
  const slotCats = slot?.categories ?? [];
  const compositional = slotCats.length > 0;
  const requiredCat =
    compositional && slotCats.includes(oldFood.category)
      ? oldFood.category
      : null;

  const excluded = new Set([...excludeIds, currentFoodId]);
  let best: { item: PlannedItem; score: number } | null = null;

  // Pass 0 honors the no-repeat-in-a-day rule; pass 1 relaxes it so a
  // tiny pantry can still answer "No — use my pantry".
  for (let pass = 0; pass < 2 && !best; pass++) {
    for (const food of foods) {
      if (excluded.has(food.id)) continue;
      if (pass === 0 && dayUsed.has(food.id)) continue;
      const inPantry = pantrySet.has(food.id);
      if (pantryOnly && !inPantry) continue;
      if (allowed && !allowed.has(food.category)) continue;
      if (requiredCat && food.category !== requiredCat) continue;
      const shape = macroShape(food);
      if (shape.cal < MIN_CAL_PER_SERVING) continue;
      let fit = slot ? archetypeFit(shape, slot.archetype) : 1;
      if (compositional) fit = Math.max(fit, 0.3);
      if (fit <= 0) continue;

      const servings = Math.min(
        round25(Math.max(oldCals, 60) / shape.cal),
        maxServingsFor(food)
      );
      const cals = servings * shape.cal;
      const gain = microGain(dayTotals, {}, 1, food, servings);
      let score = (gain / Math.max(cals, 50)) * 1000 * fit;
      if (!inPantry) score *= RECOMMENDATION_HANDICAP;

      if (!best || score > best.score) {
        best = {
          item: {
            foodId: food.id,
            servings,
            ...(inPantry ? {} : { recommended: true }),
          },
          score,
        };
      }
    }
  }

  return best?.item ?? null;
}

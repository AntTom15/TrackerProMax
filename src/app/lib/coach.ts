import { format, subDays } from 'date-fns';
import type {
  Exercise,
  Food,
  LogEntry,
  SleepEntry,
  WorkoutSession,
} from './types';

// ---------------------------------------------------------------------------
// AI Coach scaffold.
//
// The app never talks to "Claude" or "Ollama" directly — screens call
// generateSuggestions(settings, ctx) and get back CoachSuggestion[]. Each
// provider is just an adapter that must return that shape, so swapping or
// adding providers (e.g. the future rules engine) never touches the UI.
// ---------------------------------------------------------------------------

export type CoachTint =
  | 'tintBlue'
  | 'tintPurple'
  | 'tintOrange'
  | 'tintLime'
  | 'tintCyan';

export interface CoachSuggestion {
  tag: string; // short category label, e.g. "Progressive overload"
  title: string;
  body: string;
  tint: CoachTint;
}

export type CoachProviderId = 'claude' | 'ollama' | 'rules';

export type CoachGoal = 'muscle' | 'strength' | 'fatloss' | 'health';
export type DietStyle = 'animal' | 'keto' | 'omnivore' | 'plant';

// Small on purpose: rules are universal functions that read these fields
// for thresholds and suppression — presets never fork the rule list.
export interface CoachProfile {
  goal: CoachGoal;
  dietStyle: DietStyle;
  bodyWeightLb: number; // 0 = not set
  weeklyWorkoutTarget: number; // days per week
}

export interface CoachSettings {
  provider: CoachProviderId;
  claudeKey: string;
  claudeModel: string;
  ollamaUrl: string;
  ollamaModel: string;
}

export interface CoachCache {
  suggestions: CoachSuggestion[];
  provider: string;
  generatedAt: number;
}

const TINTS: CoachTint[] = [
  'tintBlue',
  'tintPurple',
  'tintOrange',
  'tintLime',
  'tintCyan',
];

// ---------------------------------------------------------------------------
// Context packet: a compact, pre-digested summary of the user's data.
// Small enough that rate limits barely matter, and dense enough that even
// small local models can reason over it.
// ---------------------------------------------------------------------------

export function buildCoachContext(input: {
  foods: Food[];
  log: LogEntry[];
  sessions: WorkoutSession[];
  exercises: Exercise[];
  sleep: SleepEntry[];
  water: Record<string, number>;
  waterGoalOz: number;
  profile: CoachProfile;
}) {
  const { foods, log, sessions, exercises, sleep, water, waterGoalOz, profile } =
    input;
  const foodById = new Map(foods.map((f) => [f.id, f]));
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');
  const today = new Date();

  const last14 = new Set<string>();
  for (let i = 0; i < 14; i++) last14.add(dayKey(subDays(today, i)));
  const last7 = new Set<string>();
  for (let i = 0; i < 7; i++) last7.add(dayKey(subDays(today, i)));

  // ---- Workouts (last 14 days of finished sessions) ----
  const finished = sessions.filter(
    (s) => s.finishedAt !== null && last14.has(s.date)
  );
  const volumeByMuscle: Record<string, number> = {};
  const lifts: Record<
    string,
    { name: string; bestWeight: number; bestE1RM: number; sets: number }
  > = {};
  const trainingDays = new Set<string>();

  finished.forEach((s) => {
    trainingDays.add(s.date);
    (s.exercises ?? []).forEach((se) => {
      const ex = exById.get(se.exerciseId);
      if (!ex) return;
      const muscle = ex.muscles?.[0] ?? 'Other';
      (se.sets ?? []).forEach((set) => {
        volumeByMuscle[muscle] =
          (volumeByMuscle[muscle] ?? 0) + set.weight * set.reps;
        const rec = (lifts[ex.id] ??= {
          name: ex.name,
          bestWeight: 0,
          bestE1RM: 0,
          sets: 0,
        });
        rec.sets += 1;
        if (set.weight > rec.bestWeight) rec.bestWeight = set.weight;
        const e1rm = set.weight * (1 + set.reps / 30);
        if (e1rm > rec.bestE1RM) rec.bestE1RM = e1rm;
      });
    });
  });

  // Best set of each of the last two sessions containing the lift —
  // enough signal for overload/stall rules without shipping raw logs.
  const sessionsDesc = finished
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  const lastTwoBestSets = (exerciseId: string) => {
    const outSets: { weight: number; reps: number }[] = [];
    for (const s of sessionsDesc) {
      const se = (s.exercises ?? []).find((e) => e.exerciseId === exerciseId);
      const sets = se?.sets ?? [];
      if (sets.length === 0) continue;
      const best = sets.reduce((a, b) =>
        a.weight * (1 + a.reps / 30) >= b.weight * (1 + b.reps / 30) ? a : b
      );
      outSets.push({ weight: best.weight, reps: best.reps });
      if (outSets.length === 2) break;
    }
    return outSets;
  };

  const topLifts = Object.entries(lifts)
    .sort((a, b) => b[1].bestE1RM - a[1].bestE1RM)
    .slice(0, 6)
    .map(([exId, l]) => ({
      name: l.name,
      bestWeight: Math.round(l.bestWeight),
      estOneRepMax: Math.round(l.bestE1RM),
      setsLast14d: l.sets,
      lastTwoBestSets: lastTwoBestSets(exId),
    }));

  const daysSinceLastWorkout = (() => {
    const all = sessions
      .filter((s) => s.finishedAt !== null)
      .map((s) => s.date)
      .sort();
    if (all.length === 0) return null;
    const lastDate = all[all.length - 1];
    const diff = Math.floor(
      (today.getTime() - new Date(`${lastDate}T12:00:00`).getTime()) / 86400000
    );
    return Math.max(0, diff);
  })();

  // ---- Diet (last 7 days) ----
  const perDay: Record<string, { cals: number; protein: number }> = {};
  log.forEach((e) => {
    if (!last7.has(e.date)) return;
    const n = foodById.get(e.foodId)?.nutrients;
    if (!n) return;
    const d = (perDay[e.date] ??= { cals: 0, protein: 0 });
    d.cals += (n.calories ?? 0) * e.servings;
    d.protein += (n.protein ?? 0) * e.servings;
  });
  const dietDays = Object.keys(perDay);
  const avg = (nums: number[]) =>
    nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
  const trainProtein = dietDays.filter((d) => trainingDays.has(d));
  const restProtein = dietDays.filter((d) => !trainingDays.has(d));

  // ---- Water & sleep (last 7 days) ----
  const waterVals = [...last7]
    .map((d) => water[d] ?? 0)
    .filter((v) => v > 0);
  const recentSleep = sleep.filter((e) => last7.has(e.date));

  return {
    generatedFor: dayKey(today),
    profile: {
      goal: profile.goal,
      dietStyle: profile.dietStyle,
      bodyWeightLb: profile.bodyWeightLb > 0 ? profile.bodyWeightLb : null,
      weeklyWorkoutTarget: profile.weeklyWorkoutTarget,
    },
    workouts: {
      finishedLast14d: finished.length,
      daysSinceLastWorkout,
      volumeByMuscleLast14d: Object.fromEntries(
        Object.entries(volumeByMuscle).map(([k, v]) => [k, Math.round(v)])
      ),
      topLifts,
    },
    diet: {
      daysLoggedLast7d: dietDays.length,
      avgCalories: avg(dietDays.map((d) => perDay[d].cals)),
      avgProteinG: avg(dietDays.map((d) => perDay[d].protein)),
      avgProteinTrainingDaysG: avg(trainProtein.map((d) => perDay[d].protein)),
      avgProteinRestDaysG: avg(restProtein.map((d) => perDay[d].protein)),
    },
    water: {
      goalOz: waterGoalOz,
      daysTrackedLast7d: waterVals.length,
      avgOz: avg(waterVals),
    },
    sleep: {
      nightsLoggedLast7d: recentSleep.length,
      avgDurationMin: avg(recentSleep.map((e) => e.durationMin)),
      avgQuality1to5:
        recentSleep.length > 0
          ? Math.round(
              (recentSleep.reduce((a, e) => a + e.quality, 0) /
                recentSleep.length) *
                10
            ) / 10
          : 0,
    },
  };
}

export type CoachContext = ReturnType<typeof buildCoachContext>;

// ---------------------------------------------------------------------------
// Prompt + response parsing (shared by all LLM providers)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are the AI coach inside a personal fitness tracker. You receive a JSON summary of the user's recent workouts, diet, water, and sleep.

Reply with ONLY a JSON array of 3 to 5 suggestion objects, no prose, no markdown fences:
[{"tag": "...", "title": "...", "body": "...", "tint": "..."}]

Rules:
- tag: 1-3 word category (e.g. "Progressive overload", "Recovery", "Nutrition").
- title: short and punchy, under 40 characters.
- body: 1-2 sentences, under 220 characters, specific — reference the user's actual numbers from the data.
- tint: exactly one of tintBlue, tintPurple, tintOrange, tintLime, tintCyan (vary them).
- If a data area is empty (e.g. no sleep logs), at most one suggestion may encourage logging it; focus on areas with data.
- Tailor advice to profile.goal and profile.dietStyle. Never suggest foods that conflict with the diet style, and don't flag intentionally low carbs or fiber on keto or animal-based diets.
- Be concrete and actionable, never generic filler.`;

function extractSuggestions(text: string): CoachSuggestion[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) {
    throw new Error('Model reply contained no JSON array');
  }
  const arr = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error('Model returned an empty suggestion list');
  }
  return arr.slice(0, 5).map((s: any, i: number) => ({
    tag: String(s?.tag ?? 'Coach'),
    title: String(s?.title ?? 'Suggestion'),
    body: String(s?.body ?? ''),
    tint: TINTS.includes(s?.tint) ? s.tint : TINTS[i % TINTS.length],
  }));
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

// Single LLM call path shared by suggestions, chat, and briefing merges.
// Claude uses the Anthropic API; everything else goes through the
// OpenAI-compatible endpoint (Ollama, LM Studio, OpenRouter, Groq…).
async function llmComplete(
  settings: CoachSettings,
  system: string,
  msgs: { role: 'user' | 'assistant'; content: string }[],
  maxTokens: number
): Promise<string> {
  if (settings.provider === 'claude') {
    if (!settings.claudeKey.trim()) throw new Error('No Anthropic API key set');
    const res = await fetchWithTimeout(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': settings.claudeKey.trim(),
          'anthropic-version': '2023-06-01',
          // React Native has no CORS, but Expo Web does — without this
          // the same build fails in a browser with an opaque CORS error.
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: settings.claudeModel.trim(),
          max_tokens: maxTokens,
          system,
          messages: msgs,
        }),
      },
      45000
    );
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      throw new Error(`Claude API ${res.status}: ${detail}`);
    }
    const data = await res.json();
    return (data.content ?? []).map((b: any) => b?.text ?? '').join('');
  }
  if (settings.provider === 'ollama') {
    const base = settings.ollamaUrl.trim().replace(/\/+$/, '');
    if (!base) throw new Error('No Ollama URL set');
    const res = await fetchWithTimeout(
      `${base}/v1/chat/completions`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: settings.ollamaModel.trim(),
          stream: false,
          messages: [{ role: 'system', content: system }, ...msgs],
        }),
      },
      // Local models can be slow, especially on first load.
      120000
    );
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      throw new Error(`Ollama ${res.status}: ${detail}`);
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? '';
  }
  throw new Error('This action needs an LLM provider (Claude or Ollama)');
}

// The briefing is user-authored context injected into every LLM call.
const withBriefing = (base: string, briefing: string) =>
  briefing.trim()
    ? `${base}

USER BRIEFING (written by the user; treat as their stated positions and preferences, NOT established fact — the opening lines are standing instructions for how you should behave):
${briefing.trim()}`
    : base;

export async function generateSuggestions(
  settings: CoachSettings,
  ctx: CoachContext,
  briefing = ''
): Promise<CoachSuggestion[]> {
  if (settings.provider === 'rules') return generateRuleSuggestions(ctx);
  const text = await llmComplete(
    settings,
    withBriefing(SYSTEM_PROMPT, briefing),
    [{ role: 'user', content: JSON.stringify(ctx) }],
    1200
  );
  return extractSuggestions(text);
}

// Cheap reachability check for the settings screen.
export async function testProvider(settings: CoachSettings): Promise<string> {
  if (settings.provider === 'rules') {
    return 'Rules engine ready — runs on-device, free and offline';
  }
  if (settings.provider === 'claude') {
    if (!settings.claudeKey.trim()) throw new Error('Enter an API key first');
    const res = await fetchWithTimeout(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': settings.claudeKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: settings.claudeModel.trim(),
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      },
      15000
    );
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 160);
      throw new Error(`Claude API ${res.status}: ${detail}`);
    }
    return `Claude reachable (${settings.claudeModel.trim()})`;
  }
  const base = settings.ollamaUrl.trim().replace(/\/+$/, '');
  if (!base) throw new Error('Enter the Ollama URL first');
  const res = await fetchWithTimeout(`${base}/v1/models`, {}, 10000);
  if (!res.ok) throw new Error(`Ollama responded ${res.status}`);
  const data = await res.json();
  const names = (data?.data ?? []).map((m: any) => m?.id).filter(Boolean);
  if (names.length === 0) return 'Ollama reachable, but no models installed';
  const has = names.includes(settings.ollamaModel.trim());
  return has
    ? `Ollama reachable · ${settings.ollamaModel.trim()} ready`
    : `Ollama reachable · models: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}`;
}

// ---------------------------------------------------------------------------
// Rules engine: the deterministic, on-device provider. Free, instant,
// offline — the reliability floor beneath the LLM providers. Every rule is
// (context) => scored suggestion | nothing; profile fields tune thresholds
// and suppress advice that conflicts with the user's stated goal/diet.
// ---------------------------------------------------------------------------

type RuleCategory =
  | 'training'
  | 'nutrition'
  | 'recovery'
  | 'hydration'
  | 'consistency';

const CATEGORY_TINT: Record<RuleCategory, CoachTint> = {
  training: 'tintBlue',
  nutrition: 'tintOrange',
  recovery: 'tintPurple',
  hydration: 'tintCyan',
  consistency: 'tintLime',
};

const PROTEIN_FOODS: Record<DietStyle, string> = {
  animal: 'More ribeye, eggs, or liver closes it without changing your diet.',
  keto: 'Fattier protein like chuck or salmon closes it while staying keto.',
  omnivore: 'An extra protein-forward meal or a shake closes the gap.',
  plant: 'Lentils, tofu, or a plant protein shake closes the gap.',
};

export function generateRuleSuggestions(ctx: CoachContext): CoachSuggestion[] {
  const out: (CoachSuggestion & { score: number; category: RuleCategory })[] =
    [];
  const p = ctx.profile;
  const w = ctx.workouts;
  const d = ctx.diet;
  const s = ctx.sleep;
  const h2o = ctx.water;

  const push = (
    category: RuleCategory,
    score: number,
    tag: string,
    title: string,
    body: string
  ) =>
    out.push({ category, score, tag, title, body, tint: CATEGORY_TINT[category] });

  // ---------------- Training ----------------
  const target = Math.max(1, p.weeklyWorkoutTarget);
  const perWeek = w.finishedLast14d / 2;
  const expectedGapDays = Math.ceil(7 / target) + 1;

  if (
    w.daysSinceLastWorkout !== null &&
    w.daysSinceLastWorkout >= expectedGapDays
  ) {
    push(
      'training',
      90,
      'Consistency',
      'Time to train',
      `It's been ${w.daysSinceLastWorkout} days since your last workout — at ${target}×/week you'd normally rest ${expectedGapDays - 1} days at most.`
    );
  } else if (w.finishedLast14d > 0 && perWeek < target - 0.5) {
    push(
      'training',
      60,
      'Frequency',
      'Below your weekly target',
      `You averaged ${perWeek.toFixed(1)} workouts/week over two weeks vs your ${target}/week target. One extra session this week closes the gap.`
    );
  }

  const vol: Record<string, number> = w.volumeByMuscleLast14d;
  const sumVol = (keys: string[]) =>
    keys.reduce((a, k) => a + (vol[k] ?? 0), 0);
  const pushVol = sumVol(['Chest', 'Shoulders', 'Triceps']);
  const pullVol = sumVol(['Back', 'Biceps', 'Forearms']);
  const legVol = sumVol(['Quads', 'Hamstrings', 'Glutes', 'Calves']);
  const totalVol = Object.values(vol).reduce((a, b) => a + b, 0);

  if (pushVol > 0 && pullVol > 0) {
    if (pushVol / pullVol > 1.6) {
      push(
        'training',
        70,
        'Balance',
        'Pull volume is lagging',
        `Push:pull volume is ${(pushVol / pullVol).toFixed(1)}:1 over two weeks. Adding a row or pull-down variation protects your shoulders long-term.`
      );
    } else if (pullVol / pushVol > 1.6) {
      push(
        'training',
        55,
        'Balance',
        'Push volume is lagging',
        `Pull:push volume is ${(pullVol / pushVol).toFixed(1)}:1 over two weeks. A press variation would even out your upper body.`
      );
    }
  }
  if (totalVol > 0 && w.finishedLast14d >= 3 && legVol / totalVol < 0.2) {
    push(
      'training',
      65,
      'Balance',
      "Don't skip legs",
      `Legs are only ${Math.round((legVol / totalVol) * 100)}% of your two-week volume. ${
        p.goal === 'strength'
          ? 'Squat and hinge patterns drive the biggest strength carryover.'
          : 'One dedicated lower day trains the biggest muscles you have.'
      }`
    );
  }

  // Progressive overload: top set hit the rep ceiling two sessions running.
  const repTop = p.goal === 'strength' ? 6 : 12;
  const incLabel = p.goal === 'strength' ? '~5%' : '~2.5%';
  for (const lift of w.topLifts) {
    const sets = lift.lastTwoBestSets ?? [];
    if (
      sets.length === 2 &&
      sets.every((st) => st.reps >= repTop && st.weight > 0)
    ) {
      push(
        'training',
        80,
        'Progressive overload',
        `Bump your ${lift.name}`,
        `Your top set hit ${sets[0].reps} reps at ${sets[0].weight} two sessions running — add ${incLabel} next time and build back up.`
      );
      break; // one overload nudge is enough per batch
    }
  }

  // ---------------- Nutrition ----------------
  const wt = p.bodyWeightLb;
  const proteinPerLb =
    p.goal === 'fatloss' ? 1.0 : p.goal === 'health' ? 0.6 : 0.8;

  if (d.daysLoggedLast7d >= 3 && wt > 0) {
    const targetP = Math.round(wt * proteinPerLb);
    if (d.avgProteinG < targetP * 0.9) {
      push(
        'nutrition',
        85,
        'Protein',
        'Protein below target',
        `Averaging ${d.avgProteinG}g/day vs ~${targetP}g for your goal (${proteinPerLb}g/lb at ${wt} lb). ${PROTEIN_FOODS[p.dietStyle]}`
      );
    }
    const maintenance = Math.round(wt * 14.5);
    if (p.goal === 'fatloss' && d.avgCalories > maintenance) {
      push(
        'nutrition',
        75,
        'Calories',
        'Eating at or above maintenance',
        `~${d.avgCalories} kcal/day vs rough maintenance of ~${maintenance}. A 300-500 kcal deficit keeps fat loss steady without wrecking training.`
      );
    } else if (
      p.goal === 'muscle' &&
      d.avgCalories > 0 &&
      d.avgCalories < maintenance - 100
    ) {
      push(
        'nutrition',
        70,
        'Calories',
        'Fuel the building phase',
        `~${d.avgCalories} kcal/day is under rough maintenance (~${maintenance}). Muscle gain wants a small surplus — add 250-400 kcal on training days first.`
      );
    }
  }

  if (
    d.avgProteinTrainingDaysG > 0 &&
    d.avgProteinRestDaysG > d.avgProteinTrainingDaysG * 1.15
  ) {
    push(
      'nutrition',
      60,
      'Timing',
      'Flip your protein days',
      `${d.avgProteinRestDaysG}g protein on rest days vs ${d.avgProteinTrainingDaysG}g on training days — recovery wants it the other way round.`
    );
  }

  // ---------------- Recovery ----------------
  if (s.nightsLoggedLast7d >= 3) {
    if (s.avgDurationMin < 420) {
      const trainingHard = w.finishedLast14d >= 6;
      push(
        'recovery',
        trainingHard ? 88 : 68,
        'Recovery',
        'Sleep is undercutting you',
        `Averaging ${Math.floor(s.avgDurationMin / 60)}h ${s.avgDurationMin % 60}m across ${s.nightsLoggedLast7d} nights${trainingHard ? ' while training hard' : ''}. Strength and recovery both peak at 7-9h — try one earlier night this week.`
      );
    } else if (s.avgQuality1to5 > 0 && s.avgQuality1to5 <= 2.5) {
      push(
        'recovery',
        62,
        'Recovery',
        'Sleep quality is low',
        `Duration looks fine but quality averages ${s.avgQuality1to5}/5. A consistent wind-down and a darker, cooler room usually move this fastest.`
      );
    }
  } else if (w.finishedLast14d > 0 && s.nightsLoggedLast7d === 0) {
    push(
      'consistency',
      40,
      'Logging',
      'Log your sleep',
      'No nights logged this week — the Rest tab takes ten seconds and unlocks recovery analysis.'
    );
  }

  // ---------------- Hydration ----------------
  if (h2o.daysTrackedLast7d >= 3 && h2o.avgOz < h2o.goalOz * 0.75) {
    push(
      'hydration',
      58,
      'Hydration',
      'Water is trailing your goal',
      `Averaging ${h2o.avgOz} oz vs your ${h2o.goalOz} oz goal on tracked days. Front-load a couple of cups before noon.`
    );
  }

  // ---------------- Consistency ----------------
  if (d.daysLoggedLast7d > 0 && d.daysLoggedLast7d <= 3) {
    push(
      'consistency',
      45,
      'Logging',
      'More food logs, better advice',
      `Only ${d.daysLoggedLast7d}/7 days had meals logged — averages get noisy below four. Even rough logs beat none.`
    );
  }
  if (wt <= 0) {
    push(
      'consistency',
      35,
      'Setup',
      'Set your body weight',
      'Add body weight in Profile to unlock real g/lb protein targets and calorie estimates in coaching.'
    );
  }

  if (out.length === 0) {
    push(
      'consistency',
      10,
      'Getting started',
      'Feed the coach',
      'Finish a workout, log a few meals and a night of sleep — rules light up as soon as there is data to analyze.'
    );
  }

  // Rank: top 5 by score, capped at 2 per category so one area can't
  // dominate the whole batch.
  const picked: typeof out = [];
  const counts: Partial<Record<RuleCategory, number>> = {};
  for (const sug of out.sort((a, b) => b.score - a.score)) {
    if (picked.length === 5) break;
    if ((counts[sug.category] ?? 0) >= 2) continue;
    counts[sug.category] = (counts[sug.category] ?? 0) + 1;
    picked.push(sug);
  }
  return picked.map(({ score, category, ...rest }) => rest);
}

// ---------------------------------------------------------------------------
// Coach chat + briefing maintenance
// ---------------------------------------------------------------------------

export interface CoachChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

const CHAT_SYSTEM = `You are the user's AI fitness coach inside their personal tracker app. You have their briefing (their stated philosophy and standing instructions) and a JSON snapshot of their recent training, diet, water, and sleep data.

How to behave:
- Be conversational and specific — cite their actual numbers when relevant.
- Clearly distinguish well-established evidence from speculative or emerging ideas whenever the topic touches either.
- Disagree plainly when their data or the evidence cuts against what they're saying. Never validate just to be agreeable.
- Respect their stated philosophy as their choice while staying objective about trade-offs.
- Keep replies under ~250 words unless they ask for depth.`;

export async function chatWithCoach(
  settings: CoachSettings,
  ctx: CoachContext,
  briefing: string,
  messages: CoachChatMessage[]
): Promise<string> {
  const system = `${withBriefing(CHAT_SYSTEM, briefing)}

CURRENT DATA SNAPSHOT:
${JSON.stringify(ctx)}`;
  const msgs = messages
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }));
  const reply = await llmComplete(settings, system, msgs, 1000);
  return reply.trim();
}

const MERGE_SYSTEM = `You maintain the user's coach briefing: a compact, user-approved document their AI fitness coach reads before every reply. Given the current briefing and a recent conversation, output the revised briefing text and NOTHING else — no commentary, no markdown fences.

Rules:
- Keep standing instructions (how the coach should behave) as the first lines.
- Short declarative lines, one idea per line. No section headers.
- Fold in genuinely durable takeaways from the conversation: agreed principles, decisions, preferences, experiments started or ended.
- Merge duplicates; drop anything the conversation superseded. Do not record speculation or one-off small talk.
- Tag new agreements with a short date like (7/26/26).
- Stay under 2000 characters. Preserve existing lines that are still true.`;

export async function proposeBriefingUpdate(
  settings: CoachSettings,
  briefing: string,
  messages: CoachChatMessage[]
): Promise<string> {
  const convo = messages
    .slice(-30)
    .map((m) => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`)
    .join('\n');
  const raw = await llmComplete(settings, MERGE_SYSTEM, [
    {
      role: 'user',
      content: `CURRENT BRIEFING:\n${briefing.trim() || '(empty)'}\n\nRECENT CONVERSATION:\n${convo}`,
    },
  ], 1500);
  // Strip accidental code fences and keep it inside the hard cap.
  return raw
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/```\s*$/, '')
    .trim()
    .slice(0, 4000);
}

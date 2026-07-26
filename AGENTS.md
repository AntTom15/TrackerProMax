# TrackerProMax — Agent Handoff & Project Guide

> Last updated 2026-07-26 after a long build session. This file is the source
> of truth for any agent picking up this project. Read it fully before coding.

## Expo has changed
Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/
before writing any code. Expo SDK 54 / RN 0.81 / React 19 / TypeScript.
User runs the app in **Expo Go** via QR code; `npx tsc --noEmit` is run by the
user locally. After changes to seed data or new files: `npx expo start -c`.

## What this app is
An all-in-one personal fitness tracker (user: "Heisenburg", trains + eats a
modified **animal-based diet** chosen for micronutrient density). Bottom tabs:
**Overview · Exercise · Diet · Profile**. Neo-brutalist design system, full
light/dark theming. All data is local (AsyncStorage) — local-first on purpose;
accounts/backend deliberately deferred until sync or community features require it.

## Architecture map
- `App.js` — `useAppStore()` owns ALL persisted state + handlers; passed as
  `store` into tab stacks. Screens live in `src/app/components/*.tsx`.
- `src/app/lib/`
  - `types.ts` — Food (42 NutrientKey fields), LogEntry (has `loggedAt`),
    WorkoutPlan{days[]}, PlanExercise{targetSets,targetReps,restSeconds?},
    WorkoutSession{name,date,planId,dayId,exercises,startedAt,finishedAt|null},
    SetEntry{weight,reps,done?}, SleepEntry{date=wake date,bedTime,wakeTime,
    durationMin,quality 1-5}, MyVotes, PantryOrder.
  - `storage.ts` — `usePersistedState(key, initial)` → [value,set,hydrated];
    STORAGE_KEYS (versioned: foods_v2, plans_v2; plus water/waterGoalOz/
    waterCupOz, sleep, coachProvider/coachClaudeKey/coachClaudeModel/
    coachOllamaUrl/coachOllamaModel/coachCache/coachProfile/coachBriefing/
    coachChat, restSeconds, darkMode, activePlan).
  - `theme.ts` — semantic tokens (LIGHT/DARK), `useThemedStyles(createStyles)`.
    DARK.shadow = '#f2f2f2' so hard shadows read as thick borders in dark mode.
    Six OPAQUE tint tokens (tintOrange/Blue/Cyan/Purple/Lime/LimeFaint) —
    never use rgba fills under hard shadows (iOS ghosting bug).
  - `seedData.ts` + `seedData2.ts` — ~145 foods, ALL 42 nutrients each,
    grass-fed/pasture-raised labels. Omega ratios were audited: grass-fed
    ruminants ~2-2.5:1 n6:n3, grass-fed dairy ~1.5:1, poultry legitimately
    high-n6. App.js has a self-heal effect (nutrient-count comparison) that
    refreshes seed entries without touching user foods.
  - `exerciseSeed.ts` — 87 exercises; MUSCLE_GROUPS: Chest, Back, Shoulders,
    Biceps, Triceps, Forearms, Quads, Hamstrings, Glutes, Calves, Core, Full Body.
  - `nutrients.ts` — NUTRIENT_SECTIONS with labels/units/RDAs.
  - `coach.ts` — the whole AI Coach core (see below).

## Design system (neo-brutalist)
2px ink borders (`c.text`), hard offset shadows (shadowColor `c.shadow`,
offset {3,3}, opacity 1, radius 0, elevation 3), lime `c.accent` CTAs with
`c.onAccent` text, uppercase 'Barlow Condensed' headings, 'DM Sans' body,
dashed borders = flat (no shadow). Chevron convention: **up = expanded,
down = collapsed**. Icons.tsx wrappers only forward size/color — the `style`
prop is silently dropped (no transforms; use dedicated icon variants).

## Feature inventory (all working)
- **Diet tab**: Pantry (collapsible categories, drag reorder, tap→FoodDetail),
  FoodAdder (category chips, voting), FoodDetail (full 42-nutrient profile),
  Logger (per-day; collapsible Water/Breakfast/Lunch/Dinner/Snacks sections;
  tap a logged food → FoodDetail; totals → NutritionSummary with RDAs),
  Water tracker (Cronometer-style cups = goal÷cupSize, partial bottom-up fill,
  custom-oz add, overflow cups past goal; goal & cup size in Profile).
- **Exercise tab** (2×2 tiles): Plan Maker (multi-day plans ≤10 days, explicit
  Save FAB only, per-exercise rest override chip), Tracker (live elapsed timer,
  ghost placeholders from last session, green ✓ = set logged — row turns
  tintLime "Logged", ONLY ✓ sets are saved on Finish, Cancel workout button at
  bottom with confirm, rest timer bar with per-exercise override, Current Plan
  dropdown start flow, calendar + tappable history → SessionDetail, exercise
  name → ExerciseHistory with est. 1RM (Epley w×(1+r/30)) hero + Best Weight),
  AI Coach (see below), Rest (sleep cycle calculator: 90-min cycles + 15-min
  fall-asleep, "wake at"/"sleep now" modes; quick sleep logger: bed/wake
  steppers, 5-moon quality, one entry per wake date, weekly avg + history).
- **Overview tab**: ALL REAL DATA — time-based greeting, streak (meal logged
  or workout finished; empty today doesn't break chain; flame lights orange
  once today has an entry), stat cards (calories+protein today, Steps = "—
  Connect Apple Health" placeholder, water vs goal, last sleep), Recent
  Activity (4 latest real events: workouts/foods/sleep).
- **Profile tab**: real stats, dark mode, rest timer default, water goal +
  cup size, **Coach Profile** (goal: muscle/strength/fatloss/health; diet:
  animal/keto/omnivore/plant; body weight lb stepper (0=unset); workouts/week).

## AI Coach system (the crown jewel — read carefully)
Provider-agnostic: UI only calls `generateSuggestions(settings, ctx, briefing)`
→ `CoachSuggestion[] {tag,title,body,tint}`. Providers:
1. **Claude** — Anthropic Messages API direct from device, key in AsyncStorage
   (fine for personal use; MUST move behind a server if ever shipped).
   Default model 'claude-haiku-4-5-20251001'.
2. **Ollama** — OpenAI-compatible `/v1/chat/completions` (also works for
   LM Studio etc.). Phone must use the PC's LAN IP, not localhost; PC needs
   `OLLAMA_HOST=0.0.0.0`. 120s timeout (local models are slow).
3. **Rules engine** — deterministic on-device fallback/floor. ~15 universal
   rules parameterized by Coach Profile (never per-preset rule forks!):
   training (overdue vs weekly target, frequency, push:pull >1.6 imbalance,
   legs <20% volume, overload trigger when top set ≥ rep ceiling [6 strength /
   12 else] two sessions running), nutrition (protein g/lb by goal [1.0 cut /
   0.8 build / 0.6 health], calories vs ~14.5×lb maintenance, rest-vs-training
   day protein flip; diet suppression BY OMISSION — no fiber/carb rules exist),
   recovery (sleep <7h, scored higher when training hard; quality ≤2.5),
   hydration (<75% of goal), consistency (sparse logging, unset body weight).
   Scoring: top 5, max 2 per category. Category→tint mapping fixed.
- **Context packet** `buildCoachContext(...)`: last-14d workouts (volume by
  muscle, top 6 lifts w/ e1RM + lastTwoBestSets), last-7d diet averages split
  training/rest days, water adherence, sleep averages, profile. Same packet
  for all providers.
- **Briefing** (`coachBriefing`): user-authored freeform doc injected into
  EVERY LLM call, framed as "user's stated positions, NOT established fact;
  first lines are standing instructions". Soft cap 2000 chars (counter turns
  orange), hard cap 4000. No sections by design — short declarative lines.
- **Chat** (`CoachChatPage`, thread persisted in `coachChat`): rolling last 20
  messages + briefing + packet. System prompt enforces anti-sycophancy:
  distinguish evidence from speculation, disagree plainly, never flatter.
  Rules provider can't chat (honest banner).
- **Save takeaways** = propose-and-approve MERGE (not append): model drafts a
  full revised briefing (fold new agreements w/ date tags like (7/26/26),
  merge dupes, drop superseded, ≤2000 chars) → user edits/approves/discards.
  NOTHING enters the briefing without user approval (explicit user requirement
  — they fear AI "leading them on believing fantasies").
- Suggestions cached in `coachCache` with provider + timestamp; regenerate is
  manual (Refresh) to conserve API credits.

## Roadmap / next steps (user-agreed order)
1. **Apple Health steps** — requires EAS dev build + react-native-health
   (NOT possible in Expo Go). User understands hot reload still works with a
   dev build. Steps card on Overview is the waiting placeholder.
2. Rules engine deepening (micronutrient flags from the 42-nutrient data was
   explicitly deferred as "later"; stall detection needs richer trend data).
3. Meal Presets screen (BlankPage placeholder exists in DietStack).
4. Diet Recommendations screen (BlankPage placeholder).
5. Fonts: 'Barlow Condensed'/'DM Sans' are referenced but never loaded via
   expo-font — falls back to system fonts. Load them eventually.
6. Accounts/sync — LAST, only when multi-device or community voting goes real.

## Working conventions for agents
- User likes: status updates while you work, being consulted on UX decisions
  ("where do u think X should go?"), concise answers, honest pushback with
  real numbers/evidence, discussing vision BEFORE committing to code.
- Verify edits parse before finishing (babel parser or tsc). One entry per
  concern; keep diffs surgical.
- The folder previously lived in OneDrive, which twice ROLLED BACK App.js and
  other files mid-session (sync conflicts silently restoring old versions).
  The user is moving the folder now partly because of this. If anything looks
  mysteriously reverted, suspect sync tooling first. **Recommend git init on
  first session in the new location.**
- Storage migrations: bump key versions + add self-heal effects in App.js
  (see foods self-heal and legacy plan→days migration for the pattern).
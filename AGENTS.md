# TrackerProMax — Agent Handoff & Project Guide

> Last updated 2026-07-26 (second session: git init, freeform log amounts,
> Pedometer steps, Meal Planner v1). This file is the source of truth for any
> agent picking up this project. Read it fully before coding.

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
  - `steps.ts` — `useSteps(onSnapshot)`: Pedometer (expo-sensors) daily step
    totals; OS remembers ~7 days so totals snapshot into `steps` storage.
    iOS-only queries (Android → card shows unavailable). No Watch data.
  - `mealPlanner.ts` — deterministic meal-plan generator (see Meal Planner).

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
  tap a logged food → FoodDetail; totals → NutritionSummary with RDAs;
  FREEFORM AMOUNTS: picker rows expand to an amount editor [servings/g/oz —
  weight units only when servingWeightGrams known], + icon = quick 1 serving;
  in the Logger tap the servings number to type an exact value, ±0.5 steppers
  stay, 0 removes),
  **Meal Planner** (MealPresets route, was BlankPage — see section below),
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
  once today has an entry), stat cards (calories+protein today, Steps = REAL
  via expo-sensors Pedometer [phone motion chip, works in Expo Go; chosen over
  HealthKit which needs an EAS dev build + $99/yr Apple Developer on Windows],
  water vs goal, last sleep), Recent Activity (4 latest real events).
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

## Meal Planner (v1 shipped this session — user's redefined vision)
NOT "save & reuse presets". It plans the user's eating FOR them: pantry +
user-defined day template → concrete meals with real amounts, day/week/month
ahead, with natural diversity ("user never has to think about what to eat").
Example driving the design: trains mornings, Randle-cycle-conscious →
carb+lean breakfast, fatty dinner.
- `lib/mealPlanner.ts` — pure/deterministic (seeded; regenerate = new seed):
  priorities (1) calories ±3% [user: tight] (2) slot archetypes
  ('carb-lean'|'fatty'|'high-protein'|'balanced') (3) maximize micronutrients
  — foods picked by marginal %RDA-per-kcal, capped at 100% (diminishing
  returns = in-day variety; sodium/chloride/fiber excluded — steering by
  omission, same philosophy as coach rules) (4) cross-day rotation penalties
  (5) optional P/C/F % targets, soft ±7pp [user: wide margin ok].
  Guards: ≥25 kcal/serving to be a component, ≤4 servings/item, no repeat
  food within a day, quarter-serving amounts, calorie true-up pass.
  Tested vs seed data: 7 days all ±1.2%, 97-100% micro coverage, 56 unique
  foods, archetype shapes correct.
- `MealPlannerPage.tsx` (MealPresets route; Diet tile renamed "Meal Planner"):
  Day Template card (calorie target REQUIRED [not asked elsewhere], optional
  macro %, slots: name + meal-cycle chip + archetype chips, ≤6 slots),
  Day/Week(7)/Month(28) horizon, Generate/Regenerate, per-day collapsible
  cards, "Log to <meal>" writes real-servings LogEntries to that plan date.
- **v2 additions** (same session, user-requested):
  - Per-slot **meal size %** (`caloriePct`, blank = auto-split of unclaimed
    %; explicit >100% → normalized + warning) — pre-workout snack use case.
  - Per-slot **category composition** (`categories[]`): one food from EACH
    chosen category, leftover calories top up from the same set; archetype
    only steers (floored at 0.3, never vetoes a user-chosen category);
    missing category → skipped, meal continues.
  - **Restricted days** (`restrictedDays[]`: name + weekdays 0-6 + allowed
    category whitelist) — e.g. Orthodox fast Wed/Fri = plants + Shellfish.
    Multiple rules on one weekday intersect. Slot categories filtered per
    day (all filtered out → free pick from allowed pool). Day header shows
    a restriction badge (PlannedDay.restrictionName). Thin-pool warning.
  - Same-day food repeats are now a HARD exclusion (fallback pass only if
    nothing else fits); plan-wide rotation penalty 0.7^uses.
  - `components2/CategoryPickerModal.tsx`: full-screen multi-select over
    CATEGORY_ORDER with "+ Plants" / "+ Animal" / Clear quick-sets
    (ANIMAL_/PLANT_CATEGORIES in constants.ts; quick-sets UNION with
    current selection). Used by both slots and restriction rules.
  - Legacy stored settings lack the new fields — all read sites use
    `?? []` / `?? null`; no storage-key bump needed.
- **v3 additions** (same session):
  - **'Dairy & Eggs' SPLIT into 'Dairy' + 'Eggs'** (user: separate roles,
    e.g. eggs+milk breakfast). Seed foods reclassified (16 Dairy / 4 Eggs);
    CATEGORY_ORDER now ALPHABETICAL (user request); App.js self-heals:
    seed refresh also triggers on category mismatch, user foods on the old
    category migrate by egg-in-name heuristic, planner settings lists split
    the old value into both (helpers LEGACY_DAIRY_EGGS/splitDairyEggs).
  - **Weekly micro pacing**: microGain = 0.5·daily-capped + 0.5·week-pace
    gain (target rda×pace over rolling 7-day window, reset each week) →
    week/month plans chase the week's laggard nutrients toward TRUE 100%
    weekly (periodMicroCoverage helper; UI shows per-week divider bars).
  - **Amount display in grams**: fmtPlannedAmount → "150g" (nearest 5g)
    when servingWeightGrams known, else "1.5 × label". New cap
    MAX_GRAMS_PER_ITEM=450 (stops 960g-coconut-water portions).
  - **Recommendations**: settings.includeRecommendations (Sparkles toggle
    above Generate). Non-pantry foods join the pool at 0.75 handicap;
    winners get item.recommended=true (★ + X in plan rows). X → Alert
    "another recommendation?" — No = pantry swap, Yes = next-optimal
    (suggestReplacement(); rejected chain excluded via component state;
    honors restriction/composition/no-repeat, 2-pass relax for tiny pantries).
  - **MealPlanDetailPage** ('PlanMealDetail' route): tap any meal card
    header → detail: macro hero, editable amounts (grams inline), remove /
    add foods (pantry-first search), full NUTRIENT_SECTIONS RDA bars, tap
    food name → FoodDetail. Edits write back into the persisted mealPlan.
  - **FoodAdder**: sort button (List icon, top right): Most liked / A–Z;
    typing in search now SUPERSEDES the category chip (chips dim at 40%
    while searching).
  - **Bugfix**: RestPage crashed on render — it imported `Sun` from
    Icons.tsx which was never exported. Added Sun (wb-sunny). When
    "Element type is invalid" appears, check Icons exports first.
  - **Overview deep links**: stat cards + Recent Activity rows are now
    Pressable. Calories/Water → DietTab/Logger (today), Sleep → ExerciseTab/
    Rest, Steps → ExerciseTab/WorkoutTracker (imperfect — steps come from the
    motion chip, not workouts; a steps-history screen would be the real
    target). Activity rows: workout → SessionDetail{sessionId}, food →
    Logger{date of that entry}, sleep → Rest. Overview sits directly in the
    TAB navigator, so it uses nested navigation:
    `navigate(tab, { screen, params })` via the local `goTo()` helper, which
    stamps a `nonce` so params re-apply when the target is already mounted.
    LoggerPage now reads `route.params.date` (+nonce) into its date state.
  - **Total Vitamin K**: NUTRIENT_SECTIONS entries may now be DERIVED —
    `derive(n)` + `sources[]` + key of type DerivedNutrientKey. Read every
    row through `nutrientAmount(info, nutrients)` (never `n[info.key]`).
    'vitaminKTotal' = K2 + K1×K1_TO_K2_CONVERSION (0.1, deliberately
    conservative; real conversion is uncertain ~5-25%). rda 120 is the K1
    Daily Value used as a reference line only — there is no official K2 RDA
    (caveat is spelled out in NutritionSummaryPage's footnote).
    **CRITICAL**: mealPlanner's MICRO_RDA skips `item.derive` entries —
    foods never carry a derived key, so scoring one would add a permanently
    zero term and cap weekly coverage below 100%. Verified: coverage stayed
    at 97.2% after the change. The planner still does NOT optimize K2
    (no DV) — a possible future refinement.
  - **AI Coach**: Claude path verified correct (endpoint, x-api-key,
    anthropic-version 2023-06-01, content-block join, AbortController
    timeout). Added `anthropic-dangerous-direct-browser-access: true` (no-op
    on native, prevents CORS failure under Expo Web) and model quick-pick
    chips (Haiku 4.5 / Sonnet 5 / Opus 5; field stays free-text). Default
    `claude-haiku-4-5-20251001` re-verified as current (July 2026).
  - **Week summary** (`MealPlanWeekSummaryPage`, 'PlanWeekSummary' route):
    tap a week divider bar → weekly totals (kcal + per-day avg, macro
    cards w/ per-day), full NUTRIENT_SECTIONS bars vs RDA × block-days,
    weekly micro coverage hero. No per-food list by design.
- Persisted: `plannerSettings`, `mealPlan` keys. AI layer: NOT built yet —
  planned as optional refine layer reusing coach providers ("maybe AI if not
  too demanding" — rules core was the agreed architecture).

## Roadmap / next steps (user-agreed order)
1. Rules engine deepening (micronutrient flags from the 42-nutrient data was
   explicitly deferred as "later"; stall detection needs richer trend data).
2. Optional AI refine layer on the Meal Planner (reuse coach providers).
3. Diet Recommendations screen (BlankPage placeholder).
4. Fonts: 'Barlow Condensed'/'DM Sans' are referenced but never loaded via
   expo-font — falls back to system fonts. Load them eventually.
5. Full Apple Health/HealthKit (Watch data) — OPTIONAL upgrade now; Pedometer
   covers steps. Needs EAS dev build + $99/yr Apple Developer (no Mac).
6. Accounts/sync — LAST, only when multi-device or community voting goes real.

## Recipes ("super items", shipped 2026-07-26)
A recipe is a named ingredient set that behaves like ONE food everywhere.
- **Ingredients are the only source of truth — nutrients are NEVER
  stored.** `lib/recipes.ts` projects a Recipe into the Food shape on
  every read (`recipeToFood`), and `useAppStore` appends those to the
  `foods` array via a memo. That single memo is why the logger, pantry,
  planner, nutrition summaries and gram display all work untouched, and
  why nothing can go stale when an ingredient or seed food changes.
  Store exposes `foods` (combined) and `rawFoods` (editable DB).
- Per serving = totals ÷ `yields`. `cookedWeightGrams` overrides the raw
  ingredient sum (stews shed water); serving weight = total ÷ yields.
- **Category defaults to the biggest CALORIE contributor**, not weight —
  weight files a half-tomato chili under "Vegetables" and any broth-heavy
  stew under "Broths & Infusions". Overridable per recipe.
- `Food.isRecipe` + `Food.ingredientCategories` are the only markers.
  **`passesRestriction()` checks ingredientCategories as well as the
  recipe's own category** — otherwise a recipe categorised "Starches &
  Tubers" smuggles butter through an Orthodox fast day. Verified by test.
- Slots gain `recipeOnly`: one recipe fills the whole slot at full budget
  (falls through to normal assembly if no recipe fits, so slots are never
  empty). Recipes also compete as ordinary candidates when it's off.
- Recipes get `MAX_GRAMS_PER_RECIPE` (1200g) instead of the 450g
  per-ingredient cap, and are auto-added to the pantry on create (the
  planner only draws from the pantry).
- Recipe ids are `r…` prefixed. **No nesting** — recipes are derived from
  `rawFoods` only, so a recipe can't contain a recipe (deferred: needs
  cycle detection).
- generatePlan now warns when any day misses the calorie target by >10%
  (gram caps + low-density pantries can make it unreachable; silence read
  as "this plan hits your target").
- The Diet tab's "Diet Recs" placeholder was REPLACED by Recipes — the AI
  Coach already owns recommendations and two advice surfaces compete.

## Coach tab + prepared foods (2026-07-27/28)
- **Coach is now its own tab**, centre of five (Overview · Exercise ·
  Coach · Diet · Profile), rendered via a custom `tabBarButton`
  (`CoachTabButton` in App.js): a 40pt circle, `c.cardAlt` when idle and
  `c.accent` when focused. Deliberately FLUSH — an earlier raised
  version with a hard shadow read as too imposing. No negative margin,
  no shadow, no `overflow: visible` needed. AICoach/CoachChat/
  CoachBriefing moved out of ExerciseStack into `CoachStack`.
- Exercise tiles are now FIVE: Plan Maker, Tracker, **Steps**, **Body**,
  Rest (the grid wraps 2/2/1, last tile centred). A short-lived
  `ProgressPage` was tried in slot 4 and removed as redundant — the user
  found it useless since the Tracker's calendar already reaches session
  history. It sits in `_to_delete/` if ever wanted.
  - `StepsPage`: 30-day bar history from the persisted step snapshots,
    7/30-day averages and best day; calls `useSteps` so opening it
    refreshes. This is the honest destination the Overview steps card
    always wanted (it points at WorkoutTracker as a compromise — worth
    repointing at 'Steps' now that it exists).
  - `BodyPage` + `STORAGE_KEYS.bodyLog`: weight, body-fat %, and 8
    optional tape measurements, one entry per date (re-logging replaces,
    same as SleepEntry). **Saving a weight also writes
    coachProfile.bodyWeightLb** — the coach uses it for protein/calorie
    maths, so two sources of truth would drift.
- SessionDetail exercise names are now Pressable → ExerciseHistory.
  Previously per-lift history was reachable ONLY from inside a live
  workout, so every path through the calendar or history list dead-ended.
- **`PREPARED_CATEGORY` = 'Prepared & Restaurant'** (constants.ts) for
  takeout/fast food. A CATEGORY, not a flag, so the rule is visible and
  enforceable in one place:
  - `isPlannable()` in mealPlanner excludes it from the candidate pool
    AND from `suggestReplacement` — checked on `ingredientCategories`
    too, so a recipe can't launder a Big Mac into a plan. Verified with
    the food deliberately stocked and recommendations ON.
  - FoodAdder ("Add to Pantry") filters it out of both the list and the
    category chips — you can't stock a Chipotle bowl.
- **Quick add lives in the Logger's food picker** (`LogFoodPickerPage`),
  not just the Pantry flow: name + serving + kcal/P/C/F, defaults to
  PREPARED_CATEGORY, prefills from the search text, and logs the food
  immediately on save. Needs `onAddCustomFood` (store.addCustomFood)
  passed in. The old path (Pantry → FoodAdder → FoodEntry) was pure
  friction for a food that will never live in the pantry.

## Coach context expansion + logged summaries (2026-07-26)
- `buildCoachContext` previously exposed ONLY calories+protein averages,
  no plans and no pantry — so "which plan is better?" and "what should I
  add to my pantry?" were unanswerable. Now also includes:
  `micronutrientsLast7d` (every micro's % of daily target, **sorted
  lowest-first**, averaged over days actually logged — dividing by 7 when
  2 days were tracked would invent deficiencies), `pantry` (counts +
  names by category, categories >12 items truncated, plus recipes),
  `plans` (name, dayCount, totalWeeklySets, **setsByMuscle**, and each
  day's exercise list as "Name 4x8"), `steps`, and `sleep.recentNights`
  (per-night detail, not just the average).
  New inputs are OPTIONAL (`plans`, `pantryIds`, `steps`) so old call
  sites still compile. Both SYSTEM_PROMPT and CHAT_SYSTEM were updated to
  tell the model to use them. Packet measured ~2.6KB / ~650 tokens with a
  6-item pantry — keep an eye on it as the pantry grows (that's why the
  per-category name list is capped).
- `LogPeriodSummaryPage` ('LogPeriodSummary' route, opened from the
  Logger header): the meal-planner week summary but sourced from the
  actual log. Week/Month toggle + paging back through periods, macro
  cards, biggest calorie contributors, full nutrient bars.
  **Targets scale by days LOGGED, not days elapsed** — same reasoning as
  the coach's micro coverage.
- Overview Recent Activity: sleep and workouts were being crowded out —
  sleep anchors to 8 AM of its wake date, so four foods logged that day
  took every slot. Now the newest entry from each source (food/workout/
  sleep) is guaranteed a place, then remaining slots fill by recency
  (5 total). Note the guarantee must fill only the LEFTOVER slots; slicing
  the combined list would just drop them again.

## Pantry category rail + profile photo (2026-07-26)
- Pantry section headings went 10pt → 22pt/800 with a 3px rule and an
  item-count badge; a jump rail sits in a right-hand gutter (one tick per
  category, initials via `railLabel()`, active tick shows the full name).
  Section positions come from `onLayout`; tapping calls `scrollTo` on the
  NestableScrollContainer ref (it DOES forward refs — verified in the
  library source).
  **Constraint:** NestableScrollContainer overrides `onScroll` for its own
  drag logic, so live scroll tracking is impossible — the rail syncs on
  `onMomentumScrollEnd`/`onScrollEndDrag`, which DO pass through.
  Active-category lookup sorts offsets by position, not onLayout order.
- Profile photo: `lib/photo.ts` (expo-image-picker + expo-file-system).
  The picker returns a CACHE uri the OS may clear, so the file is copied
  into `documentDirectory/profile/` with a timestamped name (defeats the
  Image cache) and the old one deleted. Returns a discriminated
  `{status: 'ok'|'cancelled'|'denied'}` so denial can be told from cancel.
  **SDK 54 moved expo-file-system to a File/Directory API — the stable
  functional one is at `expo-file-system/legacy`** (verified present in
  19.0.x). Shown on both the Profile identity card (tap to change/remove)
  and the Overview header avatar; falls back to the "H" initial.
- Requires `npm install` (expo-image-picker, expo-file-system added).

## Keyboard handling (fixed 2026-07-26 — keyboard covered inputs)
NO library: react-native-keyboard-controller needs a native build and
would break Expo Go. Built-ins only.
- `lib/keyboard.ts` → `keyboardAwareScrollProps`. Spread it on EVERY
  vertical ScrollView that contains inputs (already done on 10 screens):
  `automaticallyAdjustKeyboardInsets` (iOS only — Android does the same
  at window level, so setting both double-compensates) plus
  `keyboardShouldPersistTaps="handled"` (without it the first tap on a
  button while typing is swallowed to dismiss the keyboard).
  Never spread it on `horizontal` ScrollViews (chip rows) — wrong axis.
- `app.json` → `android.softwareKeyboardLayoutMode: "resize"`.
- CoachChatPage/CoachBriefingPage instead use KeyboardAvoidingView
  (behavior 'padding' on iOS, undefined on Android). Correct as-is: RN
  measures the view's own frame, so the bottom tab bar is already
  accounted for and NO keyboardVerticalOffset is needed.
- Gotcha when scripting this: `useRef<ScrollView>(null)` is a TS generic,
  not a JSX tag — a naive `<ScrollView` regex corrupts it. Always
  parse-check (babel) after bulk edits.

## Working conventions for agents
- User likes: status updates while you work, being consulted on UX decisions
  ("where do u think X should go?"), concise answers, honest pushback with
  real numbers/evidence, discussing vision BEFORE committing to code.
- Verify edits parse before finishing (babel parser or tsc). One entry per
  concern; keep diffs surgical.
- The folder previously lived in OneDrive, which twice ROLLED BACK App.js and
  other files mid-session (sync conflicts silently restoring old versions).
  If anything looks mysteriously reverted, suspect sync tooling first.
  **Git is now initialized** (branch main, first commit 2026-07-26). NOTE for
  cloud/bridge agents: the mounted folder forbids unlink, so every git command
  leaves a stale `.git/*.lock` — `mv` it into `_to_delete/` (gitignored)
  before/after git commands; never end a git sequence without the cleanup.
  The user can empty `_to_delete/` anytime.
- After `package.json` changes the user must run `npm install` (expo-sensors
  was added for steps).
- Storage migrations: bump key versions + add self-heal effects in App.js
  (see foods self-heal and legacy plan→days migration for the pattern).
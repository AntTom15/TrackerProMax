// Shared data model for TrackerProMax.

// All nutrient values are per ONE serving of the food.
// Keys match the FoodEntryPage form fields.
export type NutrientKey =
  | 'calories'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'fiber'
  | 'sugars'
  | 'satFat'
  | 'monoFat'
  | 'polyFat'
  | 'omega3'
  | 'omega6'
  | 'transFat'
  | 'cholesterol'
  | 'sodium'
  | 'vitaminA'
  | 'vitaminB1'
  | 'vitaminB2'
  | 'vitaminB3'
  | 'vitaminB5'
  | 'vitaminB6'
  | 'vitaminB7'
  | 'vitaminB9'
  | 'vitaminB12'
  | 'vitaminC'
  | 'vitaminD'
  | 'vitaminE'
  | 'vitaminK1'
  | 'vitaminK2'
  | 'calcium'
  | 'chloride'
  | 'choline'
  | 'chromium'
  | 'copper'
  | 'iodine'
  | 'iron'
  | 'magnesium'
  | 'manganese'
  | 'molybdenum'
  | 'phosphorus'
  | 'potassium'
  | 'selenium'
  | 'zinc';

export type Nutrients = Partial<Record<NutrientKey, number>>;

export interface Food {
  id: string;
  name: string;
  category: string;
  // Display label for one serving, e.g. "100g" or "91g (1 cup)".
  servingLabel: string;
  // Gram weight of one serving, when known (used later for unit conversion).
  servingWeightGrams?: number;
  nutrients: Nutrients;
  uploadedBy: string;
  upvotes: number;
  downvotes: number;
}

// The pantry is a list of food ids; per-category custom ordering lives in
// pantryOrder: { [category]: foodId[] }.
export type PantryOrder = Record<string, string[]>;

export type VoteDirection = 'up' | 'down';
// The current user's votes, keyed by food id.
export type MyVotes = Record<string, VoteDirection>;

export type MealName = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks';

export interface LogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  meal: MealName;
  foodId: string;
  servings: number;
  loggedAt: number;
}

// ---------------- Meal Planner ----------------

// What a meal slot should look like, macro-wise. 'carb-lean' = carb
// sources + lean protein (e.g. Randle-cycle-conscious morning meal);
// 'fatty' = fat-dominant foods; 'high-protein' = protein-anchored;
// 'balanced' = no macro steering.
export type SlotArchetype = 'carb-lean' | 'fatty' | 'high-protein' | 'balanced';

// One meal slot in the user's day template. `meal` decides which Logger
// section a generated meal logs into.
export interface MealSlot {
  id: string;
  name: string;
  meal: MealName;
  archetype: SlotArchetype;
}

// User-defined generation settings. calorieTarget is matched tightly;
// the optional macro percents (must total ≤ 100 when set) are soft
// targets with a wide tolerance by design.
export interface PlannerSettings {
  calorieTarget: number;
  proteinPct: number | null;
  carbPct: number | null;
  fatPct: number | null;
  slots: MealSlot[];
}

export interface PlannedItem {
  foodId: string;
  servings: number;
}

export interface PlannedMeal {
  slotId: string;
  slotName: string;
  meal: MealName;
  items: PlannedItem[];
}

export interface PlannedDay {
  date: string; // YYYY-MM-DD
  meals: PlannedMeal[];
}

export interface MealPlan {
  id: string;
  createdAt: number;
  seed: number;
  days: PlannedDay[];
}

// ---------------- Exercise ----------------

export type ExerciseKind = 'strength' | 'cardio';

export type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Biceps'
  | 'Triceps'
  | 'Forearms'
  | 'Quads'
  | 'Hamstrings'
  | 'Glutes'
  | 'Calves'
  | 'Core'
  | 'Full Body';

export type Equipment =
  | 'Barbell'
  | 'Dumbbell'
  | 'Machine'
  | 'Cable'
  | 'Bodyweight'
  | 'Kettlebell'
  | 'Band'
  | 'Cardio Machine'
  | 'Other';

export interface Exercise {
  id: string;
  name: string;
  kind: ExerciseKind;
  muscles: MuscleGroup[]; // primary first
  equipment: Equipment;
}

// An exercise inside a workout plan with its targets.
export interface PlanExercise {
  exerciseId: string;
  targetSets: number;
  // Free-form rep target, e.g. "8-12", "5", "AMRAP"; for cardio it's minutes.
  targetReps: string;
  // Optional rest override in seconds for this exercise only. When unset,
  // the profile-wide rest timer default applies.
  restSeconds?: number;
}

// One night of sleep, keyed by the morning the user woke up.
export interface SleepEntry {
  id: string;
  // Wake date, yyyy-MM-dd (bed time may be the evening before).
  date: string;
  bedTime: string; // 'HH:mm' 24h
  wakeTime: string; // 'HH:mm' 24h
  durationMin: number; // computed, handles crossing midnight
  quality: number; // 1-5
}

// One named training day inside a plan (e.g. "Push A", "Legs").
export interface PlanDay {
  id: string;
  name: string;
  exercises: PlanExercise[];
}

export interface WorkoutPlan {
  id: string;
  name: string;
  // 1–10 days; the cap leaves room for alternates.
  days: PlanDay[];
  createdAt: number;
}

// One performed set during a session.
export interface SetEntry {
  weight: number; // kg or lb — unit-agnostic for now
  reps: number;
  // Ticked off in the tracker; flipping this on starts the rest timer.
  done?: boolean;
}

export interface SessionExercise {
  exerciseId: string;
  sets: SetEntry[]; // strength
  durationMin?: number; // cardio
}

export interface WorkoutSession {
  id: string;
  date: string; // YYYY-MM-DD
  name: string; // "Plan · Day" or "Freestyle"
  planId: string | null;
  dayId: string | null;
  exercises: SessionExercise[];
  startedAt: number;
  finishedAt: number | null; // null = in progress
}

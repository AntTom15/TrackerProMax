import type { MealName } from './types';

// Single source of truth for food categories (was duplicated in
// PantryPage and FoodEntryPage).
export const CATEGORY_ORDER = [
  'Fatty Muscle Meats',
  'Lean Muscle Meats',
  'Fatty Fish',
  'Lean Fish',
  'Dairy & Eggs',
  'Lean Organs',
  'Fatty Organs',
  'Shellfish',
  'Vegetables',
  'Fruits',
  'Grains',
  'Nuts & Seeds',
  'Starches & Tubers',
  'Fungi',
  'Fats & Oils',
  'Sugars & Sweeteners',
  'Legumes & Soy',
  'Processed Plant Proteins',
  'Supplements & Powders',
  'Broths & Infusions',
  'Herbs & Aromatics',
  'Desserts',
];

export const MEALS: MealName[] = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

// Category quick-sets for the planner's pickers (fasting rules etc.).
// Categories in neither set (oils, sweeteners, supplements, broths,
// desserts) are tapped individually — they're ambiguous by nature.
export const ANIMAL_CATEGORIES = [
  'Fatty Muscle Meats',
  'Lean Muscle Meats',
  'Fatty Fish',
  'Lean Fish',
  'Dairy & Eggs',
  'Lean Organs',
  'Fatty Organs',
  'Shellfish',
];

export const PLANT_CATEGORIES = [
  'Vegetables',
  'Fruits',
  'Grains',
  'Nuts & Seeds',
  'Starches & Tubers',
  'Fungi',
  'Legumes & Soy',
  'Processed Plant Proteins',
  'Herbs & Aromatics',
];

// Sunday-first, matching date-fns getDay().
export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Max training days per workout plan (leaves room for alternates).
export const MAX_PLAN_DAYS = 10;

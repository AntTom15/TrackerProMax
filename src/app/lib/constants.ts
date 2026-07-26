import type { MealName } from './types';

// Single source of truth for food categories (was duplicated in
// PantryPage and FoodEntryPage). Alphabetical by user request — a
// predictable order beats a semantic one you have to memorize.
export const CATEGORY_ORDER = [
  'Broths & Infusions',
  'Dairy',
  'Desserts',
  'Eggs',
  'Fats & Oils',
  'Fatty Fish',
  'Fatty Muscle Meats',
  'Fatty Organs',
  'Fruits',
  'Fungi',
  'Grains',
  'Herbs & Aromatics',
  'Lean Fish',
  'Lean Muscle Meats',
  'Lean Organs',
  'Legumes & Soy',
  'Nuts & Seeds',
  'Processed Plant Proteins',
  'Shellfish',
  'Starches & Tubers',
  'Sugars & Sweeteners',
  'Supplements & Powders',
  'Vegetables',
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
  'Dairy',
  'Eggs',
  'Lean Organs',
  'Fatty Organs',
  'Shellfish',
];

// 2026-07: 'Dairy & Eggs' split into 'Dairy' + 'Eggs'. Used by the
// App.js migration effects for stored foods and planner settings.
export const LEGACY_DAIRY_EGGS = 'Dairy & Eggs';
export const splitDairyEggs = (category: string, foodName?: string): string =>
  category === LEGACY_DAIRY_EGGS
    ? (foodName ?? '').toLowerCase().includes('egg')
      ? 'Eggs'
      : 'Dairy'
    : category;

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

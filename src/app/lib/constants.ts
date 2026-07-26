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

// Max training days per workout plan (leaves room for alternates).
export const MAX_PLAN_DAYS = 10;

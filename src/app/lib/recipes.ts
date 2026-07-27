// Recipes are "super items": a named set of ingredients that behaves
// like a single food everywhere in the app.
//
// The ingredients are the source of truth — nutrients are NEVER stored.
// Instead `recipeToFood` projects a Recipe into the Food shape on every
// read, so the logger, pantry, planner, nutrition summaries and gram
// display all work unchanged, and nothing can drift out of sync when an
// ingredient is edited or the seed self-heal refreshes a food.

import type { Food, Nutrients, NutrientKey, Recipe } from './types';

// Recipe ids are prefixed so they can never collide with food ids
// (`f…` for seeds/custom foods, `p…` plans, `l…` log entries).
export const RECIPE_ID_PREFIX = 'r';
export const isRecipeId = (id: string) => id.startsWith(RECIPE_ID_PREFIX);

export interface RecipeTotals {
  nutrients: Nutrients;
  rawWeightGrams: number;
  // Calories contributed per ingredient category, used to pick the
  // default category.
  caloriesByCategory: Record<string, number>;
  // Ingredients whose food is missing from the database.
  missingIngredients: number;
}

// Sum every ingredient across the WHOLE recipe (not per serving).
export function recipeTotals(
  recipe: Recipe,
  foodById: Map<string, Food>
): RecipeTotals {
  const nutrients: Nutrients = {};
  const caloriesByCategory: Record<string, number> = {};
  let rawWeightGrams = 0;
  let missingIngredients = 0;

  for (const ing of recipe.ingredients) {
    const food = foodById.get(ing.foodId);
    if (!food) {
      missingIngredients += 1;
      continue;
    }
    for (const [k, v] of Object.entries(food.nutrients ?? {})) {
      if (typeof v !== 'number') continue;
      nutrients[k as NutrientKey] =
        (nutrients[k as NutrientKey] ?? 0) + v * ing.servings;
    }
    rawWeightGrams += (food.servingWeightGrams ?? 0) * ing.servings;
    const cals = (food.nutrients?.calories ?? 0) * ing.servings;
    caloriesByCategory[food.category] =
      (caloriesByCategory[food.category] ?? 0) + cals;
  }

  return { nutrients, rawWeightGrams, caloriesByCategory, missingIngredients };
}

// Default category = whichever ingredient category contributes the most
// CALORIES. Weight is a misleading proxy: a chili that is half tomatoes
// by weight is still a meat dish, and any broth-heavy stew would file
// itself under "Broths & Infusions".
export function deriveCategory(
  caloriesByCategory: Record<string, number>
): string {
  let best = '';
  let bestCals = -1;
  // Object key order is insertion order, so ties resolve alphabetically
  // to stay deterministic.
  for (const [cat, cals] of Object.entries(caloriesByCategory)) {
    if (cals > bestCals || (cals === bestCals && cat < best)) {
      best = cat;
      bestCals = cals;
    }
  }
  return best || 'Recipes';
}

/**
 * Project a Recipe into a Food, with all values PER SERVING.
 * Returns null for an empty recipe (nothing sensible to show).
 */
export function recipeToFood(
  recipe: Recipe,
  foodById: Map<string, Food>
): Food | null {
  if (recipe.ingredients.length === 0) return null;

  const { nutrients, rawWeightGrams, caloriesByCategory, missingIngredients } =
    recipeTotals(recipe, foodById);
  const yields = Math.max(1, recipe.yields || 1);

  const perServing: Nutrients = {};
  for (const [k, v] of Object.entries(nutrients)) {
    if (typeof v !== 'number') continue;
    perServing[k as NutrientKey] = v / yields;
  }

  // Cooked weight wins when set — simmering a stew can shed a third of
  // its raw weight, and every gram amount in the app depends on this.
  const totalWeight =
    recipe.cookedWeightGrams && recipe.cookedWeightGrams > 0
      ? recipe.cookedWeightGrams
      : rawWeightGrams;
  const servingWeightGrams = totalWeight > 0 ? totalWeight / yields : undefined;

  const category =
    recipe.categoryOverride ?? deriveCategory(caloriesByCategory);

  const ingredientCategories = Object.keys(caloriesByCategory);

  return {
    id: recipe.id,
    name: recipe.name || 'Untitled recipe',
    category,
    servingLabel: servingWeightGrams
      ? `${Math.round(servingWeightGrams)}g (1 of ${yields})`
      : `1 of ${yields} servings`,
    servingWeightGrams,
    nutrients: perServing,
    uploadedBy: 'You',
    upvotes: 0,
    downvotes: 0,
    isRecipe: true,
    ingredientCategories,
  };
}

// Convenience: project a whole list, dropping empty recipes.
export function recipesToFoods(
  recipes: Recipe[],
  foodById: Map<string, Food>
): Food[] {
  const out: Food[] = [];
  for (const r of recipes) {
    const f = recipeToFood(r, foodById);
    if (f) out.push(f);
  }
  return out;
}

// Grams of a single ingredient, for the builder UI.
export const ingredientGrams = (
  food: Food | undefined,
  servings: number
): number | null => {
  const g = food?.servingWeightGrams;
  return g && g > 0 ? g * servings : null;
};

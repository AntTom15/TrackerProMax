import type { NutrientKey } from './types';

// Display metadata + adult daily targets for every tracked nutrient.
// RDA values follow FDA Daily Values (adults, 2000 kcal diet) where one
// exists; omega-3/6 use NIH Adequate Intake. `rda: undefined` means no
// established daily value — the summary shows the amount without a bar.
export interface NutrientInfo {
  key: NutrientKey;
  label: string;
  unit: string;
  rda?: number;
}

export interface NutrientSection {
  title: string;
  items: NutrientInfo[];
}

export const NUTRIENT_SECTIONS: NutrientSection[] = [
  {
    title: 'Energy & Macros',
    items: [
      { key: 'calories', label: 'Calories', unit: 'kcal', rda: 2000 },
      { key: 'protein', label: 'Protein', unit: 'g', rda: 50 },
      { key: 'carbs', label: 'Carbohydrates', unit: 'g', rda: 275 },
      { key: 'fat', label: 'Total Fat', unit: 'g', rda: 78 },
      { key: 'fiber', label: 'Dietary Fiber', unit: 'g', rda: 28 },
      { key: 'sugars', label: 'Total Sugars', unit: 'g', rda: 50 },
    ],
  },
  {
    title: 'Fat Profile',
    items: [
      { key: 'satFat', label: 'Saturated Fat', unit: 'g', rda: 20 },
      { key: 'monoFat', label: 'Monounsaturated Fat', unit: 'g' },
      { key: 'polyFat', label: 'Polyunsaturated Fat', unit: 'g' },
      { key: 'omega3', label: 'Omega-3', unit: 'mg', rda: 1600 },
      { key: 'omega6', label: 'Omega-6', unit: 'mg', rda: 17000 },
      { key: 'transFat', label: 'Trans Fat', unit: 'g' },
      { key: 'cholesterol', label: 'Cholesterol', unit: 'mg', rda: 300 },
    ],
  },
  {
    title: 'Vitamins',
    items: [
      { key: 'vitaminA', label: 'Vitamin A', unit: 'mcg RAE', rda: 900 },
      { key: 'vitaminB1', label: 'Vitamin B1 (Thiamin)', unit: 'mg', rda: 1.2 },
      { key: 'vitaminB2', label: 'Vitamin B2 (Riboflavin)', unit: 'mg', rda: 1.3 },
      { key: 'vitaminB3', label: 'Vitamin B3 (Niacin)', unit: 'mg NE', rda: 16 },
      { key: 'vitaminB5', label: 'Vitamin B5', unit: 'mg', rda: 5 },
      { key: 'vitaminB6', label: 'Vitamin B6', unit: 'mg', rda: 1.7 },
      { key: 'vitaminB7', label: 'Vitamin B7 (Biotin)', unit: 'mcg', rda: 30 },
      { key: 'vitaminB9', label: 'Vitamin B9 (Folate)', unit: 'mcg DFE', rda: 400 },
      { key: 'vitaminB12', label: 'Vitamin B12', unit: 'mcg', rda: 2.4 },
      { key: 'vitaminC', label: 'Vitamin C', unit: 'mg', rda: 90 },
      { key: 'vitaminD', label: 'Vitamin D', unit: 'mcg', rda: 20 },
      { key: 'vitaminE', label: 'Vitamin E', unit: 'mg', rda: 15 },
      { key: 'vitaminK1', label: 'Vitamin K1', unit: 'mcg', rda: 120 },
      { key: 'vitaminK2', label: 'Vitamin K2', unit: 'mcg' },
      { key: 'choline', label: 'Choline', unit: 'mg', rda: 550 },
    ],
  },
  {
    title: 'Major Minerals',
    items: [
      { key: 'sodium', label: 'Sodium', unit: 'mg', rda: 2300 },
      { key: 'potassium', label: 'Potassium', unit: 'mg', rda: 4700 },
      { key: 'chloride', label: 'Chloride', unit: 'mg', rda: 2300 },
      { key: 'calcium', label: 'Calcium', unit: 'mg', rda: 1300 },
      { key: 'magnesium', label: 'Magnesium', unit: 'mg', rda: 420 },
      { key: 'phosphorus', label: 'Phosphorus', unit: 'mg', rda: 1250 },
    ],
  },
  {
    title: 'Trace Minerals',
    items: [
      { key: 'iron', label: 'Iron', unit: 'mg', rda: 18 },
      { key: 'zinc', label: 'Zinc', unit: 'mg', rda: 11 },
      { key: 'copper', label: 'Copper', unit: 'mg', rda: 0.9 },
      { key: 'manganese', label: 'Manganese', unit: 'mg', rda: 2.3 },
      { key: 'iodine', label: 'Iodine', unit: 'mcg', rda: 150 },
      { key: 'selenium', label: 'Selenium', unit: 'mcg', rda: 55 },
      { key: 'chromium', label: 'Chromium', unit: 'mcg', rda: 35 },
      { key: 'molybdenum', label: 'Molybdenum', unit: 'mcg', rda: 45 },
    ],
  },
];

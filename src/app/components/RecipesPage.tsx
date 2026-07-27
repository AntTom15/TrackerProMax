import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { keyboardAwareScrollProps } from '../lib/keyboard';
import { useNavigation } from '@react-navigation/native';
import {
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Trash,
  X,
} from './Icons';
import { CATEGORY_ORDER } from '../lib/constants';
import { ThemeColors, useThemedStyles } from '../lib/theme';
import NumericInput from './components2/NumericInput';
import {
  deriveCategory,
  ingredientGrams,
  recipeTotals,
  recipeToFood,
} from '../lib/recipes';
import type { Food, Recipe, RecipeIngredient } from '../lib/types';

interface RecipesPageProps {
  // Raw database only — a recipe can't contain another recipe.
  foods: Food[];
  pantryIds: string[];
  recipes: Recipe[];
  onAddRecipe: (draft: Omit<Recipe, 'id' | 'createdAt'>) => Recipe;
  onUpdateRecipe: (recipeId: string, patch: Partial<Recipe>) => void;
  onDeleteRecipe: (recipeId: string) => void;
}

type Draft = Omit<Recipe, 'id' | 'createdAt'>;

const emptyDraft = (): Draft => ({
  name: '',
  ingredients: [],
  yields: 4,
  cookedWeightGrams: null,
  categoryOverride: null,
});

// Recipes are "super items": ingredients are the source of truth and the
// nutrition is derived, so a recipe behaves like any other food once
// saved (loggable, stockable, plannable).
export default function RecipesPage({
  foods,
  pantryIds,
  recipes,
  onAddRecipe,
  onUpdateRecipe,
  onDeleteRecipe,
}: RecipesPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const navigation = useNavigation();

  const foodById = new Map(foods.map((f) => [f.id, f]));
  const pantrySet = new Set(pantryIds);

  // null = list view; otherwise the recipe being edited ('' id = new).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [query, setQuery] = useState('');
  const [catPickerOpen, setCatPickerOpen] = useState(false);

  const startNew = () => {
    setDraft(emptyDraft());
    setEditingId('');
  };

  const startEdit = (recipe: Recipe) => {
    setDraft({
      name: recipe.name,
      ingredients: [...recipe.ingredients],
      yields: recipe.yields,
      cookedWeightGrams: recipe.cookedWeightGrams ?? null,
      categoryOverride: recipe.categoryOverride ?? null,
    });
    setEditingId(recipe.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setQuery('');
    setCatPickerOpen(false);
  };

  const save = () => {
    if (draft.ingredients.length === 0) {
      Alert.alert('Add an ingredient', 'A recipe needs at least one food.');
      return;
    }
    const clean: Draft = { ...draft, name: draft.name.trim() || 'Untitled recipe' };
    if (editingId) onUpdateRecipe(editingId, clean);
    else onAddRecipe(clean);
    cancelEdit();
  };

  const confirmDelete = (recipe: Recipe) =>
    Alert.alert('Delete recipe?', `"${recipe.name}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          onDeleteRecipe(recipe.id);
          if (editingId === recipe.id) cancelEdit();
        },
      },
    ]);

  // ---- ingredient editing ----
  const setIngredients = (ingredients: RecipeIngredient[]) =>
    setDraft((d) => ({ ...d, ingredients }));

  const addIngredient = (food: Food) => {
    if (draft.ingredients.some((i) => i.foodId === food.id)) return;
    setIngredients([...draft.ingredients, { foodId: food.id, servings: 1 }]);
    setQuery('');
  };

  // Amounts are entered in grams when the food has a known serving
  // weight — nobody thinks in "2.5 servings of butter".
  const setIngredientGrams = (foodId: string, text: string) => {
    const food = foodById.get(foodId);
    const val = parseFloat(text);
    if (!isFinite(val) || val < 0) return;
    const g = food?.servingWeightGrams;
    const servings = g && g > 0 ? val / g : val;
    setIngredients(
      draft.ingredients.map((i) =>
        i.foodId === foodId
          ? { ...i, servings: Math.round(servings * 1000) / 1000 }
          : i
      )
    );
  };

  const removeIngredient = (foodId: string) =>
    setIngredients(draft.ingredients.filter((i) => i.foodId !== foodId));

  // ---- live preview of the derived food ----
  const draftRecipe: Recipe = {
    ...draft,
    id: editingId || 'preview',
    createdAt: 0,
  };
  const totals = recipeTotals(draftRecipe, foodById);
  const preview = recipeToFood(draftRecipe, foodById);
  const autoCategory = deriveCategory(totals.caloriesByCategory);

  const q = query.toLowerCase();
  const inDraft = new Set(draft.ingredients.map((i) => i.foodId));
  const searchResults = q
    ? foods
        .filter(
          (f) =>
            !inDraft.has(f.id) &&
            (f.name.toLowerCase().includes(q) ||
              f.category.toLowerCase().includes(q))
        )
        .sort((a, b) => {
          const ap = pantrySet.has(a.id) ? 0 : 1;
          const bp = pantrySet.has(b.id) ? 0 : 1;
          return ap - bp || a.name.localeCompare(b.name);
        })
        .slice(0, 10)
    : [];

  // ------------------------------------------------------------- list
  if (editingId === null) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}
          >
            <ChevronLeft size={22} color={c.textMuted} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Recipes</Text>
            <Text style={styles.subtitle}>
              Build a dish once, then log or plan it like any food
            </Text>
          </View>
        </View>

        <ScrollView
          {...keyboardAwareScrollProps}
          style={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {recipes.length === 0 && (
            <Text style={styles.emptyText}>
              No recipes yet. A recipe is a set of ingredients that behaves
              like a single food — its nutrition is calculated from what's
              in it, so it stays correct when you tweak the ingredients.
            </Text>
          )}

          {recipes.map((recipe) => {
            const food = recipeToFood(recipe, foodById);
            const kcal = Math.round(food?.nutrients?.calories ?? 0);
            return (
              <Pressable
                key={recipe.id}
                onPress={() => startEdit(recipe)}
                style={({ pressed }) => [
                  styles.recipeCard,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={styles.recipeIcon}>
                  <ChefHat size={16} color={c.onAccent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recipeName}>{recipe.name}</Text>
                  <Text style={styles.recipeMeta}>
                    {recipe.ingredients.length} ingredient
                    {recipe.ingredients.length === 1 ? '' : 's'} ·{' '}
                    {recipe.yields} servings · {kcal} kcal each
                  </Text>
                  {!!food && (
                    <Text style={styles.recipeCategory}>{food.category}</Text>
                  )}
                </View>
                <ChevronRight size={16} color={c.textMuted} />
              </Pressable>
            );
          })}

          <Pressable onPress={startNew} style={styles.addBtn}>
            <Plus size={14} color={c.textMuted} />
            <Text style={styles.addBtnText}>New recipe</Text>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // ----------------------------------------------------------- editor
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={cancelEdit} style={styles.headerBtn}>
          <ChevronLeft size={22} color={c.textMuted} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {editingId ? 'Edit Recipe' : 'New Recipe'}
          </Text>
        </View>
        {!!editingId && (
          <Pressable
            onPress={() => {
              const r = recipes.find((x) => x.id === editingId);
              if (r) confirmDelete(r);
            }}
            style={styles.headerBtn}
            hitSlop={6}
          >
            <Trash size={18} color={c.danger} />
          </Pressable>
        )}
        <Pressable onPress={save} style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>Save</Text>
        </Pressable>
      </View>

      <ScrollView
        {...keyboardAwareScrollProps}
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <TextInput
          value={draft.name}
          onChangeText={(t) => setDraft((d) => ({ ...d, name: t }))}
          placeholder="Recipe name"
          placeholderTextColor={c.textFaint}
          style={styles.nameInput}
        />

        {/* Live derived summary */}
        {!!preview && (
          <View style={styles.previewCard}>
            <View style={styles.previewTop}>
              <Text style={styles.previewKcal}>
                {Math.round(preview.nutrients.calories ?? 0)}
                <Text style={styles.previewKcalUnit}> kcal / serving</Text>
              </Text>
              <Text style={styles.previewServing}>
                {preview.servingLabel}
              </Text>
            </View>
            <Text style={styles.previewMacros}>
              P{Math.round(preview.nutrients.protein ?? 0)} · C
              {Math.round(preview.nutrients.carbs ?? 0)} · F
              {Math.round(preview.nutrients.fat ?? 0)} · whole dish{' '}
              {Math.round(totals.nutrients.calories ?? 0)} kcal /{' '}
              {Math.round(totals.rawWeightGrams)}g raw
            </Text>
          </View>
        )}

        {/* Ingredients */}
        <Text style={styles.sectionTitle}>Ingredients</Text>
        {draft.ingredients.map((ing) => {
          const food = foodById.get(ing.foodId);
          if (!food) return null;
          const grams = ingredientGrams(food, ing.servings);
          const kcal = (food.nutrients?.calories ?? 0) * ing.servings;
          return (
            <View key={ing.foodId} style={styles.ingRow}>
              <View style={styles.ingAmountWrap}>
                <NumericInput
                  value={
                    grams != null
                      ? String(Math.round(grams))
                      : String(Math.round(ing.servings * 100) / 100)
                  }
                  onChangeText={(t: string) =>
                    setIngredientGrams(ing.foodId, t)
                  }
                  selectTextOnFocus
                  style={styles.ingAmountInput}
                />
                <Text style={styles.ingUnit}>{grams != null ? 'g' : 'srv'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ingName} numberOfLines={1}>
                  {food.name}
                </Text>
                <Text style={styles.ingMeta}>
                  {food.category} · {Math.round(kcal)} kcal
                </Text>
              </View>
              <Pressable
                onPress={() => removeIngredient(ing.foodId)}
                style={styles.ingRemove}
                hitSlop={6}
              >
                <X size={11} color={c.textMuted} />
              </Pressable>
            </View>
          );
        })}

        {/* Ingredient search */}
        <View style={styles.searchRow}>
          <Search size={14} color={c.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Add an ingredient…"
            placeholderTextColor={c.textFaint}
            style={styles.searchInput}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={6}>
              <X size={14} color={c.textMuted} />
            </Pressable>
          )}
        </View>
        {searchResults.map((food) => (
          <Pressable
            key={food.id}
            onPress={() => addIngredient(food)}
            style={styles.searchResult}
          >
            <Text style={styles.searchResultName} numberOfLines={1}>
              {food.name}
            </Text>
            {pantrySet.has(food.id) && (
              <Text style={styles.pantryBadge}>Pantry</Text>
            )}
            <Plus size={12} color={c.textMuted} />
          </Pressable>
        ))}

        {/* Yield + cooked weight */}
        <Text style={styles.sectionTitle}>Yield</Text>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Makes</Text>
          <View style={styles.stepper}>
            <Pressable
              onPress={() =>
                setDraft((d) => ({ ...d, yields: Math.max(1, d.yields - 1) }))
              }
              style={styles.stepBtn}
              hitSlop={4}
            >
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Text style={styles.stepValue}>{draft.yields}</Text>
            <Pressable
              onPress={() =>
                setDraft((d) => ({ ...d, yields: Math.min(20, d.yields + 1) }))
              }
              style={styles.stepBtn}
              hitSlop={4}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.fieldSuffix}>servings</Text>
        </View>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Cooked weight</Text>
          <NumericInput
            value={
              draft.cookedWeightGrams != null
                ? String(draft.cookedWeightGrams)
                : ''
            }
            onChangeText={(t: string) => {
              const v = parseFloat(t);
              setDraft((d) => ({
                ...d,
                cookedWeightGrams: isFinite(v) && v > 0 ? v : null,
              }));
            }}
            placeholder={String(Math.round(totals.rawWeightGrams))}
            placeholderTextColor={c.textFaint}
            style={styles.fieldInput}
          />
          <Text style={styles.fieldSuffix}>g total</Text>
        </View>
        <Text style={styles.hint}>
          Optional. Simmering drives off water, so the raw ingredient total
          above overstates what ends up on the plate — set this if you weigh
          the finished dish.
        </Text>

        {/* Category */}
        <Text style={styles.sectionTitle}>Category</Text>
        <Pressable
          onPress={() => setCatPickerOpen((o) => !o)}
          style={styles.categoryRow}
        >
          <Text style={styles.categoryValue}>
            {draft.categoryOverride ?? (autoCategory || '—')}
          </Text>
          <Text style={styles.categoryTag}>
            {draft.categoryOverride ? 'manual' : 'auto'}
          </Text>
          <ChevronRight size={14} color={c.textMuted} />
        </Pressable>
        <Text style={styles.hint}>
          Defaults to whichever ingredient contributes the most calories, so
          a chili full of tomatoes still reads as a meat dish. Restricted
          days check every ingredient regardless of this setting.
        </Text>
        {catPickerOpen && (
          <View style={styles.catList}>
            <Pressable
              onPress={() => {
                setDraft((d) => ({ ...d, categoryOverride: null }));
                setCatPickerOpen(false);
              }}
              style={[
                styles.catChip,
                draft.categoryOverride == null && styles.catChipActive,
              ]}
            >
              <Text
                style={[
                  styles.catChipText,
                  draft.categoryOverride == null && styles.catChipTextActive,
                ]}
              >
                Auto ({autoCategory || '—'})
              </Text>
            </Pressable>
            {CATEGORY_ORDER.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => {
                  setDraft((d) => ({ ...d, categoryOverride: cat }));
                  setCatPickerOpen(false);
                }}
                style={[
                  styles.catChip,
                  draft.categoryOverride === cat && styles.catChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.catChipText,
                    draft.categoryOverride === cat && styles.catChipTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
    },
    headerBtn: { padding: 4 },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    subtitle: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      marginTop: 2,
    },
    saveBtn: {
      borderRadius: 10,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 14,
      paddingVertical: 7,
      shadowColor: c.shadow,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    saveBtnText: {
      fontSize: 12,
      fontWeight: '800',
      color: c.onAccent,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    content: { flex: 1, paddingHorizontal: 20 },
    emptyText: {
      fontSize: 13,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      textAlign: 'center',
      marginVertical: 20,
      lineHeight: 19,
    },
    recipeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      padding: 12,
      marginBottom: 8,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    recipeIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recipeName: {
      fontSize: 14,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    recipeMeta: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      marginTop: 2,
    },
    recipeCategory: {
      fontSize: 10,
      color: c.accentDeep,
      fontFamily: 'DM Sans',
      marginTop: 2,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 12,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: c.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    addBtnText: { fontSize: 13, color: c.textMuted, fontFamily: 'DM Sans' },
    nameInput: {
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      color: c.text,
      fontFamily: 'DM Sans',
      marginBottom: 12,
    },
    previewCard: {
      borderRadius: 12,
      backgroundColor: c.tintLimeFaint,
      borderWidth: 2,
      borderColor: c.text,
      padding: 12,
      marginBottom: 16,
    },
    previewTop: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    previewKcal: {
      fontSize: 22,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
    },
    previewKcalUnit: {
      fontSize: 11,
      fontWeight: '400',
      color: c.textMuted,
      fontFamily: 'DM Sans',
    },
    previewServing: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
    },
    previewMacros: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      marginTop: 4,
    },
    sectionTitle: {
      fontSize: 11,
      letterSpacing: 0.8,
      color: c.text,
      fontWeight: '700',
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      marginBottom: 8,
      marginTop: 4,
    },
    ingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: 6,
    },
    ingAmountWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    ingAmountInput: {
      width: 56,
      borderRadius: 8,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 4,
      paddingVertical: 4,
      fontSize: 12,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      textAlign: 'center',
    },
    ingUnit: {
      fontSize: 10,
      fontWeight: '700',
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
    },
    ingName: { fontSize: 13, color: c.text, fontFamily: 'DM Sans' },
    ingMeta: {
      fontSize: 10,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      marginTop: 1,
    },
    ingRemove: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.cardAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 12,
      backgroundColor: c.cardAlt,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: c.text,
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginBottom: 6,
      marginTop: 2,
    },
    searchInput: {
      flex: 1,
      fontSize: 13,
      color: c.text,
      fontFamily: 'DM Sans',
      padding: 0,
    },
    searchResult: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
    },
    searchResultName: {
      flex: 1,
      fontSize: 13,
      color: c.text,
      fontFamily: 'DM Sans',
    },
    pantryBadge: {
      fontSize: 9,
      fontWeight: '800',
      color: c.onAccent,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      backgroundColor: c.accent,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      overflow: 'hidden',
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
      marginTop: 4,
    },
    fieldLabel: {
      fontSize: 13,
      color: c.text,
      fontFamily: 'DM Sans',
      flex: 1,
    },
    fieldSuffix: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      width: 58,
    },
    fieldInput: {
      width: 84,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 8,
      paddingVertical: 6,
      fontSize: 13,
      color: c.text,
      fontFamily: 'DM Sans',
      textAlign: 'center',
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.cardAlt,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    stepBtn: {
      width: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepText: { fontSize: 15, color: c.text, fontWeight: '700' },
    stepValue: {
      fontSize: 14,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      minWidth: 20,
      textAlign: 'center',
    },
    hint: {
      fontSize: 10,
      color: c.textFaint,
      fontFamily: 'DM Sans',
      marginBottom: 10,
      lineHeight: 14,
    },
    categoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 6,
    },
    categoryValue: {
      flex: 1,
      fontSize: 13,
      color: c.text,
      fontFamily: 'DM Sans',
    },
    categoryTag: {
      fontSize: 9,
      fontWeight: '800',
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    catList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 10,
    },
    catChip: {
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.border,
      backgroundColor: c.card,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    catChipActive: { backgroundColor: c.accent, borderColor: c.text },
    catChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: c.textMuted,
      fontFamily: 'DM Sans',
    },
    catChipTextActive: { color: c.onAccent, fontWeight: '700' },
  });

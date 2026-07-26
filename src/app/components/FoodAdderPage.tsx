import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import {
  ChevronLeft,
  List,
  Search,
  ThumbsUp,
  ThumbsDown,
  PenLine,
  Plus,
  X,
} from './Icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { CATEGORY_ORDER } from '../lib/constants';
import type { Food, MyVotes, VoteDirection } from '../lib/types';
import { ThemeColors, useThemedStyles } from '../lib/theme';

interface FoodAdderPageProps {
  foods: Food[];
  pantryIds: string[];
  myVotes: MyVotes;
  onVote: (foodId: string, direction: VoteDirection) => void;
  onAddFood: (foodId: string) => void;
  onRemoveFood: (foodId: string) => void;
}

export default function FoodAdderPage({
  foods,
  pantryIds,
  myVotes,
  onVote,
  onAddFood,
  onRemoveFood,
}: FoodAdderPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const [query, setQuery] = useState('');
  const navigation = useNavigation();
  const route = useRoute();

  // Pre-selected category when arriving from a pantry section's add row.
  const initialCategory =
    (route.params as { category?: string } | undefined)?.category ?? null;
  const [category, setCategory] = useState<string | null>(initialCategory);
  // Sort mode behind the filter button: community likes or A–Z.
  const [sortMode, setSortMode] = useState<'likes' | 'alpha'>('likes');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const inPantrySet = new Set(pantryIds);

  const q = query.toLowerCase();
  const searching = q.length > 0;
  const filtered = foods.filter((f) => {
    const matchesQuery =
      !q ||
      f.name.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q);
    // Search supersedes the category chip: "Honey" finds honey even
    // while a meat category is selected.
    const matchesCategory = searching || !category || f.category === category;
    return matchesQuery && matchesCategory;
  });

  const bySort = (a: Food, b: Food) =>
    sortMode === 'alpha'
      ? a.name.localeCompare(b.name)
      : b.upvotes - a.upvotes;

  // Separate into available and in-pantry, each in the chosen sort
  const available = filtered.filter((f) => !inPantrySet.has(f.id)).sort(bySort);

  const inPantry = filtered.filter((f) => inPantrySet.has(f.id)).sort(bySort);

  const renderFoodItem = (food: Food) => {
    const myVote = myVotes[food.id] ?? null;
    const score = food.upvotes - food.downvotes;
    const isPantry = inPantrySet.has(food.id);

    return (
      <Pressable
        key={food.id}
        onPress={() => (isPantry ? onRemoveFood(food.id) : onAddFood(food.id))}
        onLongPress={() =>
          (navigation as any).navigate('FoodDetail', { foodId: food.id })
        }
        delayLongPress={350}
        style={[styles.foodItem, isPantry && styles.foodItemDisabled]}
      >
        <View style={styles.foodInfo}>
          <Text style={styles.foodName}>{food.name}</Text>
          <Text style={styles.foodMeta}>
            {food.category} · {food.servingLabel}
          </Text>
        </View>
        <View style={styles.foodActions}>
          <View style={styles.foodUploader}>
            <Text style={styles.uploaderName}>@{food.uploadedBy}</Text>
            {isPantry ? (
              <X size={15} color={c.textMuted} />
            ) : (
              <Plus size={15} color={c.textMuted} />
            )}
          </View>
          <View style={styles.voteButtons}>
            <Pressable onPress={() => onVote(food.id, 'up')} hitSlop={8}>
              <ThumbsUp size={13} color={myVote === 'up' ? c.text : c.textMuted} />
            </Pressable>
            <Text
              style={[
                styles.score,
                score >= 0 ? styles.scorePositive : styles.scoreNegative,
              ]}
            >
              {score}
            </Text>
            <Pressable onPress={() => onVote(food.id, 'down')} hitSlop={8}>
              <ThumbsDown
                size={13}
                color={myVote === 'down' ? c.danger : c.textMuted}
              />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={22} color={c.textMuted} />
        </Pressable>
        <Text style={styles.title}>Add to Pantry</Text>
        <View style={{ flex: 1 }} />
        {/* Sort/filter */}
        <Pressable
          onPress={() => setSortMenuOpen((o) => !o)}
          style={[styles.filterBtn, sortMenuOpen && styles.filterBtnActive]}
          hitSlop={6}
        >
          <List
            size={18}
            color={sortMenuOpen ? c.onAccent : c.text}
          />
        </Pressable>
      </View>

      {/* Sort menu */}
      {sortMenuOpen && (
        <View style={styles.sortMenu}>
          {(
            [
              ['likes', 'Most liked'],
              ['alpha', 'A – Z'],
            ] as const
          ).map(([mode, label]) => (
            <Pressable
              key={mode}
              onPress={() => {
                setSortMode(mode);
                setSortMenuOpen(false);
              }}
              style={[
                styles.sortOption,
                sortMode === mode && styles.sortOptionActive,
              ]}
            >
              <Text
                style={[
                  styles.sortOptionText,
                  sortMode === mode && styles.sortOptionTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Search size={16} color={c.textMuted} />
        <TextInput
          placeholder="Search foods or categories..."
          value={query}
          onChangeText={setQuery}
          placeholderTextColor={c.textMuted}
          style={styles.searchInput}
        />
      </View>

      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catChips}
        contentContainerStyle={{
          gap: 8,
          paddingHorizontal: 20,
          alignItems: 'center',
        }}
      >
        {CATEGORY_ORDER.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => setCategory(category === cat ? null : cat)}
            style={[
              styles.catChip,
              category === cat && styles.catChipActive,
              // Chips don't constrain results while a search is typed.
              searching && { opacity: 0.4 },
            ]}
          >
            <Text
              style={[
                styles.catChipText,
                category === cat && styles.catChipTextActive,
              ]}
            >
              {cat}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Food list */}
      <ScrollView style={styles.foodList} showsVerticalScrollIndicator={false}>
        {/* Submit custom food — always first */}
        <Pressable
          onPress={() => navigation.navigate('FoodEntry' as never)}
          style={styles.customFoodBtn}
        >
          <View style={styles.customFoodIcon}>
            <PenLine size={15} color={c.onPrimary} />
          </View>
          <View>
            <Text style={styles.customFoodTitle}>Submit a custom food…</Text>
            <Text style={styles.customFoodSub}>
              Add your own entry with full nutrition info
            </Text>
          </View>
        </Pressable>

        {/* Available foods section */}
        {available.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Available Foods</Text>
            {available.map(renderFoodItem)}
          </>
        )}

        {/* In Pantry foods section */}
        {inPantry.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Already in Pantry</Text>
            {inPantry.map(renderFoodItem)}
          </>
        )}

        {filtered.length === 0 && (
          <Text style={styles.emptyState}>No foods found</Text>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  backBtn: {
    padding: 4,
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: c.cardAlt,
    borderWidth: 2,
    borderColor: c.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: c.accent,
  },
  sortMenu: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  sortOption: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: c.cardAlt,
    borderWidth: 2,
    borderColor: c.text,
    paddingVertical: 8,
    alignItems: 'center',
  },
  sortOptionActive: {
    backgroundColor: c.accent,
  },
  sortOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textMuted,
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sortOptionTextActive: {
    color: c.onAccent,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: c.text,
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: c.card,
    borderWidth: 2,
    borderColor: c.text,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: c.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    color: c.text,
    fontSize: 14,
    fontFamily: 'DM Sans',
  },
  catChips: {
    flexGrow: 0,
    height: 48,
    marginBottom: 10,
  },
  catChip: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: c.cardAlt,
    borderWidth: 2,
    borderColor: c.text,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catChipActive: {
    backgroundColor: c.accent,
  },
  catChipText: {
    fontSize: 13,
    lineHeight: 16,
    color: c.textSoft,
    fontWeight: '700',
    fontFamily: 'Barlow Condensed',
    flexShrink: 0,
  },
  catChipTextActive: {
    color: c.onAccent,
  },
  foodList: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 8,
  },
  customFoodBtn: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.text,
    backgroundColor: c.tintLimeFaint,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  customFoodIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customFoodTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: c.text,
    fontFamily: 'DM Sans',
  },
  customFoodSub: {
    fontSize: 12,
    color: c.textMuted,
    fontFamily: 'DM Sans',
    marginTop: 2,
  },
  foodItem: {
    borderRadius: 12,
    backgroundColor: c.card,
    borderWidth: 2,
    borderColor: c.text,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    shadowColor: c.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  foodItemDisabled: {
    opacity: 0.5,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontSize: 14,
    fontWeight: '500',
    color: c.text,
    fontFamily: 'DM Sans',
  },
  foodMeta: {
    fontSize: 11,
    color: c.textMuted,
    fontFamily: 'DM Sans',
    marginTop: 4,
  },
  foodActions: {
    marginLeft: 12,
    gap: 12,
  },
  foodUploader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  uploaderName: {
    fontSize: 11,
    color: c.textMuted,
    fontFamily: 'Barlow Condensed',
  },
  voteButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  score: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Barlow Condensed',
  },
  scorePositive: {
    color: c.text,
  },
  scoreNegative: {
    color: c.danger,
  },
  sectionHeader: {
    fontSize: 12,
    letterSpacing: 0.6,
    color: c.textMuted,
    fontWeight: '600',
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyState: {
    fontSize: 14,
    color: c.textMuted,
    fontFamily: 'DM Sans',
    textAlign: 'center',
    marginTop: 32,
  },
});

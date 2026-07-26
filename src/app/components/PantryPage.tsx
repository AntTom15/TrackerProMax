import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import {
  NestableScrollContainer,
  NestableDraggableFlatList,
  ScaleDecorator,
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { ChevronLeft, Settings, List, Grid3x3, Plus, X } from './Icons';
import { useNavigation } from '@react-navigation/native';
import { CATEGORY_ORDER } from '../lib/constants';
import type { Food, PantryOrder } from '../lib/types';
import { ThemeColors, useThemedStyles } from '../lib/theme';

interface PantryPageProps {
  // The foods currently in the user's pantry.
  foods: Food[];
  // Optional per-category custom ordering, e.g. { 'Fatty Fish': ['f3', 'f1'] }.
  // Categories not present here (or foods not yet present in their array) fall back
  // to alphabetical order, which remains the default.
  customOrder?: PantryOrder;
  onRemoveItem: (foodId: string) => void;
  // Fired after a drag completes within a category, with the full new ordered id list
  // for that category. Parent owns persisting this into `customOrder`.
  onReorderItem: (category: string, orderedIds: string[]) => void;
}

function DragHandle() {
  const { c, styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.dragHandle}>
      <View style={styles.dragBar} />
      <View style={styles.dragBar} />
      <View style={styles.dragBar} />
    </View>
  );
}

export default function PantryPage({
  foods,
  customOrder = {},
  onRemoveItem,
  onReorderItem,
}: PantryPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const [view, setView] = useState<'list' | 'icon'>('list');
  const navigation = useNavigation();

  const grouped = CATEGORY_ORDER.reduce<Record<string, Food[]>>(
    (acc, cat) => {
      const matches = foods.filter((i) => i.category === cat);
      if (matches.length === 0) return acc;

      const order = customOrder[cat];

      if (order && order.length > 0) {
        // Respect the user's saved order first, then append any items that
        // aren't in it yet (e.g. newly added items) sorted alphabetically.
        const byId = new Map(matches.map((m) => [m.id, m]));
        const seen = new Set<string>();
        const ordered: Food[] = [];

        order.forEach((id) => {
          const item = byId.get(id);
          if (item) {
            ordered.push(item);
            seen.add(id);
          }
        });

        const remaining = matches
          .filter((m) => !seen.has(m.id))
          .sort((a, b) => a.name.localeCompare(b.name));

        acc[cat] = [...ordered, ...remaining];
      } else {
        acc[cat] = matches.slice().sort((a, b) => a.name.localeCompare(b.name));
      }

      return acc;
    },
    {}
  );

  const renderFoodItem = ({ item, drag, isActive }: RenderItemParams<Food>) => (
    <ScaleDecorator>
      <Pressable
        onPress={() =>
          (navigation as any).navigate('FoodDetail', { foodId: item.id })
        }
        onLongPress={drag}
        disabled={isActive}
        style={[styles.foodItem, isActive && styles.foodItemActive]}
      >
        <DragHandle />
        <Text style={styles.foodName}>{item.name}</Text>
        <Pressable
          onPress={() => onRemoveItem(item.id)}
          style={styles.removeBtn}
        >
          <X size={12} color={c.textMuted} />
        </Pressable>
      </Pressable>
    </ScaleDecorator>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {/* Back button and settings button */}
          <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <ChevronLeft size={22} color={c.textMuted} />
          </Pressable>
          <Pressable style={styles.headerBtn}>
            <Settings size={20} color={c.textMuted} />
          </Pressable>
        </View>
        <Text style={styles.title}>Pantry</Text>
        <View style={styles.viewToggle}>
          <Pressable
            onPress={() => setView('list')}
            style={[styles.toggleBtn, view === 'list' && styles.toggleBtnActive]}
          >
            <List size={12} color={view === 'list' ? c.onAccent : c.textMuted} />
            <Text
              style={[
                styles.toggleBtnText,
                view === 'list' && styles.toggleBtnTextActive,
              ]}
            >
              List
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setView('icon')}
            style={[styles.toggleBtn, view === 'icon' && styles.toggleBtnActive]}
          >
            <Grid3x3 size={12} color={view === 'icon' ? c.onAccent : c.textMuted} />
            <Text
              style={[
                styles.toggleBtnText,
                view === 'icon' && styles.toggleBtnTextActive,
              ]}
            >
              Icon
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Content */}
      <NestableScrollContainer
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {view === 'list' ? (
          <View style={styles.listContainer}>
            {Object.keys(grouped).length === 0 ? (
              <Text style={styles.emptyText}>Your pantry is empty.</Text>
            ) : (
              Object.entries(grouped).map(([category, foods]) => (
                <View key={category} style={styles.categorySection}>
                  <Text style={styles.categoryTitle}>{category}</Text>
                  <NestableDraggableFlatList
                    data={foods}
                    keyExtractor={(food) => food.id}
                    renderItem={renderFoodItem}
                    contentContainerStyle={styles.foodList}
                    onDragEnd={({ data }) =>
                      onReorderItem(category, data.map((food) => food.id))
                    }
                  />
                  {/* Category-scoped add: opens the adder pre-filtered */}
                  <Pressable
                    onPress={() =>
                      (navigation as any).navigate('FoodAdder', { category })
                    }
                    style={styles.addItemBtn}
                  >
                    <Plus size={14} color={c.textMuted} />
                    <Text style={styles.addItemText}>Add to {category}</Text>
                  </Pressable>
                </View>
              ))
            )}

          </View>
        ) : (
          /* Icon view */
          <View style={styles.iconGrid}>
            {foods
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((food) => (
                <Pressable
                  key={food.id}
                  onPress={() =>
                    (navigation as any).navigate('FoodDetail', {
                      foodId: food.id,
                    })
                  }
                  style={styles.iconCard}
                >
                  <Pressable
                    onPress={() => onRemoveItem(food.id)}
                    style={styles.removeIconBtn}
                  >
                    <X size={10} color={c.onPrimary} />
                  </Pressable>
                  <View style={styles.iconEmoji}>
                    <Text style={styles.emoji}>🥩</Text>
                  </View>
                  <Text style={styles.iconCardText}>{food.name}</Text>
                </Pressable>
              ))}
            <Pressable
              onPress={() => navigation.navigate('FoodAdder' as never)}
              style={styles.addIconBtn}
            >
              <Plus size={20} color={c.textMuted} />
              <Text style={styles.addIconText}>Add</Text>
            </Pressable>
          </View>
        )}
      </NestableScrollContainer>

      {/* Add foods — full browsable list */}
      <Pressable
        onPress={() => navigation.navigate('FoodAdder' as never)}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.7 }]}
      >
        <Plus size={26} color={c.onAccent} />
      </Pressable>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: c.text,
    fontFamily: 'Barlow Condensed',
    position: 'absolute',
    left: '50%',
    marginLeft: -30,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  viewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.cardAlt,
    borderRadius: 16,
    padding: 4,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  toggleBtnActive: {
    backgroundColor: c.accent,
  },
  toggleBtnText: {
    fontSize: 11,
    color: c.textMuted,
    fontWeight: '600',
    fontFamily: 'Barlow Condensed',
  },
  toggleBtnTextActive: {
    color: c.onAccent,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  listContainer: {
    paddingTop: 12,
    gap: 20,
  },
  categorySection: {
    gap: 8,
  },
  categoryTitle: {
    fontSize: 10,
    letterSpacing: 0.8,
    color: c.text,
    fontWeight: '700',
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  foodList: {
    gap: 4,
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    backgroundColor: c.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: c.text,
  },
  foodItemActive: {
    backgroundColor: c.cardAlt,
    borderColor: c.border,
  },
  dragHandle: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    gap: 3,
    marginRight: 10,
  },
  dragBar: {
    height: 2,
    borderRadius: 1,
    backgroundColor: c.border,
  },
  foodName: {
    fontSize: 14,
    color: c.text,
    flex: 1,
    fontFamily: 'DM Sans',
  },
  removeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: c.text,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  addItemText: {
    fontSize: 14,
    color: c.textMuted,
    fontFamily: 'DM Sans',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: c.accent,
    borderWidth: 2,
    borderColor: c.text,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: c.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 12,
  },
  iconCard: {
    width: '31%',
    borderRadius: 12,
    backgroundColor: c.card,
    borderWidth: 2,
    borderColor: c.text,
    paddingHorizontal: 8,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 8,
    shadowColor: c.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  removeIconBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: c.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  iconEmoji: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: c.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 24,
  },
  iconCardText: {
    fontSize: 11,
    color: c.text,
    fontFamily: 'DM Sans',
    textAlign: 'center',
  },
  addIconBtn: {
    width: '31%',
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: c.text,
    paddingHorizontal: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
    gap: 8,
    shadowColor: c.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  addIconText: {
    fontSize: 11,
    color: c.textMuted,
    fontFamily: 'DM Sans',
  },
  emptyText: {
    textAlign: 'center',
    color: c.textMuted,
    fontSize: 14,
    marginTop: 80,
    fontFamily: 'DM Sans',
  },
});
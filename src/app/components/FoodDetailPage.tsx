import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { X, Plus, Check, ThumbsUp, ThumbsDown } from './Icons';
import { NUTRIENT_SECTIONS, nutrientAmount } from '../lib/nutrients';
import { ThemeColors, useThemedStyles } from '../lib/theme';
import type { Food, MyVotes, VoteDirection } from '../lib/types';

interface FoodDetailPageProps {
  foods: Food[];
  pantryIds: string[];
  myVotes: MyVotes;
  onVote: (foodId: string, direction: VoteDirection) => void;
  onAddFood: (foodId: string) => void;
  onRemoveFood: (foodId: string) => void;
}

const fmt = (n: number) =>
  n >= 100
    ? Math.round(n).toString()
    : n >= 10
      ? (Math.round(n * 10) / 10).toString()
      : (Math.round(n * 100) / 100).toString();

export default function FoodDetailPage({
  foods,
  pantryIds,
  myVotes,
  onVote,
  onAddFood,
  onRemoveFood,
}: FoodDetailPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const navigation = useNavigation();
  const route = useRoute();
  const foodId = (route.params as { foodId?: string } | undefined)?.foodId;

  const food = foods.find((f) => f.id === foodId);
  if (!food) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Food not found.</Text>
      </View>
    );
  }

  const inPantry = pantryIds.includes(food.id);
  const myVote = myVotes[food.id] ?? null;

  return (
    <View style={styles.container}>
      {/* Header: name at the very top, back button top right */}
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.name}>{food.name}</Text>
          <Text style={styles.uploader}>@{food.uploadedBy}</Text>
        </View>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={8}
        >
          <X size={18} color={c.text} />
        </Pressable>
      </View>

      {/* Votes — live, same toggle behaviour as the list */}
      <View style={styles.voteRow}>
        <Pressable
          onPress={() => onVote(food.id, 'up')}
          style={[styles.voteBtn, myVote === 'up' && styles.voteBtnUp]}
        >
          <ThumbsUp
            size={14}
            color={myVote === 'up' ? c.onAccent : c.textMuted}
          />
          <Text
            style={[styles.voteCount, myVote === 'up' && { color: c.onAccent }]}
          >
            {food.upvotes}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onVote(food.id, 'down')}
          style={[styles.voteBtn, myVote === 'down' && styles.voteBtnDown]}
        >
          <ThumbsDown
            size={14}
            color={myVote === 'down' ? c.onPrimary : c.textMuted}
          />
          <Text
            style={[
              styles.voteCount,
              myVote === 'down' && { color: c.onPrimary },
            ]}
          >
            {food.downvotes}
          </Text>
        </Pressable>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{food.category}</Text>
        </View>
      </View>

      <Text style={styles.servingLine}>
        Per serving — {food.servingLabel}
        {food.isRecipe ? ' · recipe' : ''}
      </Text>

      {/* Recipes list what they're made of, so the derived numbers
          above are inspectable rather than magic. */}
      {food.isRecipe && !!food.ingredientCategories?.length && (
        <Text style={styles.recipeIngredients}>
          Made from: {food.ingredientCategories.join(' · ')}
        </Text>
      )}

      {/* Full nutrient profile */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {NUTRIENT_SECTIONS.map((section) => {
          const items = section.items.filter((info) =>
            // Derived rows show when any of their sources is present.
            info.sources
              ? info.sources.some((k) => food.nutrients?.[k] !== undefined)
              : food.nutrients?.[info.key as keyof typeof food.nutrients] !==
                undefined
          );
          if (items.length === 0) return null;
          return (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.card}>
                {items.map((info) => (
                  <View key={info.key} style={styles.row}>
                    <Text style={styles.rowLabel}>{info.label}</Text>
                    <Text style={styles.rowValue}>
                      {fmt(nutrientAmount(info, food.nutrients))}
                      <Text style={styles.rowUnit}> {info.unit}</Text>
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add / remove FAB — circular, bottom right */}
      <Pressable
        onPress={() =>
          inPantry ? onRemoveFood(food.id) : onAddFood(food.id)
        }
        style={({ pressed }) => [
          styles.fab,
          inPantry && styles.fabInPantry,
          pressed && { opacity: 0.7 },
        ]}
      >
        {inPantry ? (
          <Check size={26} color={c.onPrimary} />
        ) : (
          <Plus size={26} color={c.onAccent} />
        )}
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
      alignItems: 'flex-start',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 8,
    },
    name: {
      fontSize: 26,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    uploader: {
      fontSize: 12,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      marginTop: 2,
    },
    backBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.cardAlt,
      borderWidth: 2,
      borderColor: c.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
    voteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 20,
      marginBottom: 10,
    },
    voteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.text,
      backgroundColor: c.cardAlt,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    voteBtnUp: {
      backgroundColor: c.accent,
    },
    voteBtnDown: {
      backgroundColor: c.primary,
    },
    voteCount: {
      fontSize: 13,
      fontWeight: '800',
      color: c.text,
      fontFamily: 'Barlow Condensed',
    },
    categoryBadge: {
      marginLeft: 'auto',
      borderRadius: 10,
      backgroundColor: c.cardAlt,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    categoryBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: c.textMuted,
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    servingLine: {
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'DM Sans',
      paddingHorizontal: 20,
      marginBottom: 10,
    },
    recipeIngredients: {
      fontSize: 11,
      color: c.accentDeep,
      fontFamily: 'DM Sans',
      paddingHorizontal: 20,
      marginTop: -4,
      marginBottom: 10,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    section: {
      marginBottom: 14,
    },
    sectionTitle: {
      fontSize: 10,
      letterSpacing: 0.8,
      color: c.text,
      fontWeight: '700',
      fontFamily: 'Barlow Condensed',
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    card: {
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.text,
      paddingHorizontal: 16,
      paddingVertical: 4,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
    },
    rowLabel: {
      fontSize: 13,
      color: c.text,
      fontFamily: 'DM Sans',
      flex: 1,
    },
    rowValue: {
      fontSize: 13,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'Barlow Condensed',
    },
    rowUnit: {
      fontSize: 11,
      fontWeight: '400',
      color: c.textMuted,
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
    fabInPantry: {
      backgroundColor: c.primary,
    },
    emptyText: {
      textAlign: 'center',
      color: c.textMuted,
      fontSize: 13,
      fontFamily: 'DM Sans',
      marginTop: 80,
    },
  });

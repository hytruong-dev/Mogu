import { useMemo, useState } from 'react';
import {
  Dimensions,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  BarChart3,
  Bookmark,
  ChevronRight,
  Clock3,
  Users,
} from 'lucide-react-native';
import { AppImage } from '../../components/ui/app-image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Text as UiText } from '../../components/ui/text';
import {
  BORDER,
  CREAM,
  INK,
  MUTED,
  ORANGE_QTY,
  PILL_BG,
  TERTIARY,
  WHITE,
  YELLOW,
  cardShadow,
} from './tokens';
import type { DishIngredient, DishNutrition, DishRecipeStep } from './types';
import {
  difficultyLabel,
  formatQuantityUnit,
  groupIngredients,
  ingredientDisplayName,
  normalizeSteps,
  totalStepsDurationMin,
} from './utils';
import { useDishSave } from './useDishActions';
import { NutritionSheet } from './NutritionSheet';

const { width: SW } = Dimensions.get('window');
const H_PAD = 16;
const GRID_GAP = 8;
const COL_W = Math.floor((SW - H_PAD * 2 - GRID_GAP * 3) / 4);

type Props = {
  dishId?: string;
  dishName: string;
  image?: ImageSourcePropType;
  isSavedInitial?: boolean;
  servings?: number | null;
  timeLabel?: string | null;
  difficulty?: string | null;
  nutrition?: DishNutrition | null;
  ingredients?: DishIngredient[];
  recipeSteps?: DishRecipeStep[];
  videoUrl?: string | null;
  onBack: () => void;
  onStartCook: () => void;
};

export function RecipePage({
  dishId,
  dishName,
  image,
  isSavedInitial,
  servings: baseServingsProp,
  timeLabel,
  difficulty,
  nutrition,
  ingredients = [],
  recipeSteps = [],
  videoUrl,
  onBack,
  onStartCook,
}: Props) {
  const insets = useSafeAreaInsets();
  const { isSaved, toggleSave } = useDishSave(dishId, isSavedInitial);
  const baseServings = baseServingsProp && baseServingsProp > 0 ? baseServingsProp : 4;
  const [servings, setServings] = useState(baseServings);
  const [tab, setTab] = useState('ingredients');
  const [nutritionOpen, setNutritionOpen] = useState(false);

  const steps = useMemo(() => normalizeSteps(recipeSteps), [recipeSteps]);
  const totalDur = totalStepsDurationMin(recipeSteps);
  const groups = useMemo(() => groupIngredients(ingredients), [ingredients]);
  const flatIngredients = useMemo(
    () => ingredients.map((ing, index) => ({ ing, index })),
    [ingredients],
  );
  const hasGroups = groups.some((g) => !!g.label);
  const diff = difficultyLabel(difficulty);
  const kcal = nutrition?.calories != null ? Math.round(Number(nutrition.calories)) : null;

  const renderIngredientCard = (ing: DishIngredient, index: number) => {
    const qty = formatQuantityUnit(ing.quantity, ing.unit, baseServings, servings);
    const name = ingredientDisplayName(ing);
    return (
      <View key={`ing-${index}`} style={styles.ingCard}>
        <View style={styles.ingImgWrap}>
          {ing.imageUrl ? (
            <AppImage uri={ing.imageUrl} style={styles.ingImg} contentFit="cover" />
          ) : (
            <View style={[styles.ingImg, styles.ingImgPh]} />
          )}
        </View>
        <Text style={styles.ingName} numberOfLines={1} ellipsizeMode="tail">
          {name}
          {ing.isOptional ? ' (tuỳ chọn)' : ''}
        </Text>
        {qty ? (
          <Text style={styles.ingQty} numberOfLines={1}>
            {qty}
          </Text>
        ) : (
          <Text style={[styles.ingQty, { opacity: 0 }]} numberOfLines={1}>
            -
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.iconBtn} accessibilityLabel="Quay lại">
          <ArrowLeft size={22} color={INK} />
        </Pressable>
        <Text style={styles.headerTitle}>Công thức</Text>
        <Pressable
          onPress={() => void toggleSave()}
          style={styles.iconBtn}
          accessibilityLabel={isSaved ? 'Bỏ lưu' : 'Lưu món'}
        >
          <Bookmark size={20} color={INK} fill={isSaved ? INK : 'transparent'} />
        </Pressable>
      </View>

      <View style={styles.summary}>
        <View style={styles.thumbWrap}>
          {image ? (
            <AppImage source={image} style={styles.thumb} contentFit="cover" />
          ) : (
            <View style={[styles.thumb, { backgroundColor: BORDER }]} />
          )}
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={styles.dishName} numberOfLines={2}>
            {dishName}
          </Text>
          <View style={styles.pills}>
            <View style={styles.pill}>
              <Users size={13} color={MUTED} />
              <Text style={styles.pillText}>{baseServings} người</Text>
            </View>
            {timeLabel ? (
              <View style={styles.pill}>
                <Clock3 size={13} color={MUTED} />
                <Text style={styles.pillText}>{timeLabel}</Text>
              </View>
            ) : null}
            {diff ? (
              <View style={styles.pill}>
                <BarChart3 size={13} color={MUTED} />
                <Text style={styles.pillText}>{diff}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex-1"
        style={styles.tabsRoot}
      >
        <View style={styles.tabsBar}>
          <TabsList className="h-auto w-full flex-row rounded-full bg-white p-1" style={styles.tabsList}>
            <TabsTrigger
              value="ingredients"
              className="flex-1 rounded-full border-0 shadow-none"
              style={StyleSheet.flatten([styles.trigger, tab === 'ingredients' && styles.triggerActive])}
            >
              <UiText
                className="text-[14px]"
                style={StyleSheet.flatten([styles.triggerText, tab === 'ingredients' && styles.triggerTextActive])}
              >
                Nguyên liệu
              </UiText>
            </TabsTrigger>
            <TabsTrigger
              value="steps"
              className="flex-1 rounded-full border-0 shadow-none"
              style={StyleSheet.flatten([styles.trigger, tab === 'steps' && styles.triggerActive])}
            >
              <UiText
                className="text-[14px]"
                style={StyleSheet.flatten([styles.triggerText, tab === 'steps' && styles.triggerTextActive])}
              >
                {steps.length} bước
              </UiText>
            </TabsTrigger>
          </TabsList>
        </View>

        <TabsContent value="ingredients" className="flex-1" style={styles.tabContent}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 110 + insets.bottom, paddingHorizontal: H_PAD }}
          >
            {ingredients.length === 0 ? (
              <Text style={styles.emptyNote}>Chưa có danh sách nguyên liệu.</Text>
            ) : hasGroups ? (
              groups.map((g, gi) => (
                <View key={`g-${gi}`} style={{ marginTop: gi === 0 ? 4 : 14 }}>
                  {g.label ? <Text style={styles.groupLabel}>{g.label}</Text> : null}
                  <View style={styles.grid}>
                    {g.items.map(({ ing, index }) => renderIngredientCard(ing, index))}
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.grid}>
                {flatIngredients.map(({ ing, index }) => renderIngredientCard(ing, index))}
              </View>
            )}

            {kcal != null ? (
              <Pressable
                onPress={() => setNutritionOpen(true)}
                style={styles.nutritionRow}
                accessibilityLabel="Xem dinh dưỡng"
              >
                <BarChart3 size={18} color={INK} />
                <Text style={styles.nutritionText}>
                  Dinh dưỡng • {kcal} kcal/khẩu phần
                </Text>
                <ChevronRight size={18} color={TERTIARY} />
              </Pressable>
            ) : null}
          </ScrollView>
        </TabsContent>

        <TabsContent value="steps" className="flex-1" style={styles.tabContent}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 110 + insets.bottom, paddingHorizontal: H_PAD }}
          >
            <Text style={styles.sectionTitle}>Cách chế biến</Text>
            <Text style={styles.stepsSummary}>
              {steps.length} bước
              {totalDur != null ? ` · khoảng ${totalDur} phút` : ''}
            </Text>

            {steps.map((st) => (
              <View key={`step-${st.stepOrder}`} style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{st.stepOrder}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle} numberOfLines={2}>
                    {st.title}
                  </Text>
                  {st.durationMin != null ? (
                    <Text style={styles.stepDur}>{st.durationMin} phút</Text>
                  ) : null}
                </View>
              </View>
            ))}

            {steps.length === 0 ? (
              <Text style={styles.emptyNote}>Chưa có các bước chế biến.</Text>
            ) : null}

            {videoUrl ? (
              <View style={styles.videoNote}>
                <Text style={styles.emptyNote}>Video: có sẵn (phát trong phiên bản sau).</Text>
              </View>
            ) : null}
          </ScrollView>
        </TabsContent>
      </Tabs>

      <View style={[styles.footer, { paddingBottom: Math.max(12, insets.bottom) }]}>
        <Pressable
          onPress={onStartCook}
          disabled={steps.length === 0}
          style={[styles.cta, steps.length === 0 && { opacity: 0.5 }]}
          accessibilityLabel="Bắt đầu nấu"
        >
          <Text style={styles.ctaText}>Bắt đầu nấu</Text>
        </Pressable>
      </View>

      <NutritionSheet
        open={nutritionOpen}
        onOpenChange={setNutritionOpen}
        nutrition={nutrition}
        servings={servings}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: INK },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: H_PAD,
    paddingBottom: 12,
  },
  thumbWrap: { borderRadius: 16, overflow: 'hidden' },
  thumb: { width: 80, height: 80, borderRadius: 16 },
  dishName: { fontSize: 20, fontWeight: '800', color: INK, letterSpacing: -0.3 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PILL_BG,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: { fontSize: 12, fontWeight: '600', color: MUTED },
  tabsRoot: { flex: 1 },
  tabsBar: { paddingHorizontal: H_PAD, paddingBottom: 10 },
  tabsList: {
    backgroundColor: WHITE,
    borderRadius: 999,
    padding: 4,
    width: '100%',
    ...cardShadow,
  },
  trigger: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  triggerActive: { backgroundColor: YELLOW },
  triggerText: { fontSize: 14, fontWeight: '600', color: MUTED, textAlign: 'center' },
  triggerTextActive: { color: INK, fontWeight: '800' },
  tabContent: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: INK },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    alignItems: 'flex-start',
    alignContent: 'flex-start',
  },
  ingCard: {
    width: COL_W,
    backgroundColor: WHITE,
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 8,
    alignItems: 'center',
    alignSelf: 'flex-start',
    ...cardShadow,
  },
  ingImgWrap: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F0EBE0',
  },
  ingImg: { width: '100%', height: '100%' },
  ingImgPh: { backgroundColor: '#F0EBE0' },
  ingName: {
    width: '100%',
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: INK,
    textAlign: 'center',
    lineHeight: 14,
  },
  ingQty: {
    width: '100%',
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: ORANGE_QTY,
    textAlign: 'center',
    lineHeight: 14,
  },
  nutritionRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: WHITE,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
    ...cardShadow,
  },
  nutritionText: { flex: 1, fontSize: 14, fontWeight: '600', color: INK },
  stepsSummary: { fontSize: 13, color: MUTED, marginTop: 4, marginBottom: 8 },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: WHITE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { fontSize: 13, fontWeight: '700', color: INK },
  stepTitle: { fontSize: 15, fontWeight: '700', color: INK },
  stepDur: { fontSize: 13, color: MUTED, marginTop: 2 },
  emptyNote: { fontSize: 14, color: MUTED, marginTop: 8 },
  videoNote: { marginTop: 12 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: CREAM,
  },
  cta: {
    minHeight: 54,
    borderRadius: 999,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  ctaText: { fontSize: 16, fontWeight: '800', color: INK },
});

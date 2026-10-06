import { useMemo, useState } from 'react';
import {
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
  Check,
  ChefHat,
  ChevronRight,
  Clock3,
  Minus,
  Plus,
  Salad,
  Users,
} from '@/components/icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
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
import { parseCookingVideo } from './video';
import { VideoGuideRow, VideoPlayerModal } from './VideoGuide';

const H_PAD = 16;

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
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const video = useMemo(() => parseCookingVideo(videoUrl), [videoUrl]);
  const [videoOpen, setVideoOpen] = useState(false);
  const thumbUri =
    image && typeof image === 'object' && !Array.isArray(image) && 'uri' in image
      ? (image.uri ?? null)
      : null;

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

  const [checked, setChecked] = useState<Set<number>>(() => new Set());
  const toggleChecked = (index: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const renderIngredientCard = (ing: DishIngredient, index: number, isLastRow: boolean) => {
    const qty = formatQuantityUnit(ing.quantity, ing.unit, baseServings, servings);
    const name = ingredientDisplayName(ing);
    const isChecked = checked.has(index);
    return (
      <Animated.View
        key={`ing-${index}`}
        entering={FadeInDown.delay(Math.min(index, 12) * 25).duration(220)}
      >
        <Pressable
          onPress={() => toggleChecked(index)}
          style={[styles.ingRow, !isLastRow && styles.ingRowDivider]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isChecked }}
          accessibilityLabel={`${name}${qty ? `, ${qty}` : ''}`}
        >
          <View style={styles.ingImgWrap}>
            {ing.imageUrl ? (
              <AppImage uri={ing.imageUrl} style={styles.ingImg} contentFit="cover" />
            ) : (
              <View style={[styles.ingImg, styles.ingImgPh]}>
                <Salad size={18} color="#C9A64A" />
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.ingName, isChecked && styles.ingNameChecked]} numberOfLines={2}>
              {name}
            </Text>
            {ing.isOptional ? <Text style={styles.ingOptional}>Tuỳ chọn</Text> : null}
          </View>
          {qty ? <Text style={[styles.ingQty, isChecked && styles.ingNameChecked]}>{qty}</Text> : null}
          <View style={[styles.check, isChecked && styles.checkOn]}>
            {isChecked ? <Check size={14} color={INK} strokeWidth={3} /> : null}
          </View>
        </Pressable>
      </Animated.View>
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
          <TabsList className="h-auto w-full flex-row rounded-full bg-card p-1" style={styles.tabsList}>
            <TabsTrigger
              value="ingredients"
              className="flex-1 rounded-full border-0 shadow-none"
              style={StyleSheet.flatten([styles.trigger, tab === 'ingredients' && styles.triggerActive])}
            >
              <UiText
                className="text-[14px]"
                style={StyleSheet.flatten([styles.triggerText, tab === 'ingredients' && styles.triggerTextActive])}
              >
                Nguyên liệu ({ingredients.length})
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
                Cách làm ({steps.length})
              </UiText>
            </TabsTrigger>
          </TabsList>
        </View>

        <TabsContent value="ingredients" className="flex-1" style={styles.tabContent}>
          <Animated.ScrollView
            key="tab-ing"
            entering={FadeIn.duration(220)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 110 + insets.bottom, paddingHorizontal: H_PAD, paddingTop: 4 }}
          >
            {ingredients.length > 0 ? (
              <View style={styles.servingsBar}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.servingsTitle}>Khẩu phần</Text>
                  <Text style={styles.servingsSub}>
                    Đã chuẩn bị {checked.size}/{ingredients.length}
                  </Text>
                </View>
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => setServings((v) => Math.max(1, v - 1))}
                    disabled={servings <= 1}
                    style={[styles.stepperBtn, servings <= 1 && { opacity: 0.4 }]}
                    accessibilityLabel="Giảm khẩu phần"
                    hitSlop={6}
                  >
                    <Minus size={16} color={INK} strokeWidth={2.6} />
                  </Pressable>
                  <View style={styles.stepperVal}>
                    <Users size={14} color={MUTED} />
                    <Text style={styles.stepperText}>{servings}</Text>
                  </View>
                  <Pressable
                    onPress={() => setServings((v) => Math.min(20, v + 1))}
                    style={styles.stepperBtn}
                    accessibilityLabel="Tăng khẩu phần"
                    hitSlop={6}
                  >
                    <Plus size={16} color={INK} strokeWidth={2.6} />
                  </Pressable>
                </View>
              </View>
            ) : null}

            {ingredients.length === 0 ? (
              <Text style={styles.emptyNote}>Chưa có danh sách nguyên liệu.</Text>
            ) : hasGroups ? (
              groups.map((g, gi) => (
                <View key={`g-${gi}`} style={{ marginTop: 14 }}>
                  {g.label ? <Text style={styles.groupLabel}>{g.label}</Text> : null}
                  <View style={styles.listCard}>
                    {g.items.map(({ ing, index }, i) =>
                      renderIngredientCard(ing, index, i === g.items.length - 1),
                    )}
                  </View>
                </View>
              ))
            ) : (
              <View style={[styles.listCard, { marginTop: 14 }]}>
                {flatIngredients.map(({ ing, index }, i) =>
                  renderIngredientCard(ing, index, i === flatIngredients.length - 1),
                )}
              </View>
            )}

            {kcal != null ? (
              <Pressable
                onPress={() => setNutritionOpen(true)}
                style={styles.nutritionRow}
                accessibilityLabel="Xem dinh dưỡng"
              >
                <View style={styles.nutritionIcon}>
                  <BarChart3 size={18} color={INK} />
                </View>
                <Text style={styles.nutritionText}>
                  Dinh dưỡng • {kcal} kcal/khẩu phần
                </Text>
                <ChevronRight size={18} color={TERTIARY} />
              </Pressable>
            ) : null}
          </Animated.ScrollView>
        </TabsContent>

        <TabsContent value="steps" className="flex-1" style={styles.tabContent}>
          <Animated.ScrollView
            key="tab-steps"
            entering={FadeIn.duration(220)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 110 + insets.bottom, paddingHorizontal: H_PAD, paddingTop: 4 }}
          >
            {video ? (
              <View style={styles.videoRowWrap}>
                <VideoGuideRow
                  video={video}
                  fallbackImage={thumbUri}
                  onPress={() => setVideoOpen(true)}
                />
              </View>
            ) : null}

            <Text style={styles.stepsSummary}>
              {steps.length} bước
              {totalDur != null ? ` · khoảng ${totalDur} phút` : ''} · chạm để xem chi tiết
            </Text>

            <View style={styles.stepList}>
              {steps.map((st, i) => {
                const open = expandedStep === i;
                const preview = (st.body ?? '').trim();
                const hasDur = st.durationMin != null && st.durationMin > 0;
                return (
                  <Animated.View
                    key={`step-${st.stepOrder}`}
                    entering={FadeInDown.delay(Math.min(i, 10) * 35).duration(240)}
                    style={styles.stepRow}
                  >
                    <View style={styles.stepRail}>
                      <View style={styles.stepNum}>
                        <Text style={styles.stepNumText}>{st.stepOrder}</Text>
                      </View>
                      {i < steps.length - 1 ? <View style={styles.stepLine} /> : null}
                    </View>
                    <Pressable
                      onPress={() => setExpandedStep(open ? null : i)}
                      style={styles.stepBody}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open }}
                    >
                      <View style={styles.stepHead}>
                        <Text style={styles.stepTitle} numberOfLines={open ? undefined : 2}>
                          {st.title}
                        </Text>
                        {hasDur ? (
                          <View style={styles.stepDurPill}>
                            <Clock3 size={12} color={MUTED} />
                            <Text style={styles.stepDur}>{st.durationMin}′</Text>
                          </View>
                        ) : null}
                      </View>
                      {preview && preview !== st.title ? (
                        <Text style={styles.stepPreview} numberOfLines={open ? undefined : 2}>
                          {preview}
                        </Text>
                      ) : null}
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            {steps.length === 0 ? (
              <Text style={styles.emptyNote}>Chưa có các bước chế biến.</Text>
            ) : null}
          </Animated.ScrollView>
        </TabsContent>
      </Tabs>

      <View style={[styles.footer, { paddingBottom: Math.max(12, insets.bottom) }]}>
        <Pressable
          onPress={onStartCook}
          disabled={steps.length === 0}
          style={[styles.cta, steps.length === 0 && { opacity: 0.5 }]}
          accessibilityLabel="Bắt đầu nấu"
        >
          <ChefHat size={20} color={INK} />
          <Text style={styles.ctaText}>
            Bắt đầu nấu{steps.length > 0 ? ` · ${steps.length} bước` : ''}
          </Text>
        </Pressable>
      </View>

      <NutritionSheet
        open={nutritionOpen}
        onOpenChange={setNutritionOpen}
        nutrition={nutrition}
        servings={servings}
      />

      <VideoPlayerModal
        video={video}
        visible={videoOpen}
        title={dishName}
        onClose={() => setVideoOpen(false)}
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
  servingsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  servingsTitle: { fontSize: 15, fontWeight: '800', color: INK },
  servingsSub: { fontSize: 12.5, color: MUTED, marginTop: 2 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CREAM,
    borderRadius: 999,
    padding: 4,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperVal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 52,
    justifyContent: 'center',
  },
  stepperText: { fontSize: 15, fontWeight: '800', color: INK },
  listCard: {
    backgroundColor: WHITE,
    borderRadius: 18,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  ingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    minHeight: 60,
  },
  ingRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0EADF' },
  ingImgWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFF6DC',
  },
  ingImg: { width: '100%', height: '100%' },
  ingImgPh: { backgroundColor: '#FFF6DC', alignItems: 'center', justifyContent: 'center' },
  ingName: { fontSize: 15, fontWeight: '600', color: INK, lineHeight: 20 },
  ingNameChecked: { color: TERTIARY, textDecorationLine: 'line-through' },
  ingOptional: { fontSize: 12, color: TERTIARY, marginTop: 1 },
  ingQty: { fontSize: 14, fontWeight: '700', color: ORANGE_QTY },
  check: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  checkOn: { backgroundColor: YELLOW, borderColor: YELLOW },
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
  nutritionText: { flex: 1, fontSize: 14, fontWeight: '700', color: INK },
  nutritionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFF2B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoRowWrap: { marginTop: 4, marginBottom: 12 },
  stepsSummary: { fontSize: 13, color: MUTED, marginTop: 2, marginBottom: 6 },
  stepHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  stepPreview: { fontSize: 13.5, lineHeight: 20, color: MUTED },
  stepList: { marginTop: 6 },
  stepRow: { flexDirection: 'row', gap: 12 },
  stepRail: { width: 32, alignItems: 'center' },
  stepNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  stepLine: { flex: 1, width: 2, borderRadius: 1, backgroundColor: '#F1E4BE', marginVertical: 4 },
  stepBody: {
    flex: 1,
    backgroundColor: WHITE,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  stepNumText: { fontSize: 14, fontWeight: '800', color: INK },
  stepTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: INK, lineHeight: 21 },
  stepDurPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PILL_BG,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stepDur: { fontSize: 12, fontWeight: '600', color: MUTED },
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
    minHeight: 56,
    borderRadius: 999,
    backgroundColor: YELLOW,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C79200',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  ctaText: { fontSize: 16, fontWeight: '800', color: INK },
});

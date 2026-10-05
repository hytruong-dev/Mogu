import { useState } from 'react';
import {
  Dimensions,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  ChefHat,
  ChevronRight,
  Clock3,
  Flame,
  Info,
  MapPin,
  Mic,
  Salad,
  Share2,
  ShieldCheck,
  Tag,
} from '@/components/icons';
import { AppImage } from '../../components/ui/app-image';
import { BORDER, CREAM, INK, MUTED, TERTIARY, WHITE, YELLOW, YELLOW_SOFT } from './tokens';
import type { AllergenAssessment, DishAllergen, DishIngredient, DishNutrition } from './types';
import { assessAllergens, formatKcalLabel, ingredientDisplayName } from './utils';
import { shareDish, useDishSave } from './useDishActions';

const { width: SW, height: SH } = Dimensions.get('window');
const HERO_H = Math.round(Math.min(SW * 0.92, SH * 0.4));
const PREVIEW_MAX = 8;

type Props = {
  dishId?: string;
  dishName: string;
  image?: ImageSourcePropType;
  isSavedInitial?: boolean;
  shortDescription?: string | null;
  priceLabel?: string | null;
  timeLabel?: string | null;
  nutrition?: DishNutrition | null;
  allergens?: DishAllergen[];
  ingredients?: DishIngredient[];
  ingredientCount: number;
  stepCount: number;
  onBack: () => void;
  onCook: () => void;
  onNearby: () => void;
};

type Stat = {
  key: string;
  icon: typeof Clock3;
  value: string;
  label: string;
  tint: string;
  iconColor: string;
};

function fmtGram(v: number | null | undefined): string | null {
  if (v == null || Number.isNaN(Number(v))) return null;
  const n = Number(v);
  return `${n >= 10 ? Math.round(n) : Math.round(n * 10) / 10}g`;
}

export function OverviewPage({
  dishId,
  dishName,
  image,
  isSavedInitial,
  shortDescription,
  priceLabel,
  timeLabel,
  nutrition,
  allergens = [],
  ingredients = [],
  ingredientCount,
  stepCount,
  onBack,
  onCook,
  onNearby,
}: Props) {
  const insets = useSafeAreaInsets();
  const { isSaved, toggleSave } = useDishSave(dishId, isSavedInitial);
  const [descExpanded, setDescExpanded] = useState(false);
  const assessment: AllergenAssessment = assessAllergens(allergens);
  const kcal = formatKcalLabel(nutrition?.calories ?? null);
  const desc = (shortDescription ?? '').trim();
  const descLong = desc.length > 110;
  const canCook = stepCount > 0;
  const preview = ingredients.slice(0, PREVIEW_MAX);
  const moreCount = Math.max(0, ingredientCount - preview.length);

  const stats = [
    timeLabel
      ? { key: 'time', icon: Clock3, value: timeLabel, label: 'Thời gian', tint: '#FFF1E6', iconColor: '#E07A2E' }
      : null,
    kcal
      ? { key: 'kcal', icon: Flame, value: kcal, label: 'Năng lượng', tint: '#FFF4D6', iconColor: '#E0A100' }
      : null,
    priceLabel
      ? { key: 'price', icon: Tag, value: priceLabel, label: 'Giá tham khảo', tint: '#EAF6EC', iconColor: '#2F9E44' }
      : null,
  ].filter(Boolean) as Stat[];

  const macros = [
    { key: 'p', label: 'Đạm', value: fmtGram(nutrition?.proteinG), color: '#4C8DF6' },
    { key: 'c', label: 'Tinh bột', value: fmtGram(nutrition?.carbsG), color: '#F5A623' },
    { key: 'f', label: 'Chất béo', value: fmtGram(nutrition?.fatG), color: '#E5603B' },
    { key: 'fi', label: 'Chất xơ', value: fmtGram(nutrition?.fiberG), color: '#2F9E44' },
  ].filter((m) => m.value != null) as Array<{ key: string; label: string; value: string; color: string }>;

  const allergenTone =
    assessment.status === 'CONTAINS'
      ? { bg: '#FFF4E5', border: '#FCD9A8', fg: '#92400E', Icon: AlertTriangle, iconColor: '#D97706' }
      : assessment.status === 'NOT_DETECTED'
        ? { bg: '#EEF8F0', border: '#CDEBD3', fg: '#1F6B33', Icon: ShieldCheck, iconColor: '#2F9E44' }
        : { bg: '#F5F3EE', border: '#E9E4D9', fg: MUTED, Icon: Info, iconColor: TERTIARY };
  const allergenText =
    assessment.status === 'CONTAINS'
      ? assessment.detail
        ? `Có chứa: ${assessment.detail}`
        : 'Có chứa chất gây dị ứng'
      : assessment.status === 'NOT_DETECTED'
        ? 'Không phát hiện chất gây dị ứng'
        : 'Thông tin dị ứng đang cập nhật — kiểm tra nguyên liệu nếu bạn dị ứng';
  const AllergenIcon = allergenTone.Icon;

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
      >
        <View style={styles.hero}>
          {image ? (
            <AppImage source={image} style={styles.heroImg} contentFit="cover" />
          ) : (
            <View style={[styles.heroImg, styles.heroPlaceholder]}>
              <ChefHat size={44} color="#C9B68A" />
            </View>
          )}
          {/* Soft top scrim keeps the floating buttons legible on bright photos */}
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0,0,0,0.28)', 'rgba(0,0,0,0)']}
            style={styles.heroScrim}
          />
          <SafeAreaView edges={['top']} style={styles.heroOverlay} pointerEvents="box-none">
            <View style={styles.heroBar}>
              <Pressable
                onPress={onBack}
                style={({ pressed }) => [styles.heroBtn, pressed && styles.pressed]}
                hitSlop={8}
                accessibilityLabel="Quay lại"
              >
                <ArrowLeft size={21} color={INK} strokeWidth={2.3} />
              </Pressable>
              <View style={styles.heroRight}>
                <Pressable
                  onPress={() => void toggleSave()}
                  style={({ pressed }) => [
                    styles.heroBtn,
                    isSaved && styles.heroBtnActive,
                    pressed && styles.pressed,
                  ]}
                  accessibilityLabel={isSaved ? 'Bỏ lưu' : 'Lưu món'}
                >
                  <Bookmark size={19} color={INK} fill={isSaved ? INK : 'transparent'} />
                </Pressable>
                <Pressable
                  onPress={() => void shareDish(dishName, dishId)}
                  style={({ pressed }) => [styles.heroBtn, pressed && styles.pressed]}
                  accessibilityLabel="Chia sẻ"
                >
                  <Share2 size={19} color={INK} />
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </View>

        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <Text style={styles.title}>{dishName}</Text>

          {desc ? (
            <Pressable
              onPress={descLong ? () => setDescExpanded((v) => !v) : undefined}
              style={{ marginTop: 8 }}
            >
              <Text style={styles.desc} numberOfLines={descExpanded ? undefined : 3}>
                {desc}
              </Text>
              {descLong ? (
                <Text style={styles.more}>{descExpanded ? 'Thu gọn' : 'Xem thêm'}</Text>
              ) : null}
            </Pressable>
          ) : null}

          {stats.length > 0 ? (
            <View style={styles.statsCard}>
              {stats.map((s, i) => {
                const Icon = s.icon;
                return (
                  <View key={s.key} style={styles.statWrap}>
                    {i > 0 ? <View style={styles.statDivider} /> : null}
                    <View style={styles.stat}>
                      <View style={[styles.statIcon, { backgroundColor: s.tint }]}>
                        <Icon size={16} color={s.iconColor} strokeWidth={2.3} />
                      </View>
                      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                        {s.value}
                      </Text>
                      <Text style={styles.statLabel} numberOfLines={1}>
                        {s.label}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {macros.length > 0 ? (
            <View style={styles.macroRow}>
              {macros.map((m) => (
                <View key={m.key} style={styles.macroChip}>
                  <View style={[styles.macroDot, { backgroundColor: m.color }]} />
                  <Text style={styles.macroValue}>{m.value}</Text>
                  <Text style={styles.macroLabel}>{m.label}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View
            style={[
              styles.allergenCard,
              { backgroundColor: allergenTone.bg, borderColor: allergenTone.border },
            ]}
          >
            <AllergenIcon size={17} color={allergenTone.iconColor} />
            <Text style={[styles.allergenText, { color: allergenTone.fg }]} numberOfLines={2}>
              {allergenText}
            </Text>
          </View>

          {ingredientCount > 0 ? (
            <View style={styles.section}>
              <Pressable
                onPress={canCook ? onCook : undefined}
                style={styles.sectionHead}
                accessibilityRole="button"
                accessibilityLabel="Xem công thức"
              >
                <Text style={styles.sectionTitle}>Nguyên liệu</Text>
                <View style={styles.sectionCountPill}>
                  <Text style={styles.sectionCount}>{ingredientCount}</Text>
                </View>
                <View style={{ flex: 1 }} />
                {canCook ? (
                  <>
                    <Text style={styles.sectionLink}>Xem tất cả</Text>
                    <ChevronRight size={16} color={MUTED} />
                  </>
                ) : null}
              </Pressable>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.ingRow}
              >
                {preview.map((ing, i) => (
                  <View key={`pv-${i}`} style={styles.ingItem}>
                    <View style={styles.ingThumb}>
                      {ing.imageUrl ? (
                        <AppImage uri={ing.imageUrl} style={styles.ingImg} contentFit="cover" />
                      ) : (
                        <Salad size={22} color="#C9A64A" />
                      )}
                    </View>
                    <Text style={styles.ingName} numberOfLines={2}>
                      {ingredientDisplayName(ing)}
                    </Text>
                  </View>
                ))}
                {moreCount > 0 ? (
                  <Pressable onPress={canCook ? onCook : undefined} style={styles.ingItem}>
                    <View style={[styles.ingThumb, styles.ingMore]}>
                      <Text style={styles.ingMoreText}>+{moreCount}</Text>
                    </View>
                    <Text style={styles.ingName}>Xem thêm</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            </View>
          ) : null}

          {canCook ? (
            <Pressable
              onPress={onCook}
              style={({ pressed }) => [styles.recipeCard, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Mở hướng dẫn nấu"
            >
              <View style={styles.recipeIcon}>
                <Mic size={18} color={INK} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.recipeTitle}>{stepCount} bước hướng dẫn</Text>
                <Text style={styles.recipeSub}>NOAN đọc từng bước bằng giọng nói</Text>
              </View>
              <ChevronRight size={18} color={MUTED} />
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky actions: one primary, one secondary — always reachable */}
      <View style={[styles.footer, { paddingBottom: Math.max(12, insets.bottom + 6) }]}>
        <Pressable
          onPress={onNearby}
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Tìm nơi bán"
        >
          <MapPin size={18} color={INK} />
          <Text style={styles.secondaryText}>Nơi bán</Text>
        </Pressable>
        <Pressable
          onPress={canCook ? onCook : undefined}
          disabled={!canCook}
          style={({ pressed }) => [
            styles.primaryBtn,
            !canCook && { opacity: 0.45 },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Nấu món này"
        >
          <ChefHat size={20} color={INK} />
          <Text style={styles.primaryText}>{canCook ? 'Nấu món này' : 'Chưa có công thức'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: WHITE },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  hero: { width: SW, height: HERO_H, backgroundColor: BORDER },
  heroImg: { ...StyleSheet.absoluteFill, width: SW, height: HERO_H },
  heroPlaceholder: { backgroundColor: '#EDE6D8', alignItems: 'center', justifyContent: 'center' },
  heroScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  heroOverlay: { ...StyleSheet.absoluteFill },
  heroBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  heroRight: { flexDirection: 'row', gap: 10 },
  heroBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  heroBtnActive: { backgroundColor: YELLOW },
  sheet: {
    marginTop: -26,
    backgroundColor: WHITE,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ECE6DA',
    marginBottom: 14,
  },
  title: { fontSize: 25, fontWeight: '800', color: INK, letterSpacing: -0.5, lineHeight: 31 },
  desc: { fontSize: 14.5, lineHeight: 21, color: MUTED },
  more: { marginTop: 4, fontSize: 13.5, fontWeight: '700', color: INK },
  statsCard: {
    flexDirection: 'row',
    marginTop: 18,
    backgroundColor: CREAM,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  statWrap: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  statDivider: { width: StyleSheet.hairlineWidth * 2, backgroundColor: '#EFE5CC', marginVertical: 4 },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: { fontSize: 14.5, fontWeight: '800', color: INK, textAlign: 'center' },
  statLabel: { fontSize: 11.5, color: TERTIARY, marginTop: 2, textAlign: 'center' },
  macroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  macroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: WHITE,
  },
  macroDot: { width: 7, height: 7, borderRadius: 4 },
  macroValue: { fontSize: 13, fontWeight: '800', color: INK },
  macroLabel: { fontSize: 12, color: MUTED },
  allergenCard: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  allergenText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  section: { marginTop: 24 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: INK },
  sectionCountPill: {
    backgroundColor: '#F3EFE6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionCount: { fontSize: 12, fontWeight: '700', color: MUTED },
  sectionLink: { fontSize: 13, fontWeight: '700', color: MUTED },
  ingRow: { gap: 12, paddingRight: 8 },
  ingItem: { width: 66, alignItems: 'center' },
  ingThumb: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: YELLOW_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F4EBD3',
  },
  ingImg: { width: '100%', height: '100%' },
  ingMore: { backgroundColor: '#F3EFE6', borderColor: '#ECE6DA' },
  ingMoreText: { fontSize: 15, fontWeight: '800', color: INK },
  ingName: { marginTop: 6, fontSize: 11.5, lineHeight: 15, color: INK, textAlign: 'center' },
  recipeCard: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: WHITE,
  },
  recipeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: YELLOW_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeTitle: { fontSize: 15, fontWeight: '800', color: INK },
  recipeSub: { marginTop: 2, fontSize: 12.5, color: MUTED },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: WHITE,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  secondaryBtn: {
    minHeight: 54,
    paddingHorizontal: 18,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F1E8',
  },
  secondaryText: { fontSize: 14, fontWeight: '700', color: INK },
  primaryBtn: {
    flex: 1,
    minHeight: 54,
    borderRadius: 999,
    backgroundColor: YELLOW,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { fontSize: 16, fontWeight: '800', color: INK },
});

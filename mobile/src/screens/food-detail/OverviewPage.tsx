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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  ChefHat,
  ChevronRight,
  Clock3,
  Flame,
  List,
  MapPin,
  Salad,
  Share2,
  Tag,
} from '@/components/icons';
import { AppImage } from '../../components/ui/app-image';
import { BORDER, CREAM, INK, MUTED, TERTIARY, WHITE, YELLOW, YELLOW_SOFT } from './tokens';
import type { AllergenAssessment, DishAllergen, DishIngredient, DishNutrition } from './types';
import { assessAllergens, formatKcalLabel, ingredientDisplayName } from './utils';
import { shareDish, useDishSave } from './useDishActions';

const { width: SW, height: SH } = Dimensions.get('window');
const HERO_H = Math.round(Math.min(SW * 1.0, SH * 0.42));
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
    timeLabel ? { key: 'time', icon: Clock3, value: timeLabel, label: 'Thời gian' } : null,
    kcal ? { key: 'kcal', icon: Flame, value: kcal, label: 'Năng lượng' } : null,
    priceLabel ? { key: 'price', icon: Tag, value: priceLabel, label: 'Giá tham khảo' } : null,
  ].filter(Boolean) as Array<{ key: string; icon: typeof Clock3; value: string; label: string }>;

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ paddingBottom: 104 + insets.bottom }}
      >
        <View style={styles.hero}>
          {image ? (
            <AppImage source={image} style={styles.heroImg} contentFit="cover" />
          ) : (
            <View style={[styles.heroImg, styles.heroPlaceholder]} />
          )}
          <SafeAreaView edges={['top']} style={styles.heroOverlay} pointerEvents="box-none">
            <View style={styles.heroBar}>
              <Pressable onPress={onBack} style={styles.heroBtn} hitSlop={8} accessibilityLabel="Quay lại">
                <ArrowLeft size={22} color={INK} strokeWidth={2.2} />
              </Pressable>
              <View style={styles.heroRight}>
                <Pressable
                  onPress={() => void toggleSave()}
                  style={[styles.heroBtn, isSaved && styles.heroBtnActive]}
                  accessibilityLabel={isSaved ? 'Bỏ lưu' : 'Lưu món'}
                >
                  <Bookmark size={20} color={INK} fill={isSaved ? INK : 'transparent'} />
                </Pressable>
                <Pressable
                  onPress={() => void shareDish(dishName, dishId)}
                  style={styles.heroBtn}
                  accessibilityLabel="Chia sẻ"
                >
                  <Share2 size={20} color={INK} />
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </View>

        {/* Sheet overlaps hero for a softer, modern look */}
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
            <View style={styles.stats}>
              {stats.map((s) => {
                const Icon = s.icon;
                return (
                  <View key={s.key} style={styles.stat}>
                    <View style={styles.statIcon}>
                      <Icon size={16} color={INK} strokeWidth={2.2} />
                    </View>
                    <Text style={styles.statValue} numberOfLines={1}>
                      {s.value}
                    </Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* Allergen: only draw attention when the dish actually contains something */}
          {assessment.status === 'CONTAINS' ? (
            <View style={styles.allergenWarn}>
              <AlertTriangle size={16} color="#B45309" />
              <Text style={styles.allergenWarnText} numberOfLines={2}>
                {assessment.detail ? `Có chứa: ${assessment.detail}` : 'Có chứa chất gây dị ứng'}
              </Text>
            </View>
          ) : (
            <Text style={styles.allergenNote}>
              {assessment.status === 'NOT_DETECTED'
                ? 'Không phát hiện chất gây dị ứng trong dữ liệu đã kiểm tra.'
                : 'Thông tin dị ứng đang được cập nhật — hãy kiểm tra nguyên liệu nếu bạn bị dị ứng.'}
            </Text>
          )}

          {ingredientCount > 0 ? (
            <View style={styles.section}>
              <Pressable
                onPress={canCook ? onCook : undefined}
                style={styles.sectionHead}
                accessibilityRole="button"
                accessibilityLabel="Xem công thức"
              >
                <Text style={styles.sectionTitle}>Nguyên liệu</Text>
                <Text style={styles.sectionCount}>{ingredientCount}</Text>
                <View style={{ flex: 1 }} />
                {canCook ? (
                  <>
                    <Text style={styles.sectionLink}>Xem công thức</Text>
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
                        <Salad size={20} color="#C9A64A" />
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
            <View style={styles.recipeHint}>
              <List size={16} color={MUTED} />
              <Text style={styles.recipeHintText}>
                {stepCount} bước hướng dẫn · có giọng nói NOAN đọc từng bước
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky actions: one primary, one secondary — always reachable */}
      <View style={[styles.footer, { paddingBottom: Math.max(12, insets.bottom + 4) }]}>
        <Pressable
          onPress={onNearby}
          style={styles.secondaryBtn}
          accessibilityRole="button"
          accessibilityLabel="Tìm nơi bán"
        >
          <MapPin size={18} color={INK} />
          <Text style={styles.secondaryText}>Nơi bán</Text>
        </Pressable>
        <Pressable
          onPress={canCook ? onCook : undefined}
          disabled={!canCook}
          style={[styles.primaryBtn, !canCook && { opacity: 0.45 }]}
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
  hero: { width: SW, height: HERO_H, backgroundColor: BORDER },
  heroImg: { ...StyleSheet.absoluteFill, width: SW, height: HERO_H },
  heroPlaceholder: { backgroundColor: '#EDE6D8' },
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
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBtnActive: { backgroundColor: YELLOW },
  sheet: {
    marginTop: -28,
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
  title: { fontSize: 26, fontWeight: '800', color: INK, letterSpacing: -0.5, lineHeight: 32 },
  desc: { fontSize: 15, lineHeight: 22, color: MUTED },
  more: { marginTop: 4, fontSize: 14, fontWeight: '700', color: INK },
  stats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  stat: {
    flex: 1,
    alignItems: 'flex-start',
    backgroundColor: CREAM,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: { fontSize: 14, fontWeight: '800', color: INK },
  statLabel: { fontSize: 11.5, color: TERTIARY, marginTop: 2 },
  allergenWarn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF4E5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  allergenWarnText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#92400E' },
  allergenNote: { marginTop: 12, fontSize: 12.5, lineHeight: 18, color: TERTIARY },
  section: { marginTop: 24 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: INK },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
    color: MUTED,
    backgroundColor: '#F3EFE6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  sectionLink: { fontSize: 13, fontWeight: '700', color: MUTED },
  ingRow: { gap: 12, paddingRight: 8 },
  ingItem: { width: 64, alignItems: 'center' },
  ingThumb: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: YELLOW_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ingImg: { width: '100%', height: '100%' },
  ingMore: { backgroundColor: '#F3EFE6' },
  ingMoreText: { fontSize: 15, fontWeight: '800', color: INK },
  ingName: { marginTop: 6, fontSize: 11.5, lineHeight: 15, color: INK, textAlign: 'center' },
  recipeHint: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recipeHintText: { flex: 1, fontSize: 13, color: MUTED },
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

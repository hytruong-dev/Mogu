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
  ChevronRight,
  Clock3,
  Flame,
  MapPin,
  Share2,
  Soup,
  Tag,
} from 'lucide-react-native';
import { AppImage } from '../../components/ui/app-image';
import {
  BORDER,
  CREAM,
  INK,
  MUTED,
  TERTIARY,
  WHITE,
  YELLOW,
  YELLOW_SOFT,
  cardShadow,
} from './tokens';
import type { AllergenAssessment, DishAllergen, DishNutrition } from './types';
import { assessAllergens, formatKcalLabel } from './utils';
import { shareDish, useDishSave } from './useDishActions';

const { width: SW, height: SH } = Dimensions.get('window');
/** Design: hero ~40% viewport */
const HERO_H = Math.round(Math.min(SW * 0.92, SH * 0.38));

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
  const descLong = desc.length > 90;
  const canCook = stepCount > 0;

  const metaItems = [
    timeLabel ? { key: 'time', icon: Clock3, label: timeLabel } : null,
    priceLabel ? { key: 'price', icon: Tag, label: priceLabel } : null,
    kcal ? { key: 'kcal', icon: Flame, label: kcal } : null,
  ].filter(Boolean) as Array<{ key: string; icon: typeof Clock3; label: string }>;

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
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

        <View style={styles.body}>
          <Text style={styles.title}>{dishName}</Text>

          {desc ? (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.desc} numberOfLines={descExpanded ? undefined : 2}>
                {desc}
              </Text>
              {descLong ? (
                <Pressable onPress={() => setDescExpanded((v) => !v)} hitSlop={6}>
                  <Text style={styles.more}>{descExpanded ? 'Thu gọn' : 'Xem thêm'}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {metaItems.length > 0 ? (
            <View style={styles.metaRow}>
              {metaItems.map((item, i) => {
                const Icon = item.icon;
                return (
                  <View key={item.key} style={styles.metaItem}>
                    {i > 0 ? <View style={styles.metaDivider} /> : null}
                    <View style={styles.metaInner}>
                      <Icon size={15} color={INK} strokeWidth={2} />
                      <Text style={styles.metaText}>{item.label}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          <View style={styles.allergenCard}>
            <View style={styles.allergenIcon}>
              <AlertTriangle size={18} color="#E8A317" fill="#F5C84C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.allergenTitle}>Lưu ý dị ứng</Text>
              <Text style={styles.allergenDetail}>
                {assessment.status === 'CONTAINS'
                  ? assessment.detail
                    ? `Có chứa: ${assessment.detail}`
                    : 'Có chứa chất gây dị ứng'
                  : assessment.status === 'NOT_DETECTED'
                    ? 'Không phát hiện trong dữ liệu đã kiểm tra'
                    : 'Chưa đủ dữ liệu để xác nhận'}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={canCook ? onCook : undefined}
            disabled={!canCook}
            style={[styles.actionRow, !canCook && styles.actionDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Nấu món này"
          >
            <View style={styles.actionIcon}>
              <Soup size={22} color={INK} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Nấu món này</Text>
              <Text style={styles.actionSub}>
                {canCook
                  ? `Công thức · ${ingredientCount} nguyên liệu · ${stepCount} bước`
                  : 'Chưa có công thức'}
              </Text>
            </View>
            <ChevronRight size={20} color={TERTIARY} />
          </Pressable>

          <Pressable
            onPress={onNearby}
            style={styles.actionRow}
            accessibilityRole="button"
            accessibilityLabel="Tìm nơi bán"
          >
            <View style={styles.actionIcon}>
              <MapPin size={22} color={INK} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Tìm nơi bán</Text>
              <Text style={styles.actionSub}>Quán gần bạn</Text>
            </View>
            <ChevronRight size={20} color={TERTIARY} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM },
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
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBtnActive: { backgroundColor: YELLOW },
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 },
  title: { fontSize: 28, fontWeight: '800', color: INK, letterSpacing: -0.6, lineHeight: 34 },
  desc: { fontSize: 15, lineHeight: 23, color: MUTED },
  more: { marginTop: 6, fontSize: 14, fontWeight: '700', color: INK },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  metaItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  metaDivider: {
    width: StyleSheet.hairlineWidth,
    height: 26,
    backgroundColor: BORDER,
  },
  metaInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  metaText: { fontSize: 14, fontWeight: '600', color: INK },
  allergenCard: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: YELLOW_SOFT,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#F0E0A8',
  },
  allergenIcon: { width: 28, alignItems: 'center' },
  allergenTitle: { fontSize: 15, fontWeight: '700', color: INK },
  allergenDetail: { fontSize: 13, color: MUTED, marginTop: 3, lineHeight: 18 },
  actionRow: {
    marginTop: 12,
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 14,
    ...cardShadow,
  },
  actionDisabled: { opacity: 0.5 },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: { fontSize: 16, fontWeight: '700', color: INK },
  actionSub: { fontSize: 13, color: MUTED, marginTop: 3 },
});

/**
 * FoodDetailScreen — xem chi tiết món ăn (thiết kế lại theo mockup)
 * Sections: Hero · Tags · Name · Quick stats · Dinh dưỡng & cách nấu · Video · Địa điểm · Đánh giá
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  Clock,
  MapPin,
  MessageCircle,
  Play,
  Share2,
  Star,
  Users,
  Utensils,
} from 'lucide-react-native';
import { dishesApi } from '../services/api/dishes';
import type { Dish as DishDetail } from '../services/api/types';
import { DetailSkeleton } from '../components/skeletons/ScreenSkeletons';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { AppImage } from '../components/ui/app-image';

type Props = {
  route: { params: { dishId: string; title?: string } };
  navigation: { goBack: () => void; setOptions: (o: any) => void };
};

// ── Constants ─────────────────────────────────────────────────────────────────
const CREAM = '#FFF9E8';
const WHITE = '#FFFFFF';
const INK = '#161616';
const SECONDARY = '#5F5F5F';
const TERTIARY = '#8A8A8A';
const YELLOW = '#FFD54F';
const YELLOW_DARK = '#F5B900';
const BORDER = '#E9E1D2';
const SUPABASE_URL = 'https://lkqvyvllmrbxgaoqrkhd.supabase.co';

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildImageUrl(dish: DishDetail): string | null {
  if ((dish as any).thumbnailUrl) return (dish as any).thumbnailUrl;
  const media = (dish.media ?? []) as any[];
  const primary = media.find((m) => m.isPrimary) ?? media[0];
  if (!primary) return null;
  const bucket = primary.bucket ?? 'dish-images';
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${primary.storageKey}`;
}

function formatPrice(min?: number | null, max?: number | null): string {
  if (min == null && max == null) return '';
  const fmt = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}K` : `${n}`;
  if (min != null && max != null && min !== max) return `${fmt(min)}–${fmt(max)}`;
  return fmt((min ?? max)!);
}

function difficultyLabel(d?: string | null) {
  if (d === 'EASY') return 'Dễ';
  if (d === 'MEDIUM') return 'Trung bình';
  if (d === 'HARD') return 'Khó';
  return d ?? '';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NutritionItem({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF5D7', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
      </View>
      <Text style={{ fontSize: 13, fontWeight: '700', color: INK }}>{value}</Text>
      <Text style={{ fontSize: 11, color: TERTIARY, marginTop: 1 }}>{label}</Text>
    </View>
  );
}

function StepItem({ index, instruction, durationMin }: { index: number; instruction: string; durationMin?: number | null }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
      <View style={{
        width: 30, height: 30, borderRadius: 15, backgroundColor: YELLOW,
        alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
      }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: INK }}>{index}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, color: INK, lineHeight: 20 }}>{instruction}</Text>
        {durationMin != null && (
          <Text style={{ fontSize: 12, color: TERTIARY, marginTop: 3 }}>⏱ {durationMin} phút</Text>
        )}
      </View>
    </View>
  );
}

function SectionCard({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <Card style={[{
      backgroundColor: WHITE, borderRadius: 16, padding: 16, marginBottom: 14,
      shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    }, style]}>
      {children}
    </Card>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function FoodDetailScreen({ route, navigation }: Props) {
  const { dishId } = route.params;
  const [dish, setDish] = useState<DishDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [nutritionExpanded, setNutritionExpanded] = useState(true);
  const [recipe, setRecipe] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    dishesApi.getById(dishId)
      .then((d) => {
        setDish(d);
        setIsSaved(d.isSaved ?? false);
        navigation.setOptions({ title: d.name });
        // Lấy recipe từ dish data nếu có sẵn
        const embeddedRecipe = (d as any).recipe ?? (d as any).recipes?.[0];
        if (embeddedRecipe) setRecipe(embeddedRecipe);
      })
      .catch((e: any) => setError(e?.message ?? 'Không tải được món ăn'))
      .finally(() => setLoading(false));
  }, [dishId, navigation]);

  const toggleSave = useCallback(async () => {
    if (!dish || savingToggle) return;
    setSavingToggle(true);
    const prev = isSaved;
    setIsSaved(!prev);
    try {
      if (prev) await dishesApi.unsave(dish.id);
      else await dishesApi.save(dish.id);
    } catch { setIsSaved(prev); }
    finally { setSavingToggle(false); }
  }, [dish, isSaved, savingToggle]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: CREAM }} edges={['top']}>
        <DetailSkeleton />
      </SafeAreaView>
    );
  }

  if (error || !dish) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: CREAM }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 16, color: '#E53E3E', textAlign: 'center' }}>{error || 'Không tìm thấy món ăn'}</Text>
          <Pressable onPress={() => navigation.goBack()}
            style={{ marginTop: 16, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: YELLOW, borderRadius: 12 }}>
            <Text style={{ fontWeight: '700', color: INK }}>Quay lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const imageUrl = buildImageUrl(dish);
  const nutritionProfiles = (dish as any).nutritionProfiles ?? [];
  const nutrition = nutritionProfiles[0] ?? {
    calories: (dish as any).calories,
    proteinG: (dish as any).proteinG,
    carbG: (dish as any).carbG ?? (dish as any).carbs,
    fatG: (dish as any).fatG ?? (dish as any).fat,
    fiberG: (dish as any).fiberG,
  };

  const recipeSteps: any[] = recipe?.steps ?? (dish as any).recipes?.[0]?.steps ?? [];
  const cookMinutes = (dish as any).cookMinutes ?? recipe?.cookMinutes;
  const totalMinutes = ((dish as any).prepMinutes ?? 0) + (cookMinutes ?? 0);
  const servings = (dish as any).servings ?? recipe?.servings;
  const priceStr = formatPrice((dish as any).priceMin, (dish as any).priceMax);
  const allergenNames = ((dish as any).allergens ?? []).map((a: any) => a.allergenName ?? a.allergenCode).join(', ');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: CREAM }} edges={['top']}>
      {/* ── Floating Header ───────────────────────────────────────────────────── */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 10, backgroundColor: CREAM,
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', elevation: 2 }}>
          <ArrowLeft size={22} color={INK} />
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: '700', color: INK, flex: 1, textAlign: 'center', marginHorizontal: 8 }} numberOfLines={1}>
          {dish.name}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', elevation: 2 }}>
            <Share2 size={18} color={INK} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleSave}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', elevation: 2 }}>
            {isSaved
              ? <BookmarkCheck size={20} color={YELLOW_DARK} fill={YELLOW} />
              : <Bookmark size={20} color={INK} />}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ── Hero Card ─────────────────────────────────────────────────────── */}
        <View style={{ marginHorizontal: 16, marginBottom: 14 }}>
          <SectionCard style={{ padding: 0, overflow: 'hidden' }}>
            {/* Cover */}
            <View style={{ position: 'relative' }}>
              <AppImage
                uri={imageUrl}
                style={{ width: '100%', height: 200, backgroundColor: '#EDE9E1' }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={250}
                showLoader
                fallbackIcon={
                  <View style={{ width: '100%', height: 200, backgroundColor: '#EDE9E1', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 56 }}>🍽️</Text>
                  </View>
                }
              />
              {/* Match badge */}
              <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: YELLOW, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', gap: 4 }}>
                <Star size={12} color={INK} fill={INK} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: INK }}>Phù hợp</Text>
              </View>
            </View>

            {/* Info */}
            <View style={{ padding: 14 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: INK, letterSpacing: -0.5, marginBottom: 6 }}>{dish.name}</Text>

              {/* Quick chips */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {(dish as any).mealTypes?.[0] && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF5D7', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Utensils size={12} color={YELLOW_DARK} />
                    <Text style={{ fontSize: 12, color: YELLOW_DARK, fontWeight: '600' }}>{(dish as any).mealTypes[0]?.name ?? (dish as any).mealTypes[0]?.code}</Text>
                  </View>
                )}
                {priceStr !== '' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0FFF4', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 12 }}>💰</Text>
                    <Text style={{ fontSize: 12, color: '#276749', fontWeight: '600' }}>{priceStr}</Text>
                  </View>
                )}
                {totalMinutes > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Clock size={12} color={SECONDARY} />
                    <Text style={{ fontSize: 12, color: SECONDARY, fontWeight: '600' }}>{totalMinutes} phút</Text>
                  </View>
                )}
              </View>

              {/* Description */}
              {((dish as any).shortDescription || (dish as any).description) && (
                <Text style={{ fontSize: 13, color: SECONDARY, lineHeight: 19 }} numberOfLines={3}>
                  {(dish as any).shortDescription ?? (dish as any).description}
                </Text>
              )}
            </View>
          </SectionCard>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          {/* ── Dinh dưỡng & Cách nấu (collapsible) ──────────────────────────── */}
          <SectionCard style={{ padding: 0, overflow: 'hidden' }}>
            {/* Header toggle */}
            <TouchableOpacity
              onPress={() => setNutritionExpanded(!nutritionExpanded)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#FFF5D7', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16 }}>📊</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: INK }}>Dinh dưỡng & cách nấu</Text>
              </View>
              <Text style={{ fontSize: 18, color: TERTIARY }}>{nutritionExpanded ? '∧' : '∨'}</Text>
            </TouchableOpacity>

            {nutritionExpanded && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                {/* Calories big + macros */}
                {nutrition?.calories != null && (
                  <View style={{ marginBottom: 16 }}>
                    <View style={{
                      backgroundColor: '#FAFAFA', borderRadius: 14, padding: 16,
                      flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12,
                    }}>
                      <View>
                        <Text style={{ fontSize: 40, fontWeight: '900', color: INK, lineHeight: 44 }}>{Math.round(nutrition.calories)}</Text>
                        <Text style={{ fontSize: 13, color: TERTIARY }}>kcal / khẩu phần</Text>
                      </View>
                      <View style={{ flex: 1, gap: 6 }}>
                        {nutrition.proteinG != null && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 13, color: SECONDARY }}>🥩 Protein</Text>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: INK }}>{Math.round(nutrition.proteinG)}g</Text>
                          </View>
                        )}
                        {nutrition.carbG != null && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 13, color: SECONDARY }}>🌾 Tinh bột</Text>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: INK }}>{Math.round(nutrition.carbG)}g</Text>
                          </View>
                        )}
                        {nutrition.fatG != null && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 13, color: SECONDARY }}>🫒 Chất béo</Text>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: INK }}>{Math.round(nutrition.fatG)}g</Text>
                          </View>
                        )}
                        {nutrition.fiberG != null && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 13, color: SECONDARY }}>🌿 Chất xơ</Text>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: INK }}>{Math.round(nutrition.fiberG)}g</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text style={{ fontSize: 11, color: TERTIARY }}>ⓘ Giá trị có thể thay đổi theo khẩu phần.</Text>
                  </View>
                )}

                {/* Cách chế biến */}
                {recipeSteps.length > 0 && (
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: INK, marginBottom: 12 }}>Cách chế biến</Text>
                    <View style={{ backgroundColor: '#FAFAFA', borderRadius: 12, padding: 14 }}>
                      {recipeSteps.map((step: any, i: number) => (
                        <StepItem key={step.id ?? i} index={step.stepOrder ?? i + 1} instruction={step.instruction} durationMin={step.durationMin} />
                      ))}
                    </View>
                  </View>
                )}

                {/* Thời gian & độ khó */}
                {(totalMinutes > 0 || (dish as any).difficulty) && (
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                    {totalMinutes > 0 && (
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F5F5F5', borderRadius: 10, padding: 10 }}>
                        <Clock size={14} color={SECONDARY} />
                        <Text style={{ fontSize: 13, color: SECONDARY, fontWeight: '600' }}>{totalMinutes}–{totalMinutes + 10} phút</Text>
                      </View>
                    )}
                    {(dish as any).difficulty && (
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F5F5F5', borderRadius: 10, padding: 10 }}>
                        <Text style={{ fontSize: 13 }}>📊</Text>
                        <Text style={{ fontSize: 13, color: SECONDARY, fontWeight: '600' }}>Độ khó: {difficultyLabel((dish as any).difficulty)}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Xem công thức đầy đủ */}
                <TouchableOpacity style={{
                  marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 6, borderWidth: 1.5, borderColor: BORDER, borderRadius: 12, padding: 12,
                }}>
                  <Text style={{ fontSize: 14 }}>📖</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: INK }}>Xem công thức đầy đủ</Text>
                  <ChevronRight size={16} color={SECONDARY} />
                </TouchableOpacity>
              </View>
            )}
          </SectionCard>

          {/* ── Video hướng dẫn (mock) ─────────────────────────────────────── */}
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: INK, marginBottom: 10 }}>Video hướng dẫn</Text>
            <View style={{ borderRadius: 14, overflow: 'hidden', position: 'relative' }}>
              <AppImage
                uri={imageUrl}
                style={{ width: '100%', height: 180 }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={250}
                showLoader
                fallbackIcon={
                  <View style={{ width: '100%', height: 180, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 40 }}>🎬</Text>
                  </View>
                }
              />
              {/* Overlay gradient + play */}
              <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center' }}>
                  <Play size={22} color={INK} fill={INK} />
                </View>
              </View>
              {/* Caption */}
              <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: WHITE }}>Nấu {dish.name} tại nhà</Text>
              </View>
            </View>
          </View>

          {/* ── Địa điểm gần bạn ──────────────────────────────────────────── */}
          <TouchableOpacity activeOpacity={0.8}>
            <SectionCard style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' }}>
                  <MapPin size={18} color="#27AE60" />
                </View>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: INK }}>Địa điểm gần bạn</Text>
                  <Text style={{ fontSize: 12, color: TERTIARY, marginTop: 1 }}>12 quán trong 3km</Text>
                </View>
              </View>
              <ChevronRight size={18} color={TERTIARY} />
            </SectionCard>
          </TouchableOpacity>

          {/* ── Đánh giá cộng đồng ────────────────────────────────────────── */}
          <TouchableOpacity activeOpacity={0.8}>
            <SectionCard style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF5D7', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageCircle size={18} color={YELLOW_DARK} />
                </View>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: INK }}>Đánh giá cộng đồng</Text>
                  <Text style={{ fontSize: 12, color: TERTIARY, marginTop: 1 }}>
                    <Text style={{ color: YELLOW_DARK, fontWeight: '700' }}>★ 4.8</Text> / 5 · 1,248 đánh giá
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={TERTIARY} />
            </SectionCard>
          </TouchableOpacity>

          {/* ── Cảnh báo dị ứng ───────────────────────────────────────────── */}
          {allergenNames ? (
            <View style={{ backgroundColor: '#FFF5F5', borderRadius: 12, padding: 14, marginBottom: 14, flexDirection: 'row', gap: 10 }}>
              <Text style={{ fontSize: 20 }}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#C53030', marginBottom: 3 }}>Cảnh báo dị ứng</Text>
                <Text style={{ fontSize: 13, color: '#4E4A43' }}>Chứa: {allergenNames}</Text>
              </View>
            </View>
          ) : null}

          {/* ── Tags vùng miền / category ──────────────────────────────────── */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {(dish as any).region && (
              <View style={{ backgroundColor: '#FFF9E6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}>
                <Text style={{ fontSize: 12, color: '#866A00', fontWeight: '600' }}>{(dish as any).region.name}</Text>
              </View>
            )}
            {((dish as any).categories ?? []).map((c: any, i: number) => {
              const name = c.category?.name ?? c.name ?? c.code;
              if (!name) return null;
              return (
                <View key={c.categoryId ?? c.id ?? `${name}-${i}`} style={{ backgroundColor: '#F0FFF4', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}>
                  <Text style={{ fontSize: 12, color: '#276749', fontWeight: '600' }}>{name}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* ── Bottom CTA ────────────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8, backgroundColor: CREAM, borderTopWidth: 1, borderTopColor: BORDER }}>
        <Button
          className="h-14 rounded-2xl bg-mogu-yellow flex-row items-center justify-center gap-2"
        >
          <Utensils size={18} color={INK} />
          <Text style={{ fontSize: 16, fontWeight: '800', color: INK }}>Chọn món này</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}

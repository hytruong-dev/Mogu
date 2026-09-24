/**
 * WeeklyGroceryScreen — Danh sách đi chợ gộp cả tuần
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, Leaf, ShoppingCart } from 'lucide-react-native';
import { getWeeklyIngredients } from '../services/api/weekly-plan';
import type {
  GroceryIngredientCategory,
  WeeklyIngredientItem,
  WeeklyIngredientsResponse,
} from '../services/api/types';
import { formatApiErrorWithCode } from '../lib/api-error';
import { ListSkeleton } from '../components/skeletons/ScreenSkeletons';
import { Card } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { AppImage } from '../components/ui/app-image';

const CREAM = '#F7F2E8';
const WHITE = '#FFFFFF';
const INK = '#111111';
const MUTED = '#999';
const BORDER = '#EDE5D2';
const YELLOW = '#FFC51A';

type Props = {
  planId: string;
  onBack: () => void;
};

type FilterKey = 'ALL' | GroceryIngredientCategory;

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'MEAT_SEAFOOD', label: 'Thịt & Hải sản' },
  { key: 'VEGGIES', label: 'Rau củ' },
  { key: 'CARBS', label: 'Tinh bột' },
  { key: 'SEASONING', label: 'Gia vị' },
  { key: 'OTHER', label: 'Khác' },
];

function storageKey(planId: string) {
  return `mogu:grocery-checked:${planId}`;
}

function itemKey(item: WeeklyIngredientItem) {
  return `${item.ingredientId ?? item.name}|${item.unit ?? ''}`;
}

function formatQty(item: WeeklyIngredientItem): string {
  if (item.quantity == null) return item.unit ? `— ${item.unit}` : 'Theo khẩu phần';
  const q =
    Number.isInteger(item.quantity) || Math.abs(item.quantity) >= 10
      ? Math.round(item.quantity).toString()
      : item.quantity.toFixed(1).replace(/\.0$/, '');
  return item.unit ? `${q} ${item.unit}` : q;
}

function formatDateRange(start?: string, end?: string) {
  if (!start || !end) return '';
  const s = start.slice(0, 10).split('-');
  const e = end.slice(0, 10).split('-');
  if (s.length < 3 || e.length < 3) return '';
  return `${Number(s[2])}/${Number(s[1])} – ${Number(e[2])}/${Number(e[1])}`;
}

function formatVnd(n: number) {
  return `${n.toLocaleString('vi-VN')}đ`;
}

export function WeeklyGroceryScreen({ planId, onBack }: Props) {
  const [data, setData] = useState<WeeklyIngredientsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const loadChecked = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(storageKey(planId));
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, [planId]);

  const persistChecked = useCallback(
    async (next: Record<string, boolean>) => {
      setChecked(next);
      try {
        await AsyncStorage.setItem(storageKey(planId), JSON.stringify(next));
      } catch {
        // ignore
      }
    },
    [planId],
  );

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const res = await getWeeklyIngredients(planId);
        setData(res);
      } catch (e) {
        setError(formatApiErrorWithCode(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [planId],
  );

  useEffect(() => {
    load();
    loadChecked();
  }, [load, loadChecked]);

  const visibleItems = useMemo(() => {
    if (!data) return [];
    if (filter === 'ALL') return data.items;
    return data.items.filter((it) => it.category === filter);
  }, [data, filter]);

  const checkedCount = useMemo(
    () => visibleItems.filter((it) => checked[itemKey(it)]).length,
    [visibleItems, checked],
  );

  const toggleItem = (item: WeeklyIngredientItem) => {
    const key = itemKey(item);
    const next = { ...checked, [key]: !checked[key] };
    void persistChecked(next);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.iconBtn} hitSlop={8}>
          <ArrowLeft size={22} color={INK} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.headerTitle} numberOfLines={1}>
            Đi chợ tuần
          </Text>
          {!!data && (
            <Text style={s.headerSub}>
              {formatDateRange(data.startDate, data.endDate)}
            </Text>
          )}
        </View>
        <View style={s.iconBtn} />
      </View>

      {loading ? (
        <ListSkeleton rows={8} />
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <Pressable onPress={() => load()} style={s.retryBtn}>
            <Text style={s.retryText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : !data || data.items.length === 0 ? (
        <View style={s.center}>
          <ShoppingCart size={40} color={YELLOW} strokeWidth={1.6} />
          <Text style={s.emptyTitle}>Chưa có nguyên liệu</Text>
          <Text style={s.emptySub}>
            Các món trong tuần chưa gắn nguyên liệu, hoặc đã bị bỏ qua hết.
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={(item, idx) => `${itemKey(item)}-${idx}`}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true);
              }}
              tintColor={YELLOW}
              colors={[YELLOW]}
            />
          }
          ListHeaderComponent={
            <View style={{ gap: 12 }}>
              <Card style={s.summaryCard}>
                <Text style={s.summaryTitle}>
                  {data.totalIngredientsCount} nguyên liệu · {data.totalDishes} món ·{' '}
                  {data.totalMeals} bữa
                </Text>
                <Text style={s.summarySub}>
                  Ước tính {formatVnd(data.totalEstimatedCostVnd)} · Đã tick{' '}
                  {checkedCount}/{visibleItems.length}
                </Text>
              </Card>

              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={FILTERS.filter(
                  (f) =>
                    f.key === 'ALL' ||
                    data.byCategory.some((c) => c.category === f.key),
                )}
                keyExtractor={(f) => f.key}
                contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                renderItem={({ item: f }) => {
                  const on = filter === f.key;
                  return (
                    <Pressable
                      onPress={() => setFilter(f.key)}
                      style={[s.chip, on && s.chipOn]}
                    >
                      <Text style={[s.chipText, on && s.chipTextOn]}>{f.label}</Text>
                    </Pressable>
                  );
                }}
              />
            </View>
          }
          renderItem={({ item }) => (
            <IngredientRow
              item={item}
              done={!!checked[itemKey(item)]}
              onToggle={() => toggleItem(item)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function IngredientRow({
  item,
  done,
  onToggle,
}: {
  item: WeeklyIngredientItem;
  done: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle}>
      <Card style={[s.row, done && { opacity: 0.55, backgroundColor: '#F8F8F6' }]}>
        <Checkbox checked={done} onCheckedChange={onToggle} className="mr-1" />
        {item.imageUrl ? (
          <AppImage
            uri={item.imageUrl}
            style={s.thumb}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
            fallbackIcon={<Leaf size={20} color="#7CB342" strokeWidth={1.8} />}
          />
        ) : (
          <View style={[s.thumb, s.thumbFallback]}>
            <Leaf size={20} color="#7CB342" strokeWidth={1.8} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[s.name, done && { textDecorationLine: 'line-through', color: MUTED }]}
            numberOfLines={1}
          >
            {item.name}
            {item.isOptional ? ' (tuỳ chọn)' : ''}
          </Text>
          <Text style={s.meta} numberOfLines={1}>
            {item.categoryLabel} · {item.usedInDishes.join(' · ')}
          </Text>
        </View>
        <Text style={[s.qty, done && { color: MUTED }]}>{formatQty(item)}</Text>
      </Card>
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: CREAM,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK },
  headerSub: { fontSize: 12, color: MUTED, marginTop: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },
  summaryCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 4,
  },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: INK },
  summarySub: { fontSize: 12.5, color: MUTED },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: BORDER,
    backgroundColor: WHITE,
  },
  chipOn: { backgroundColor: YELLOW, borderColor: YELLOW },
  chipText: { fontSize: 12.5, fontWeight: '600', color: MUTED },
  chipTextOn: { color: INK, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  thumb: { width: 40, height: 40, borderRadius: 10 },
  thumbFallback: {
    backgroundColor: '#F0F7E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 14.5, fontWeight: '700', color: INK },
  meta: { fontSize: 12, color: MUTED, marginTop: 2 },
  qty: { fontSize: 13, fontWeight: '700', color: '#3F3B35' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: INK, marginTop: 8 },
  emptySub: { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 20 },
  errorText: { fontSize: 14, color: '#B91C1C', textAlign: 'center' },
  retryBtn: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: YELLOW,
  },
  retryText: { fontWeight: '700', color: INK },
});

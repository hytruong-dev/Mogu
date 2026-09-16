/**
 * DayIngredientsScreen — danh sách nguyên liệu gom theo ngày trong weekly plan
 */
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Leaf } from 'lucide-react-native';
import { getDayIngredients } from '../services/api/weekly-plan';
import type { DayIngredientItem, DayIngredientsResponse } from '../services/api/types';
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
  date: string; // YYYY-MM-DD
  title?: string;
  onBack: () => void;
};

function formatQty(item: DayIngredientItem): string {
  if (item.quantity == null) return item.unit ? `— ${item.unit}` : 'Theo khẩu phần';
  const q =
    Number.isInteger(item.quantity) || Math.abs(item.quantity) >= 10
      ? Math.round(item.quantity).toString()
      : item.quantity.toFixed(1).replace(/\.0$/, '');
  return item.unit ? `${q} ${item.unit}` : q;
}

function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const weekday = new Date(y, m - 1, d).toLocaleDateString('vi-VN', { weekday: 'long' });
  return `${weekday}, ${d}/${m}`;
}

export function DayIngredientsScreen({ planId, date, title, onBack }: Props) {
  const [data, setData] = useState<DayIngredientsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const res = await getDayIngredients(planId, date);
        setData(res);
      } catch (e) {
        setError(formatApiErrorWithCode(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [planId, date],
  );

  useEffect(() => {
    load();
  }, [load]);

  const headerTitle = title ?? 'Nguyên liệu hôm nay';

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.iconBtn} hitSlop={8}>
          <ArrowLeft size={22} color={INK} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {headerTitle}
          </Text>
          <Text style={s.headerSub}>{formatDateLabel(date)}</Text>
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
          <Leaf size={40} color={YELLOW} strokeWidth={1.6} />
          <Text style={s.emptyTitle}>Chưa có nguyên liệu</Text>
          <Text style={s.emptySub}>
            Các món trong ngày chưa gắn nguyên liệu, hoặc đã bị bỏ qua hết.
          </Text>
        </View>
      ) : (
        <FlatList
          data={data.items}
          keyExtractor={(item, idx) =>
            `${item.ingredientId ?? item.name}-${item.unit ?? ''}-${idx}`
          }
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
            <Card style={s.summaryCard}>
              <Text style={s.summaryTitle}>
                {data.totalCount} nguyên liệu · {data.dishes.length} món
              </Text>
              <Text style={s.summarySub} numberOfLines={2}>
                {data.dishes.map((d) => d.name).join(' · ')}
              </Text>
            </Card>
          }
          renderItem={({ item }) => <IngredientRow item={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function IngredientRow({ item }: { item: DayIngredientItem }) {
  const [done, setDone] = useState(false);
  return (
    <Pressable onPress={() => setDone(!done)}>
      <Card style={[s.row, done && { opacity: 0.55, backgroundColor: '#F8F8F6' }]}>
        <Checkbox
          checked={done}
          onCheckedChange={setDone}
          className="mr-1"
        />
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
            style={[
              s.name,
              done && { textDecorationLine: 'line-through', color: MUTED },
            ]}
            numberOfLines={1}
          >
            {item.name}
            {item.isOptional ? ' (tuỳ chọn)' : ''}
          </Text>
          <Text style={s.meta} numberOfLines={1}>
            {item.usedInDishes.join(' · ')}
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
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: INK },
  headerSub: { fontSize: 12, color: MUTED, marginTop: 1, textTransform: 'capitalize' },
  list: { padding: 16, paddingBottom: 40 },
  summaryCard: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: INK },
  summarySub: { fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  thumb: { width: 48, height: 48, borderRadius: 12 },
  thumbFallback: {
    backgroundColor: '#F0FFF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 15, fontWeight: '600', color: INK },
  meta: { fontSize: 12, color: MUTED, marginTop: 3 },
  qty: { fontSize: 13, fontWeight: '700', color: '#5A7A2A', maxWidth: 88, textAlign: 'right' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: INK },
  emptySub: { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 20 },
  errorText: { fontSize: 14, color: '#B91C1C', textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: YELLOW,
  },
  retryText: { fontWeight: '700', color: INK },
});

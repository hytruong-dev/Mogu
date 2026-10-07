import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { dishesApi } from '../../../services/api/dishes';
import { P, PageScaffold, PCard, PTabs, EmptyBlock } from '../ProfileUI';
import { FoodRow, LoadBlock, dishImageSource, errMsg } from '../shared';

const PAGE_SIZE = 30;

type HistoryRow = {
  id: string;
  createdAt: string;
  outcome: string;
  isSelected: boolean;
  dishId?: string | null;
  dish: { id: string; name: string; imageUrl?: string | null; media?: any[] } | null;
};

export function HistoryPage({ onOpenDish }: { onOpenDish?: (dishId: string, title?: string) => void }) {
  const [filter, setFilter] = useState<'ALL' | 'SELECTED' | 'SKIPPED'>('ALL');

  const summaryQuery = useQuery({
    queryKey: ['profile', 'historyList', 'summary'],
    queryFn: () => dishesApi.getRandomHistorySummary(),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const listQuery = useInfiniteQuery({
    queryKey: ['profile', 'historyList', 'items'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await dishesApi.getRandomHistory(PAGE_SIZE, pageParam);
      return {
        items: (res.data ?? []) as HistoryRow[],
        nextCursor: res.pageInfo?.hasNextPage ? (res.pageInfo.nextCursor ?? null) : null,
      };
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = listQuery;
  const items = useMemo(() => listQuery.data?.pages.flatMap((p) => p.items) ?? [], [listQuery.data]);
  const summary = summaryQuery.data ?? null;
  const loading = listQuery.isLoading && items.length === 0;
  const queryError = listQuery.error ?? (summaryQuery.isError && !summary ? summaryQuery.error : null);
  const error = queryError ? errMsg(queryError, 'Không tải được lịch sử Random.') : null;

  const refetchAll = useCallback(() => {
    void summaryQuery.refetch();
    void listQuery.refetch();
  }, [summaryQuery, listQuery]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const total = summary?.totalRuns ?? 0;
  const selected = summary?.selectedCount ?? 0;
  const skipped = summary?.skippedCount ?? Math.max(total - selected, 0);
  const rate = total > 0 ? Math.round((selected / total) * 100) : 0;

  const isSel = (row: HistoryRow) => row.isSelected || row.outcome === 'SELECTED';
  const visible = items.filter((r) => (filter === 'ALL' ? true : filter === 'SELECTED' ? isSel(r) : !isSel(r)));
  const groups = groupByDay(visible);

  // Tab counts come from the server summary (accurate across pages), not the loaded slice.
  return (
    <PageScaffold gap={12} onEndReached={onEndReached}>
      <LoadBlock
        loading={loading}
        error={error}
        onRetry={refetchAll}
        empty={!loading && !error && items.length === 0 && total === 0}
        emptyText="Chưa có lần Random nào"
        emptyEmoji="🎲"
        skeleton="history"
      >
        <Animated.View entering={FadeInDown.duration(380)}>
          <LinearGradient colors={['#2A1A10', '#4A3225']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={rs.hero}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={rs.heroDice}>
                <Text style={{ fontSize: 30 }}>🎲</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={rs.heroLabel}>Tổng số lần Random</Text>
                <Text style={rs.heroValue}>{total}</Text>
              </View>
              <View style={rs.rateRing}>
                <Text style={rs.rateValue}>{rate}%</Text>
                <Text style={rs.rateLabel}>chọn</Text>
              </View>
            </View>
            <View style={rs.heroStats}>
              <View style={{ flex: 1 }}>
                <Text style={rs.heroStatValue}>{selected}</Text>
                <Text style={rs.heroStatLabel}>✅ Đã chọn ăn</Text>
              </View>
              <View style={rs.heroStatDivider} />
              <View style={{ flex: 1 }}>
                <Text style={rs.heroStatValue}>{skipped}</Text>
                <Text style={rs.heroStatLabel}>🔁 Random lại</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        <PTabs
          tabs={[
            { key: 'ALL', label: 'Tất cả', count: total || items.length },
            { key: 'SELECTED', label: 'Đã chọn', count: summary ? selected : items.filter(isSel).length },
            { key: 'SKIPPED', label: 'Random lại', count: summary ? skipped : items.filter((r) => !isSel(r)).length },
          ]}
          value={filter}
          onChange={setFilter}
        />

        {visible.length === 0 ? (
          <PCard>
            <EmptyBlock
              emoji="🍽️"
              title="Không có mục nào"
              body={hasNextPage ? 'Kéo xuống để tải thêm lịch sử.' : 'Thử đổi bộ lọc ở trên.'}
            />
          </PCard>
        ) : (
          groups.map((g, gi) => (
            <View key={g.key} style={{ gap: 10 }}>
              <Text style={rs.dayLabel}>{g.label}</Text>
              {g.rows.map((row, i) => {
                const dish = row.dish;
                const dishId = dish?.id ?? row.dishId;
                const sel = isSel(row);
                return (
                  <Animated.View key={row.id} entering={FadeInDown.delay(Math.min(gi * 3 + i, 8) * 40).duration(300)}>
                    <FoodRow
                      image={dishImageSource(dish?.imageUrl, dish?.media)}
                      name={dish?.name ?? 'Món không còn khả dụng'}
                      meta={formatClock(row.createdAt)}
                      badge={{ text: sel ? 'Đã chọn' : 'Random lại', variant: sel ? 'success' : 'muted' }}
                      onPress={dishId ? () => onOpenDish?.(dishId, dish?.name) : undefined}
                    />
                  </Animated.View>
                );
              })}
            </View>
          ))
        )}
        {isFetchingNextPage ? <ActivityIndicator color={P.muted} style={{ paddingVertical: 12 }} /> : null}
      </LoadBlock>
    </PageScaffold>
  );
}

function groupByDay(rows: HistoryRow[]) {
  const today = new Date();
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const todayKey = keyOf(today);
  const yestKey = keyOf(yest);
  const map = new Map<string, { key: string; label: string; rows: HistoryRow[] }>();
  for (const r of rows) {
    const d = new Date(r.createdAt);
    const valid = !Number.isNaN(d.getTime());
    const key = valid ? keyOf(d) : 'unknown';
    if (!map.has(key)) {
      const label = !valid
        ? 'Không rõ ngày'
        : key === todayKey
          ? 'Hôm nay'
          : key === yestKey
            ? 'Hôm qua'
            : d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' });
      map.set(key, { key, label: label.charAt(0).toUpperCase() + label.slice(1), rows: [] });
    }
    map.get(key)!.rows.push(r);
  }
  return Array.from(map.values());
}

function formatClock(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

const rs = StyleSheet.create({
  hero: { borderRadius: 24, padding: 18, gap: 16 },
  heroDice: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255,201,40,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  heroValue: { fontSize: 36, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1, lineHeight: 40 },
  rateRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: P.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateValue: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
  rateLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '700' },
  heroStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 12 },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 12 },
  heroStatValue: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  heroStatLabel: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  dayLabel: { fontSize: 13, fontWeight: '800', color: P.muted, letterSpacing: 0.3, marginTop: 4 },
});

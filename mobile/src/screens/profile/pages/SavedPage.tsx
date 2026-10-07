import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { StyledPressable as Pressable } from '../../../components/ui/styled-pressable';
import { dishesApi } from '../../../services/api/dishes';
import type { SavedDishItem } from '../../../services/api/types';
import { PROFILE_DASHBOARD_QUERY_KEY } from '../../../hooks/useProfileDashboard';
import { Bookmark } from '@/components/icons';
import { P, PageScaffold, PSearchBar, SectionTitle, InlineNotice } from '../ProfileUI';
import { FoodRow, LoadBlock, confirmAction, dishImageSource, errMsg, formatPriceRange } from '../shared';

const PAGE_SIZE = 20;
type SavedPageData = { pages: Array<{ items: SavedDishItem[]; nextCursor: string | null }>; pageParams: unknown[] };

export function SavedPage({ onOpenDish }: { onOpenDish?: (dishId: string, title?: string) => void }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [qApplied, setQApplied] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const queryKey = useMemo(() => ['profile', 'savedDishes', qApplied] as const, [qApplied]);

  const { data, isLoading, error: queryError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey,
      initialPageParam: undefined as string | undefined,
      queryFn: async ({ pageParam }) => {
        const res = await dishesApi.getSaved(pageParam, PAGE_SIZE, qApplied || undefined);
        return {
          items: (res.data ?? res.items ?? []) as SavedDishItem[],
          nextCursor: res.pageInfo?.hasNextPage ? (res.pageInfo.nextCursor ?? null) : null,
        };
      },
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      staleTime: 0,
    });

  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const loading = isLoading && items.length === 0;
  const error = queryError ? errMsg(queryError, 'Không tải được món đã lưu.') : null;

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const unsave = useCallback(
    (dishId: string, name: string) => {
      confirmAction(
        'Bỏ lưu món này?',
        `“${name}” sẽ bị xoá khỏi danh sách món đã lưu.`,
        async () => {
          const prev = queryClient.getQueryData<SavedPageData>(queryKey);
          queryClient.setQueryData<SavedPageData>(queryKey, (old) =>
            old
              ? {
                  ...old,
                  pages: old.pages.map((p) => ({
                    ...p,
                    items: p.items.filter((r) => (r.dish?.id ?? r.dishId) !== dishId),
                  })),
                }
              : old,
          );
          try {
            await dishesApi.unsave(dishId);
            setNotice(null);
            void queryClient.invalidateQueries({ queryKey: PROFILE_DASHBOARD_QUERY_KEY });
            void queryClient.invalidateQueries({ queryKey: ['profile', 'savedDishes'] });
          } catch (e) {
            queryClient.setQueryData(queryKey, prev);
            setNotice(errMsg(e, 'Không bỏ lưu được món này.'));
          }
        },
        'Bỏ lưu',
        'warning',
      );
    },
    [queryClient, queryKey],
  );

  return (
    <PageScaffold gap={10} onEndReached={onEndReached}>
      <PSearchBar
        value={query}
        onChangeText={(t) => {
          setQuery(t);
          if (!t) setQApplied('');
        }}
        placeholder="Tìm trong món đã lưu…"
        onSubmit={() => setQApplied(query.trim())}
      />
      {notice ? <InlineNotice tone="error" text={notice} /> : null}
      <LoadBlock
        loading={loading}
        error={error}
        onRetry={() => void refetch()}
        empty={!loading && !error && items.length === 0}
        emptyText={qApplied ? 'Không tìm thấy món nào' : 'Chưa có món đã lưu'}
        emptyEmoji="🔖"
        skeleton="saved"
      >
        <SectionTitle
          title={`${items.length}${hasNextPage ? '+' : ''} món`}
          sub={qApplied ? `Kết quả cho “${qApplied}”` : 'Chạm để xem, nhấn dấu trang để bỏ lưu'}
        />
        {items.map((row, i) => {
          const dish = row.dish;
          const dishId = dish?.id ?? row.dishId;
          const kcal = dish.kcal ?? dish.nutrition?.calories ?? (dish as any).calories;
          const minutes = dish.cookTimeMinutes ?? (dish as any).prepMinutes ?? (dish as any).cookMinutes;
          const price = formatPriceRange((dish as any).priceMin, (dish as any).priceMax);
          const chips = [
            kcal != null ? `🔥 ${kcal} kcal` : null,
            minutes != null ? `⏱ ${minutes} phút` : null,
            price ? `💰 ${price}` : null,
          ].filter(Boolean) as string[];
          return (
            <Animated.View key={row.id ?? dishId} entering={FadeInDown.delay(Math.min(i, 8) * 40).duration(320)}>
              <FoodRow
                image={dishImageSource((dish as any).thumbnailUrl ?? (dish as any).imageUrl, (dish as any).media)}
                name={dish.name ?? 'Món ăn'}
                chips={chips}
                onPress={dishId ? () => onOpenDish?.(dishId, dish?.name) : undefined}
                trailing={
                  <Pressable
                    onPress={() => unsave(dishId, dish.name ?? 'Món ăn')}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Bỏ lưu món"
                    style={{ padding: 6 }}
                  >
                    <Bookmark size={22} color={P.accent} fill={P.accent} />
                  </Pressable>
                }
              />
            </Animated.View>
          );
        })}
        {isFetchingNextPage ? <ActivityIndicator color={P.muted} style={{ paddingVertical: 12 }} /> : null}
        {!hasNextPage && items.length > 8 ? (
          <Text style={{ textAlign: 'center', color: P.faint, fontSize: 12.5, paddingVertical: 8 }}>
            Đã hiển thị tất cả món đã lưu
          </Text>
        ) : null}
      </LoadBlock>
    </PageScaffold>
  );
}

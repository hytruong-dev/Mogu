import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { StyledPressable as Pressable } from '../../../components/ui/styled-pressable';
import { AvatarImage } from '../../../components/organisms/AvatarImage';
import { communityApi } from '../../../services/api/explore';
import { profileApi, type FollowUser } from '../../../services/api/profile';
import { PROFILE_DASHBOARD_QUERY_KEY } from '../../../hooks/useProfileDashboard';
import { P, PageScaffold, PCard, PSearchBar, PTabs, InlineNotice } from '../ProfileUI';
import { LoadBlock, errMsg } from '../shared';

const PAGE_SIZE = 20;
type Tab = 'followers' | 'following';
type Pages = { pages: Array<{ items: FollowUser[]; nextCursor: string | null }>; pageParams: unknown[] };

export function FollowersPage({
  initialTab = 'followers',
  followerCount,
  followingCount,
  onOpenProfile,
}: {
  initialTab?: Tab;
  followerCount?: number;
  followingCount?: number;
  onOpenProfile?: (userId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState('');
  const [qApplied, setQApplied] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const listKey = useMemo(() => ['profile', 'followList', tab, qApplied] as const, [tab, qApplied]);

  const { data, isLoading, error: queryError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: listKey,
      initialPageParam: undefined as string | undefined,
      queryFn: async ({ pageParam }) => {
        const params = { cursor: pageParam, limit: PAGE_SIZE, q: qApplied || undefined };
        const res = tab === 'followers' ? await profileApi.getFollowers(params) : await profileApi.getFollowing(params);
        return {
          items: res.items ?? [],
          nextCursor: res.pageInfo?.hasNextPage ? (res.pageInfo.nextCursor ?? null) : null,
        };
      },
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      staleTime: 0,
      refetchOnMount: 'always',
    });

  const users = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const loading = isLoading && users.length === 0;
  const error = queryError ? errMsg(queryError, 'Không tải được danh sách.') : null;

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const patchUser = useCallback(
    (userId: string, isFollowing: boolean) => {
      queryClient.setQueriesData<Pages>({ queryKey: ['profile', 'followList'] }, (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((pg) => ({
                ...pg,
                items: pg.items.map((u) => (u.userId === userId ? { ...u, isFollowing } : u)),
              })),
            }
          : old,
      );
    },
    [queryClient],
  );

  const toggleFollow = useCallback(
    async (user: FollowUser) => {
      const next = !user.isFollowing;
      setBusyId(user.userId);
      setNotice(null);
      patchUser(user.userId, next);
      try {
        if (next) await communityApi.followUser(user.userId);
        else await communityApi.unfollowUser(user.userId);
        void queryClient.invalidateQueries({ queryKey: PROFILE_DASHBOARD_QUERY_KEY });
        // "Following" tab membership changes when toggling; refresh it lazily.
        void queryClient.invalidateQueries({ queryKey: ['profile', 'followList', 'following'] });
      } catch (e) {
        patchUser(user.userId, !next);
        setNotice(errMsg(e, 'Không thực hiện được thao tác.'));
      } finally {
        setBusyId(null);
      }
    },
    [patchUser, queryClient],
  );

  return (
    <PageScaffold gap={10} onEndReached={onEndReached}>
      <PTabs
        tabs={[
          { key: 'followers' as Tab, label: 'Người theo dõi', count: followerCount },
          { key: 'following' as Tab, label: 'Đang theo dõi', count: followingCount },
        ]}
        value={tab}
        onChange={(k) => {
          setTab(k);
          setQuery('');
          setQApplied('');
        }}
      />
      <PSearchBar
        value={query}
        onChangeText={(t) => {
          setQuery(t);
          if (!t) setQApplied('');
        }}
        placeholder="Tìm theo tên…"
        onSubmit={() => setQApplied(query.trim())}
      />
      {notice ? <InlineNotice tone="error" text={notice} /> : null}
      <LoadBlock
        loading={loading}
        error={error}
        onRetry={() => void refetch()}
        empty={!loading && !error && users.length === 0}
        emptyText={
          qApplied
            ? 'Không tìm thấy ai'
            : tab === 'followers'
              ? 'Chưa có người theo dõi'
              : 'Bạn chưa theo dõi ai'
        }
        emptyEmoji="👥"
        skeleton="list"
      >
        {users.map((u, i) => (
          <Animated.View key={u.userId} entering={FadeInDown.delay(Math.min(i, 8) * 35).duration(300)}>
            <PCard noPadding>
              <Pressable
                onPress={() => onOpenProfile?.(u.userId)}
                disabled={!onOpenProfile}
                accessibilityRole="button"
                accessibilityLabel={`Xem trang cá nhân ${u.displayName ?? ''}`}
                style={fz.row}
              >
                <AvatarImage uri={u.avatarUrl} size={46} seed={u.displayName ?? u.userId} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={fz.name} numberOfLines={1}>
                    {u.displayName ?? 'Người dùng'}
                  </Text>
                  {u.bio ? (
                    <Text style={fz.bio} numberOfLines={1}>
                      {u.bio}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => void toggleFollow(u)}
                  disabled={busyId === u.userId}
                  hitSlop={6}
                  style={[fz.btn, u.isFollowing && fz.btnOn]}
                  accessibilityRole="button"
                  accessibilityLabel={u.isFollowing ? 'Bỏ theo dõi' : 'Theo dõi'}
                >
                  <Text style={[fz.btnTxt, u.isFollowing && { color: P.ink2 }]}>
                    {u.isFollowing ? 'Đang theo dõi' : tab === 'followers' ? 'Theo dõi lại' : 'Theo dõi'}
                  </Text>
                </Pressable>
              </Pressable>
            </PCard>
          </Animated.View>
        ))}
        {isFetchingNextPage ? <ActivityIndicator color={P.muted} style={{ paddingVertical: 12 }} /> : null}
      </LoadBlock>
    </PageScaffold>
  );
}

const fz = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  name: { fontSize: 15, fontWeight: '800', color: P.ink },
  bio: { fontSize: 12.5, color: P.muted },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: P.accent },
  btnOn: { backgroundColor: '#F3EDE2' },
  btnTxt: { fontSize: 12.5, fontWeight: '800', color: P.ink },
});

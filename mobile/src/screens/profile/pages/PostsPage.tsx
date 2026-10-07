import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { StyledPressable as Pressable } from '../../../components/ui/styled-pressable';
import { AvatarImage } from '../../../components/organisms/AvatarImage';
import { communityApi, type ExplorePost } from '../../../services/api/explore';
import { recordPostDeletedStore, recordPostUpdatedStore } from '../../../services/app-store';
import { Heart, MessageCircle, Send, Trash2 } from '@/components/icons';
import { P, PageScaffold, PCard, PSearchBar, PTabs, StatTile, InlineNotice } from '../ProfileUI';
import { LoadBlock, confirmAction, errMsg, formatRelTime } from '../shared';

const PAGE_SIZE = 20;
type Tab = 'ACTIVE' | 'DRAFT';

export function PostsPage({ onOpenPost }: { onOpenPost?: (postId: string) => void }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('ACTIVE');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  // Totals come from the dashboard so tab badges stay accurate with pagination.
  const counts = useQuery({
    queryKey: ['profile', 'postsList', 'counts'],
    queryFn: async () => {
      const [pub, draft] = await Promise.all([
        communityApi.listPosts({ scope: 'ME', status: 'ACTIVE', limit: 50 }),
        communityApi.listPosts({ scope: 'ME', status: 'DRAFT', limit: 50 }),
      ]);
      const pubItems = (pub.data ?? []) as ExplorePost[];
      return {
        published: pubItems.length,
        publishedMore: !!pub.hasMore,
        drafts: (draft.data ?? []).length,
        draftsMore: !!draft.hasMore,
        likes: pubItems.reduce((a, p) => a + (p.likeCount ?? 0), 0),
        comments: pubItems.reduce((a, p) => a + (p.commentCount ?? 0), 0),
      };
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const listKey = useMemo(() => ['profile', 'postsList', tab, appliedQuery] as const, [tab, appliedQuery]);
  const { data, isLoading, error: queryError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: listKey,
      initialPageParam: undefined as string | undefined,
      queryFn: async ({ pageParam }) => {
        const res = await communityApi.listPosts({
          scope: 'ME',
          status: tab,
          limit: PAGE_SIZE,
          cursor: pageParam,
          q: appliedQuery || undefined,
        });
        return { items: (res.data ?? []) as ExplorePost[], nextCursor: res.hasMore ? (res.nextCursor ?? null) : null };
      },
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      staleTime: 0,
      refetchOnMount: 'always',
    });

  const posts = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const loading = isLoading && posts.length === 0;
  const error = queryError ? errMsg(queryError, 'Không tải được bài viết.') : null;

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const publishDraft = useCallback(
    async (post: ExplorePost) => {
      setBusyId(post.id);
      setNotice(null);
      try {
        const updated = await communityApi.updatePost(post.id, { status: 'ACTIVE' });
        recordPostUpdatedStore({ ...post, ...updated, status: 'ACTIVE' });
        setNotice({ tone: 'success', text: 'Đã đăng bài viết.' });
      } catch (e) {
        setNotice({ tone: 'error', text: errMsg(e, 'Không đăng được bài viết.') });
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  const removePost = useCallback(
    (post: ExplorePost) => {
      confirmAction(
        'Xoá bài viết?',
        'Bài viết sẽ bị xoá vĩnh viễn và không thể khôi phục.',
        async () => {
          setBusyId(post.id);
          setNotice(null);
          const prev = queryClient.getQueryData(listKey);
          queryClient.setQueryData<{ pages: Array<{ items: ExplorePost[]; nextCursor: string | null }>; pageParams: unknown[] }>(
            listKey,
            (old) =>
              old ? { ...old, pages: old.pages.map((pg) => ({ ...pg, items: pg.items.filter((p) => p.id !== post.id) })) } : old,
          );
          try {
            await communityApi.deletePost(post.id);
            recordPostDeletedStore(post.id);
          } catch (e) {
            queryClient.setQueryData(listKey, prev);
            setNotice({ tone: 'error', text: errMsg(e, 'Không xoá được bài viết.') });
          } finally {
            setBusyId(null);
          }
        },
        'Xoá',
        'danger',
      );
    },
    [queryClient, listKey],
  );

  const c = counts.data;
  const badge = (n?: number, more?: boolean) => (n === undefined ? undefined : more ? n : n);

  return (
    <PageScaffold gap={12} onEndReached={onEndReached}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatTile emoji="📝" value={c?.published ?? 0} label="Đã đăng" tint="yellow" />
        <StatTile emoji="❤️" value={c?.likes ?? 0} label="Lượt thích" tint="red" />
        <StatTile emoji="💬" value={c?.comments ?? 0} label="Bình luận" tint="blue" />
      </View>

      <PTabs
        tabs={[
          { key: 'ACTIVE' as Tab, label: 'Đã đăng', count: badge(c?.published, c?.publishedMore) },
          { key: 'DRAFT' as Tab, label: 'Bản nháp', count: badge(c?.drafts, c?.draftsMore) },
        ]}
        value={tab}
        onChange={setTab}
      />

      <PSearchBar
        value={query}
        onChangeText={(t) => {
          setQuery(t);
          if (!t) setAppliedQuery('');
        }}
        placeholder="Tìm bài viết…"
        onSubmit={() => setAppliedQuery(query.trim())}
      />

      {notice ? <InlineNotice tone={notice.tone} text={notice.text} /> : null}

      <LoadBlock
        loading={loading}
        error={error}
        onRetry={() => void refetch()}
        empty={!loading && !error && posts.length === 0}
        emptyText={tab === 'ACTIVE' ? 'Chưa có bài viết nào' : 'Chưa có bản nháp'}
        emptyEmoji={tab === 'ACTIVE' ? '📭' : '✏️'}
        skeleton="list"
      >
        {posts.map((p, i) => {
          const img = p.imageUrls?.[0];
          const busy = busyId === p.id;
          return (
            <Animated.View key={p.id} entering={FadeInDown.delay(Math.min(i, 8) * 40).duration(320)}>
              <PCard noPadding style={{ overflow: 'hidden', opacity: busy ? 0.6 : 1 }}>
                <Pressable
                  onPress={() => onOpenPost?.(p.id)}
                  disabled={!onOpenPost || tab === 'DRAFT'}
                  accessibilityRole="button"
                  accessibilityLabel="Xem chi tiết bài viết"
                >
                  {img ? <Image source={{ uri: img }} style={{ width: '100%', height: 190 }} resizeMode="cover" /> : null}
                  <View style={{ padding: 14, gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <AvatarImage uri={p.author?.avatarUrl} size={36} seed={p.author?.displayName ?? p.id} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14.5, fontWeight: '800', color: P.ink }} numberOfLines={1}>
                          {p.author?.displayName ?? 'Bạn'}
                        </Text>
                        <Text style={{ fontSize: 12, color: P.muted }}>{formatRelTime(p.createdAt)}</Text>
                      </View>
                      <View style={[pz.status, tab === 'DRAFT' && { backgroundColor: '#F3EDE2' }]}>
                        <Text style={[pz.statusTxt, tab === 'DRAFT' && { color: P.muted }]}>
                          {tab === 'DRAFT' ? 'Bản nháp' : 'Đã đăng'}
                        </Text>
                      </View>
                    </View>
                    {p.content ? (
                      <Text style={{ fontSize: 15, color: P.ink, lineHeight: 22 }} numberOfLines={4}>
                        {p.content}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#F6EFE2' }}>
                      <View style={pz.metric}>
                        <Heart size={15} color="#E5402A" fill={(p.likeCount ?? 0) > 0 ? '#E5402A' : 'transparent'} />
                        <Text style={pz.metricTxt}>{p.likeCount ?? 0}</Text>
                      </View>
                      <View style={pz.metric}>
                        <MessageCircle size={15} color={P.muted} />
                        <Text style={pz.metricTxt}>{p.commentCount ?? 0}</Text>
                      </View>
                      <View style={{ flex: 1 }} />
                      {tab === 'DRAFT' ? (
                        <Pressable onPress={() => void publishDraft(p)} disabled={busy} style={pz.action} accessibilityLabel="Đăng bài">
                          <Send size={14} color={P.ink} />
                          <Text style={pz.actionTxt}>Đăng</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => removePost(p)}
                        disabled={busy}
                        style={[pz.action, { backgroundColor: P.dangerSoft }]}
                        accessibilityLabel="Xoá bài"
                      >
                        <Trash2 size={14} color={P.danger} />
                        <Text style={[pz.actionTxt, { color: P.danger }]}>Xoá</Text>
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              </PCard>
            </Animated.View>
          );
        })}
        {isFetchingNextPage ? <ActivityIndicator color={P.muted} style={{ paddingVertical: 12 }} /> : null}
      </LoadBlock>
    </PageScaffold>
  );
}

const pz = StyleSheet.create({
  status: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: P.successSoft },
  statusTxt: { fontSize: 11.5, fontWeight: '800', color: P.success },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 6 },
  metricTxt: { fontSize: 13.5, fontWeight: '700', color: P.ink2 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: P.accent,
    marginTop: 6,
  },
  actionTxt: { fontSize: 12.5, fontWeight: '800', color: P.ink },
});

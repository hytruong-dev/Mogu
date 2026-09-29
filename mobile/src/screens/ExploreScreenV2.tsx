import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Bookmark, Plus, Search } from '@/components/icons';
import { profileApi } from '../services/api/profile';
import { ExploreDetailScreen, type ExploreDetailType } from './ExploreDetailScreen';
import { ScreenSlideTransition } from '../components/ui/screen-transition';
import { LiquidGlassBottomNav } from '../components/organisms/LiquidGlassBottomNav';
import { NoanWordmark } from '../components/brand/NoanWordmark';
import { ExploreFeedSkeleton } from '../components/skeletons/ScreenSkeletons';
import {
  articlesApi,
  communityApi,
  exploreApi,
  meApi,
  moderationApi,
  type ExploreArticle,
  type ExploreFeedItem,
  type ExplorePost,
  type ExploreTopic,
} from '../services/api/explore';
import { dishesApi, type Dish } from '../services/api/dishes';
import { toggleDishSave } from '../services/saved-dishes-store';
import { homeApi } from '../services/api/home';
import { notificationRealtime } from '../services/notification-realtime';
import { ExploreSearchScreen } from './explore/ExploreSearchScreen';
import {
  ArticleFeedItem,
  DishFeedItem,
  PostFeedItem,
  StoriesRow,
} from './explore/FeedItems';
import { resolveDishImageUrl } from './explore/utils';
import { CreatePostScreen } from './explore/CreatePostScreen';
import { ContentActionSheet } from './explore/ContentActionSheet';
import {
  ArticleShareSheet,
  toShareArticle,
  type ExploreShareArticle,
} from './explore/ArticleShareSheet';
import { PublicProfileScreen } from './explore/PublicProfileScreen';
import { SavedCollectionsScreen } from './explore/SavedCollectionsScreen';
import { TopicFeedScreen } from './explore/TopicFeedScreen';
import type { ContentActionTarget } from './explore/buildContentActions';
import {
  BORDER,
  CORAL_DOT,
  FEED_BG,
  H_PAD,
  INK,
  MUTED,
  TERTIARY,
  WHITE,
  YELLOW,
} from './explore/tokens';

const AnimatedFlatList = Animated.FlatList as unknown as typeof import('react-native').FlatList;

function ScopeTabs({
  scope,
  onChange,
}: {
  scope: 'forYou' | 'following';
  onChange: (s: 'forYou' | 'following') => void;
}) {
  const [width, setWidth] = useState(0);
  const x = useSharedValue(scope === 'forYou' ? 0 : 1);

  useEffect(() => {
    x.value = withTiming(scope === 'forYou' ? 0 : 1, { duration: 220 });
  }, [scope, x]);

  const half = width / 2;
  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value * half + half * 0.3 }],
    width: half * 0.4,
  }));

  const tabs: Array<{ key: 'forYou' | 'following'; label: string }> = [
    { key: 'forYou', label: 'Dành cho bạn' },
    { key: 'following', label: 'Đang theo dõi' },
  ];

  return (
    <View
      style={styles.tabsWrap}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {tabs.map((t) => {
        const active = scope === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => {
              if (active) return;
              void Haptics.selectionAsync().catch(() => undefined);
              onChange(t.key);
            }}
            style={styles.tabBtn}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.tabTxt, active && styles.tabTxtActive]}>{t.label}</Text>
          </Pressable>
        );
      })}
      {width > 0 ? <Animated.View style={[styles.tabIndicator, indicator]} /> : null}
    </View>
  );
}

type Props = {
  onBack: () => void;
  onHealth: () => void;
  onProfile: () => void;
  onRandom: () => void;
  onNotification?: () => void;
};

type FeedScope = 'forYou' | 'following';

type FeedItem =
  | {
      kind: 'dish';
      key: string;
      dish: Dish;
      rankingToken?: string;
      reasonCode?: string;
    }
  | {
      kind: 'article';
      key: string;
      article: ExploreArticle;
      rankingToken?: string;
      reasonCode?: string;
    }
  | {
      kind: 'post';
      key: string;
      post: ExplorePost;
      rankingToken?: string;
      reasonCode?: string;
    };

function mapFeedItems(raw: ExploreFeedItem[]): FeedItem[] {
  return raw.map((it) => {
    if (it.type === 'dish') {
      return {
        kind: 'dish' as const,
        key: `dish-${it.id}`,
        dish: it.dish as Dish,
        rankingToken: it.rankingToken,
        reasonCode: it.reasonCode,
      };
    }
    if (it.type === 'article') {
      return {
        kind: 'article' as const,
        key: `article-${it.id}`,
        article: it.article,
        rankingToken: it.rankingToken,
        reasonCode: it.reasonCode,
      };
    }
    return {
      kind: 'post' as const,
      key: `post-${it.id}`,
      post: it.post,
      rankingToken: it.rankingToken,
      reasonCode: it.reasonCode,
    };
  });
}

function interleaveFeed(
  dishes: Dish[],
  articles: ExploreArticle[],
  posts: ExplorePost[],
): FeedItem[] {
  const out: FeedItem[] = [];
  const max = Math.max(dishes.length, articles.length, posts.length);
  for (let i = 0; i < max; i++) {
    if (dishes[i]) out.push({ kind: 'dish', key: `dish-${dishes[i].id}`, dish: dishes[i] });
    if (posts[i]) out.push({ kind: 'post', key: `post-${posts[i].id}`, post: posts[i] });
    if (articles[i]) {
      out.push({ kind: 'article', key: `article-${articles[i].id}`, article: articles[i] });
    }
  }
  return out;
}

export function ExploreScreenV2({ onBack, onHealth, onProfile, onRandom, onNotification }: Props) {
  const [scope, setScope] = useState<FeedScope>('forYou');
  const [detail, setDetail] = useState<{ type: ExploreDetailType; resourceId: string } | null>(
    null,
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [topicFeed, setTopicFeed] = useState<ExploreTopic | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editPostId, setEditPostId] = useState<string | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const [topics, setTopics] = useState<ExploreTopic[]>([]);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [feedSessionId, setFeedSessionId] = useState<string | null>(null);
  const feedSessionRef = useRef<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTarget = useRef<ContentActionTarget | null>(null);

  const [savedArticles, setSavedArticles] = useState<Set<string>>(new Set());
  const [savedDishes, setSavedDishes] = useState<Set<string>>(new Set());
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [followingAuthors, setFollowingAuthors] = useState<Set<string>>(new Set());

  const [actionOpen, setActionOpen] = useState(false);
  const [actionTarget, setActionTarget] = useState<ContentActionTarget | null>(null);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [shareArticlePayload, setShareArticlePayload] = useState<ExploreShareArticle | null>(null);
  const [unreadNotif, setUnreadNotif] = useState(0);
  const [me, setMe] = useState<{ name: string; avatarUrl: string | null }>({
    name: 'Bạn',
    avatarUrl: null,
  });

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const headerShadow = useAnimatedStyle(() => ({
    borderBottomColor: `rgba(232,224,210,${interpolate(scrollY.value, [0, 24], [0, 1], 'clamp')})`,
    shadowOpacity: interpolate(scrollY.value, [0, 24], [0, 0.08], 'clamp'),
  }));

  useEffect(() => {
    void profileApi
      .me<{
        displayName?: string | null;
        basic?: { displayName?: string | null };
        avatarUrl?: string | null;
        avatar?: { url?: string | null; thumbnailUrl?: string | null };
      }>()
      .then((p) =>
        setMe({
          name: p.basic?.displayName ?? p.displayName ?? 'Bạn',
          avatarUrl: p.avatar?.thumbnailUrl ?? p.avatar?.url ?? p.avatarUrl ?? null,
        }),
      )
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const unsub = notificationRealtime.subscribeToUnreadCount((cnt) => {
      setUnreadNotif(cnt);
    });
    return unsub;
  }, []);

  useEffect(() => {
    void homeApi
      .getUnreadCount()
      .then((r) => setUnreadNotif(r.count ?? 0))
      .catch(() => undefined);
  }, [scope, refreshing, detail]);

  useEffect(() => {
    void (async () => {
      const [postsRes, articlesRes, dishesRes] = await Promise.all([
        meApi.listSavedPosts({ limit: 100 }).catch(() => null),
        meApi.listSavedArticles({ limit: 100 }).catch(() => null),
        dishesApi.getSaved(undefined, 100).catch(() => null),
      ]);
      if (postsRes) {
        const ids =
          postsRes.items?.map((r) => r.post?.id).filter(Boolean) ??
          postsRes.data?.map((p) => p.id) ??
          [];
        setSavedPosts(new Set(ids as string[]));
      }
      if (articlesRes) {
        const ids =
          articlesRes.items?.map((r) => r.article?.id).filter(Boolean) ??
          articlesRes.data?.map((a) => a.id) ??
          [];
        setSavedArticles(new Set(ids as string[]));
      }
      if (dishesRes) {
        const rows = (dishesRes as any).data ?? (dishesRes as any).items ?? [];
        const ids = rows
          .map((r: any) => r.dishId ?? r.dish?.id ?? r.id)
          .filter(Boolean) as string[];
        setSavedDishes(new Set(ids));
      }
    })();
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  }, []);

  const openDetail = useCallback(
    (type: ExploreDetailType, resourceId: string, meta?: { rankingToken?: string }) => {
      const contentType =
        type === 'article' ? 'ARTICLE' : type === 'post' ? 'COMMUNITY_POST' : 'DISH';
      void exploreApi
        .recordEvents([
          {
            contentType,
            contentId: resourceId,
            eventType: 'OPEN_DETAIL',
            rankingToken: meta?.rankingToken,
          },
        ])
        .catch(() => undefined);
      if (type === 'food') {
        dishesApi.logView(resourceId, 'explore').catch(() => undefined);
      }
      setDetail({ type, resourceId });
    },
    [],
  );

  const impressedKeys = useRef(new Set<string>());
  const pendingImpressions = useRef<
    Array<{
      contentType: 'COMMUNITY_POST' | 'ARTICLE' | 'DISH';
      contentId: string;
      eventType: 'IMPRESSION';
      rankingToken?: string;
    }>
  >([]);
  const impressionFlushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushImpressions = useCallback(() => {
    const batch = pendingImpressions.current.splice(0, pendingImpressions.current.length);
    if (!batch.length) return;
    void exploreApi.recordEvents(batch).catch(() => undefined);
  }, []);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ isViewable?: boolean; item?: FeedItem }> }) => {
      for (const token of viewableItems ?? []) {
        if (!token.isViewable || !token.item) continue;
        const item = token.item;
        if (impressedKeys.current.has(item.key)) continue;
        impressedKeys.current.add(item.key);
        if (item.kind === 'article') {
          pendingImpressions.current.push({
            contentType: 'ARTICLE',
            contentId: item.article.id,
            eventType: 'IMPRESSION',
            rankingToken: item.rankingToken,
          });
        } else if (item.kind === 'post') {
          pendingImpressions.current.push({
            contentType: 'COMMUNITY_POST',
            contentId: item.post.id,
            eventType: 'IMPRESSION',
            rankingToken: item.rankingToken,
          });
        } else if (item.kind === 'dish') {
          pendingImpressions.current.push({
            contentType: 'DISH',
            contentId: item.dish.id,
            eventType: 'IMPRESSION',
            rankingToken: item.rankingToken,
          });
        }
      }
      if (pendingImpressions.current.length) {
        if (impressionFlushTimer.current) clearTimeout(impressionFlushTimer.current);
        impressionFlushTimer.current = setTimeout(() => flushImpressions(), 400);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 1000,
  }).current;

  useEffect(() => {
    return () => {
      if (impressionFlushTimer.current) clearTimeout(impressionFlushTimer.current);
      flushImpressions();
    };
  }, [flushImpressions]);

  const patchFeedArticle = useCallback(
    (patch: {
      id: string;
      likeCount?: number;
      commentCount?: number;
      isLiked?: boolean;
      isSaved?: boolean;
    }) => {
      setItems((prev) =>
        prev.map((it) => {
          if (it.kind !== 'article' || it.article.id !== patch.id) return it;
          return {
            ...it,
            article: {
              ...it.article,
              ...(typeof patch.likeCount === 'number' ? { likeCount: patch.likeCount } : {}),
              ...(typeof patch.commentCount === 'number'
                ? { commentCount: patch.commentCount }
                : {}),
              ...(typeof patch.isLiked === 'boolean' ? { isLiked: patch.isLiked } : {}),
              ...(typeof patch.isSaved === 'boolean' ? { isSaved: patch.isSaved } : {}),
            },
          };
        }),
      );
      if (typeof patch.isSaved === 'boolean') {
        setSavedArticles((prev) => {
          const next = new Set(prev);
          if (patch.isSaved) next.add(patch.id);
          else next.delete(patch.id);
          return next;
        });
      }
    },
    [],
  );

  const patchFeedPost = useCallback(
    (patch: {
      id: string;
      likeCount?: number;
      commentCount?: number;
      isLiked?: boolean;
      isSaved?: boolean;
      isFollowingAuthor?: boolean;
    }) => {
      setItems((prev) => {
        let authorId: string | undefined;
        const next = prev.map((it) => {
          if (it.kind !== 'post' || it.post.id !== patch.id) return it;
          authorId = it.post.author?.userId;
          return {
            ...it,
            post: {
              ...it.post,
              ...(typeof patch.likeCount === 'number' ? { likeCount: patch.likeCount } : {}),
              ...(typeof patch.commentCount === 'number'
                ? { commentCount: patch.commentCount }
                : {}),
              ...(typeof patch.isLiked === 'boolean' ? { isLiked: patch.isLiked } : {}),
              ...(typeof patch.isSaved === 'boolean' ? { isSaved: patch.isSaved } : {}),
              ...(typeof patch.isFollowingAuthor === 'boolean'
                ? { isFollowingAuthor: patch.isFollowingAuthor }
                : {}),
            },
          };
        });
        if (typeof patch.isFollowingAuthor === 'boolean' && authorId) {
          setFollowingAuthors((f) => {
            const s = new Set(f);
            if (patch.isFollowingAuthor) s.add(authorId!);
            else s.delete(authorId!);
            return s;
          });
        }
        return next;
      });
      if (typeof patch.isSaved === 'boolean') {
        setSavedPosts((prev) => {
          const next = new Set(prev);
          if (patch.isSaved) next.add(patch.id);
          else next.delete(patch.id);
          return next;
        });
      }
    },
    [],
  );

  const loadForYou = useCallback(async (opts?: { cursor?: string; append?: boolean }) => {
    const feedRes = await exploreApi.getFeed({
      scope: 'forYou',
      cursor: opts?.cursor,
      limit: 20,
      feedSessionId: opts?.append ? feedSessionRef.current ?? undefined : undefined,
    }).catch(() => null);

    if (feedRes?.items?.length) {
      if (!opts?.append) setTopics(feedRes.topics ?? []);
      const mapped = mapFeedItems(feedRes.items);
      setItems((prev) => (opts?.append ? [...prev, ...mapped] : mapped));
      setCursor(feedRes.nextCursor ?? null);
      setHasMore(Boolean(feedRes.hasMore));
      if (feedRes.feedSessionId) {
        feedSessionRef.current = feedRes.feedSessionId;
        setFeedSessionId(feedRes.feedSessionId);
      }
      return;
    }

    if (opts?.append) {
      setHasMore(false);
      return;
    }

    const [articlesRes, postsRes] = await Promise.all([
      articlesApi.list({ limit: 20 }).catch(() => ({ data: [] as ExploreArticle[] })),
      communityApi.listPosts({ limit: 20 }).catch(() => ({ data: [] as ExplorePost[] })),
    ]);

    setTopics(feedRes?.topics ?? []);
    let articles = articlesRes.data ?? [];
    let posts = postsRes.data ?? [];
    if (feedRes?.featuredArticle && !articles.some((a) => a.id === feedRes.featuredArticle!.id)) {
      articles = [feedRes.featuredArticle, ...articles];
    }
    if (feedRes?.recentPosts?.length) {
      const ids = new Set(posts.map((p) => p.id));
      posts = [...feedRes.recentPosts.filter((p) => !ids.has(p.id)), ...posts];
    }
    setItems(interleaveFeed([], articles, posts));
    setCursor(null);
    setHasMore(false);
  }, []);

  const loadFollowing = useCallback(async (opts?: { cursor?: string; append?: boolean }) => {
    const feedRes = await exploreApi
      .getFeed({ scope: 'following', cursor: opts?.cursor, limit: 20 })
      .catch(() => null);

    if (feedRes?.items?.length) {
      const mapped = mapFeedItems(feedRes.items);
      if (!opts?.append) setTopics([]);
      setItems((prev) => (opts?.append ? [...prev, ...mapped] : mapped));
      setCursor(feedRes.nextCursor ?? null);
      setHasMore(Boolean(feedRes.hasMore));
      return;
    }

    const res = await communityApi.listPosts({
      limit: 20,
      scope: 'following',
      cursor: opts?.cursor,
    });
    let posts = res.data ?? [];
    const mapped = posts.map((post) => ({
      kind: 'post' as const,
      key: `post-${post.id}`,
      post,
    }));
    if (!opts?.append) setTopics([]);
    setItems((prev) => (opts?.append ? [...prev, ...mapped] : mapped));
    setCursor(res.nextCursor ?? null);
    setHasMore(Boolean(res.hasMore));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (scope === 'forYou') await loadForYou();
      else await loadFollowing();
    } catch (e: any) {
      setError(e?.message || 'Không tải được Khám phá');
    } finally {
      setLoading(false);
    }
  }, [scope, loadForYou, loadFollowing]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (scope === 'forYou') await loadForYou();
      else await loadFollowing();
    } catch (e: any) {
      setError(e?.message || 'Không tải được Khám phá');
    } finally {
      setRefreshing(false);
    }
  }, [scope, loadForYou, loadFollowing]);

  const onEndReached = useCallback(async () => {
    if (!hasMore || !cursor || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      if (scope === 'forYou') await loadForYou({ cursor, append: true });
      else await loadFollowing({ cursor, append: true });
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, cursor, loadingMore, loading, scope, loadForYou, loadFollowing]);

  const toggleLike = useCallback(async (postId: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.kind === 'post' && it.post.id === postId
          ? {
              ...it,
              post: {
                ...it.post,
                isLiked: !it.post.isLiked,
                likeCount: it.post.likeCount + (it.post.isLiked ? -1 : 1),
              },
            }
          : it,
      ),
    );
    try {
      await communityApi.toggleLike(postId);
    } catch {
      setItems((prev) =>
        prev.map((it) =>
          it.kind === 'post' && it.post.id === postId
            ? {
                ...it,
                post: {
                  ...it.post,
                  isLiked: !it.post.isLiked,
                  likeCount: it.post.likeCount + (it.post.isLiked ? -1 : 1),
                },
              }
            : it,
        ),
      );
    }
  }, []);

  const toggleLikeArticle = useCallback(async (articleId: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.kind !== 'article' || it.article.id !== articleId) return it;
        const liked = Boolean(it.article.isLiked);
        return {
          ...it,
          article: {
            ...it.article,
            isLiked: !liked,
            likeCount: Math.max(0, (it.article.likeCount ?? 0) + (liked ? -1 : 1)),
          },
        };
      }),
    );
    try {
      const res = await articlesApi.toggleLike(articleId);
      setItems((prev) =>
        prev.map((it) =>
          it.kind === 'article' && it.article.id === articleId
            ? {
                ...it,
                article: {
                  ...it.article,
                  isLiked: res.liked,
                  likeCount:
                    typeof res.likeCount === 'number'
                      ? res.likeCount
                      : it.article.likeCount,
                },
              }
            : it,
        ),
      );
    } catch {
      setItems((prev) =>
        prev.map((it) => {
          if (it.kind !== 'article' || it.article.id !== articleId) return it;
          const liked = Boolean(it.article.isLiked);
          return {
            ...it,
            article: {
              ...it.article,
              isLiked: !liked,
              likeCount: Math.max(0, (it.article.likeCount ?? 0) + (liked ? -1 : 1)),
            },
          };
        }),
      );
    }
  }, []);

  const openShareArticle = useCallback((article: ExploreArticle | ExploreShareArticle) => {
    const kind =
      'kind' in article && article.kind ? article.kind : ('ARTICLE' as const);
    setShareArticlePayload(toShareArticle({ ...article, kind }));
    setShareSheetOpen(true);
  }, []);

  const openSharePost = useCallback((post: ExplorePost) => {
    const cover =
      post.media?.[0]?.url ||
      post.imageUrls?.[0] ||
      post.dish?.thumbnailUrl ||
      post.place?.thumbnailUrl ||
      null;
    setShareArticlePayload(
      toShareArticle({
        id: post.id,
        content: post.content,
        title: post.dish?.name ? `Món: ${post.dish.name}` : undefined,
        coverImageUrl: cover,
        authorName: post.author?.displayName,
        shareUrl: post.shareUrl,
        kind: 'COMMUNITY_POST',
      }),
    );
    setShareSheetOpen(true);
  }, []);

  const toggleFollow = useCallback(
    async (userId: string) => {
      const was = followingAuthors.has(userId);
      setFollowingAuthors((prev) => {
        const next = new Set(prev);
        if (was) next.delete(userId);
        else next.add(userId);
        return next;
      });
      setItems((prev) =>
        prev.map((it) =>
          it.kind === 'post' && it.post.author.userId === userId
            ? { ...it, post: { ...it.post, isFollowingAuthor: !was } }
            : it,
        ),
      );
      try {
        if (was) await communityApi.unfollowUser(userId);
        else await communityApi.followUser(userId);
      } catch {
        setFollowingAuthors((prev) => {
          const next = new Set(prev);
          if (was) next.add(userId);
          else next.delete(userId);
          return next;
        });
      }
    },
    [followingAuthors],
  );

  const toggleSavePost = useCallback(
    async (postId: string) => {
      const was = savedPosts.has(postId);
      setSavedPosts((prev) => {
        const next = new Set(prev);
        if (was) next.delete(postId);
        else next.add(postId);
        return next;
      });
      try {
        if (was) await communityApi.unsavePost(postId);
        else await communityApi.savePost(postId);
      } catch {
        setSavedPosts((prev) => {
          const next = new Set(prev);
          if (was) next.add(postId);
          else next.delete(postId);
          return next;
        });
      }
    },
    [savedPosts],
  );

  const openAction = useCallback((target: ContentActionTarget) => {
    setActionTarget(target);
    setActionOpen(true);
  }, []);

  const removeByTarget = useCallback((target: ContentActionTarget) => {
    setItems((prev) =>
      prev.filter((it) => {
        if (target.kind === 'DISH') return !(it.kind === 'dish' && it.dish.id === target.id);
        if (target.kind === 'ARTICLE')
          return !(it.kind === 'article' && it.article.id === target.id);
        return !(it.kind === 'post' && it.post.id === target.id);
      }),
    );
  }, []);

  const changeScope = useCallback(
    (next: FeedScope) => {
      if (next === scope) return;
      setScope(next);
      setItems([]);
    },
    [scope],
  );

  const openCreate = useCallback(() => setCreateOpen(true), []);

  const listHeader = useMemo(
    () => (
      <View>
        <Pressable
          onPress={() => setSearchOpen(true)}
          style={styles.searchPill}
          accessibilityRole="search"
          accessibilityLabel="Tìm món ăn, bài viết, người dùng"
        >
          <Search size={18} color={TERTIARY} />
          <Text style={styles.searchPlaceholder} numberOfLines={1}>
            Tìm món ăn, bài viết, bạn bè…
          </Text>
        </Pressable>

        {scope === 'forYou' ? (
          <StoriesRow
            topics={topics}
            onPress={(t) => setTopicFeed(t)}
          />
        ) : (
          <View style={styles.followingHintWrap}>
            <Text style={styles.followingHint}>Bài mới nhất từ những người bạn theo dõi</Text>
          </View>
        )}
      </View>
    ),
    [scope, topics],
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => {
      if (item.kind === 'dish') {
        return (
          <DishFeedItem
            dish={item.dish}
            onPress={() => openDetail('food', item.dish.id, { rankingToken: item.rankingToken })}
            saved={savedDishes.has(item.dish.id) || Boolean(item.dish.isSaved)}
            onSave={async () => {
              const currentlySaved = savedDishes.has(item.dish.id) || Boolean(item.dish.isSaved);
              setSavedDishes((prev) => {
                const next = new Set(prev);
                if (currentlySaved) next.delete(item.dish.id);
                else next.add(item.dish.id);
                return next;
              });
              try {
                await toggleDishSave(item.dish.id, currentlySaved, {
                  name: item.dish.name,
                  imageUrl: resolveDishImageUrl(item.dish) ?? undefined,
                  priceMin: item.dish.priceMin ?? undefined,
                  priceMax: item.dish.priceMax ?? undefined,
                  kcal: (item.dish as any).nutrition?.calories ?? (item.dish as any).kcal ?? undefined,
                });
              } catch {
                setSavedDishes((prev) => {
                  const rollback = new Set(prev);
                  if (currentlySaved) rollback.add(item.dish.id);
                  else rollback.delete(item.dish.id);
                  return rollback;
                });
              }
            }}
            onMore={() =>
              openAction({
                kind: 'DISH',
                id: item.dish.id,
                title: item.dish.name,
                imageUrl: resolveDishImageUrl(item.dish),
                subtitle: 'Món ăn • NOAN',
                isSaved: savedDishes.has(item.dish.id) || Boolean(item.dish.isSaved),
                shareUrl: (item.dish as any).shareUrl,
                rankingToken: item.rankingToken,
                reasonCode: item.reasonCode,
              })
            }
          />
        );
      }
      if (item.kind === 'article') {
  return (
          <ArticleFeedItem
            article={item.article}
            onPress={() =>
              openDetail('article', item.article.id, { rankingToken: item.rankingToken })
            }
            liked={Boolean(item.article.isLiked)}
            saved={savedArticles.has(item.article.id) || Boolean(item.article.isSaved)}
            onLike={() => void toggleLikeArticle(item.article.id)}
            onShare={() => openShareArticle(item.article)}
            onSave={() => {
              const was = savedArticles.has(item.article.id) || Boolean(item.article.isSaved);
              setSavedArticles((prev) => {
                const next = new Set(prev);
                if (was) next.delete(item.article.id);
                else next.add(item.article.id);
                return next;
              });
              void (was
                ? articlesApi.unsave(item.article.id)
                : articlesApi.save(item.article.id)
              ).catch(() => undefined);
            }}
            onMore={() =>
              openAction({
                kind: 'ARTICLE',
                id: item.article.id,
                title: item.article.title,
                imageUrl: item.article.coverImageUrl,
                subtitle: 'Bài viết • NOAN',
                isSaved: savedArticles.has(item.article.id) || Boolean(item.article.isSaved),
                shareUrl: item.article.shareUrl,
                rankingToken: item.rankingToken,
                reasonCode: item.reasonCode,
              })
            }
            onAuthorPress={() =>
              item.article.author?.userId
                ? setProfileUserId(item.article.author.userId)
                : undefined
            }
          />
        );
      }
      const following =
        followingAuthors.has(item.post.author.userId) || Boolean(item.post.isFollowingAuthor);
  return (
        <PostFeedItem
          post={item.post}
          onPress={() => openDetail('post', item.post.id, { rankingToken: item.rankingToken })}
          onLike={() => void toggleLike(item.post.id)}
          onFollow={() => void toggleFollow(item.post.author.userId)}
          following={following}
          onSave={() => void toggleSavePost(item.post.id)}
          saved={savedPosts.has(item.post.id) || Boolean(item.post.isSaved)}
          onShare={() => openSharePost(item.post)}
          onAuthorPress={() =>
            item.post.author?.userId ? setProfileUserId(item.post.author.userId) : undefined
          }
          onMore={() =>
            openAction({
              kind: 'COMMUNITY_POST',
              id: item.post.id,
              title: item.post.content?.slice(0, 80),
              authorId: item.post.author?.userId,
              authorName: item.post.author?.displayName || 'Thành viên',
              authorAvatarUrl: item.post.author?.avatarUrl,
              imageUrl:
                item.post.media?.[0]?.url ||
                item.post.imageUrls?.[0] ||
                item.post.dish?.thumbnailUrl ||
                item.post.place?.thumbnailUrl,
              shareUrl: item.post.shareUrl,
              isSaved: savedPosts.has(item.post.id) || Boolean(item.post.isSaved),
              isFollowingAuthor: following,
              commentsEnabled: item.post.commentsEnabled,
              viewerCapabilities: item.post.viewerCapabilities,
              rankingToken: item.rankingToken,
              reasonCode: item.reasonCode,
            })
          }
        />
      );
    },
    [
      openDetail,
      savedDishes,
      savedArticles,
      savedPosts,
      followingAuthors,
      toggleLike,
      toggleLikeArticle,
      openShareArticle,
      openSharePost,
      toggleFollow,
      toggleSavePost,
      openAction,
    ],
  );

  const hideNav =
    createOpen || searchOpen || Boolean(detail) || Boolean(profileUserId) || savedOpen || Boolean(topicFeed);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <Animated.View style={[styles.topBar, headerShadow]}>
        <View style={styles.header}>
          <NoanWordmark width={96} height={36} />
          <View style={styles.headerRight}>
            <Pressable
              onPress={() => setSavedOpen(true)}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Bộ sưu tập đã lưu"
            >
              <Bookmark size={22} color={INK} />
            </Pressable>
            <Pressable
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel={
                unreadNotif > 0 ? `Thông báo, ${unreadNotif} chưa đọc` : 'Thông báo'
              }
              onPress={() => onNotification?.()}
            >
              <Bell size={23} color={INK} />
              {unreadNotif > 0 ? (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeTxt}>
                    {unreadNotif > 99 ? '99+' : unreadNotif}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>
        <ScopeTabs scope={scope} onChange={changeScope} />
      </Animated.View>

      {loading && items.length === 0 ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          {listHeader}
          <View style={styles.skeletonWrap}>
            <ExploreFeedSkeleton scope={scope} />
          </View>
        </ScrollView>
      ) : (
        <AnimatedFlatList
          data={items}
          keyExtractor={(it) => it.key}
          ListHeaderComponent={listHeader}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll as any}
          scrollEventThrottle={16}
          removeClippedSubviews
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={7}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={INK}
              colors={[INK]}
              progressBackgroundColor={YELLOW}
            />
          }
          onEndReached={() => void onEndReached()}
          onEndReachedThreshold={0.6}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator color={INK} />
        </View>
            ) : null
          }
          ListEmptyComponent={
            error ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyErr}>{error}</Text>
                <Pressable onPress={() => void load()} style={styles.retryBtn}>
                  <Text style={styles.retryTxt}>Thử lại</Text>
                </Pressable>
      </View>
            ) : scope === 'following' ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTxt}>Theo dõi mọi người để thấy bài đăng</Text>
                <Pressable onPress={() => changeScope('forYou')} style={styles.retryBtn}>
                  <Text style={styles.retryTxt}>Khám phá dành cho bạn</Text>
        </Pressable>
      </View>
            ) : (
              <Text style={styles.emptyTxt}>Chưa có nội dung để khám phá.</Text>
            )
          }
        />
      )}

      {!hideNav ? (
        <Pressable
          style={styles.fab}
          onPress={() => setCreateOpen(true)}
          accessibilityLabel="Tạo bài đăng"
        >
          <Plus size={26} color={INK} strokeWidth={2.5} />
    </Pressable>
      ) : null}

      {!hideNav ? (
        <LiquidGlassBottomNav
          active="explore"
          onHome={onBack}
          onRandom={onRandom}
          onHealth={onHealth}
          onProfile={onProfile}
        />
      ) : null}

      {toast ? (
        <Pressable
          style={styles.toast}
          onPress={() => {
            const t = undoTarget.current;
            if (t) {
              void moderationApi.unhide(
                t.kind === 'DISH' ? 'DISH' : t.kind === 'ARTICLE' ? 'ARTICLE' : 'COMMUNITY_POST',
                t.id,
              );
              showToast('Đã hoàn tác');
              undoTarget.current = null;
              void onRefresh();
            }
          }}
        >
          <Text style={styles.toastTxt}>{toast} · Hoàn tác</Text>
        </Pressable>
      ) : null}

      <ContentActionSheet
        open={actionOpen}
        onOpenChange={setActionOpen}
        target={actionTarget}
        entryPoint="FEED"
        onToast={showToast}
        onRemoved={(t) => {
          undoTarget.current = t;
          removeByTarget(t);
        }}
        onUndoHide={(t) => {
          undoTarget.current = t;
        }}
        onEdited={() => {
          if (actionTarget?.kind === 'COMMUNITY_POST') {
            setEditPostId(actionTarget.id);
            setCreateOpen(true);
          }
        }}
        onRequestShare={(t) => {
          openShareArticle(
            toShareArticle({
              id: t.id,
              title: t.title,
              coverImageUrl: t.imageUrl,
              authorName: t.authorName,
              shareUrl: t.shareUrl,
              kind: t.kind === 'COMMUNITY_POST' ? 'COMMUNITY_POST' : t.kind === 'DISH' ? 'DISH' : 'ARTICLE',
            }),
          );
        }}
      />

      <ArticleShareSheet
        open={shareSheetOpen}
        onOpenChange={setShareSheetOpen}
        article={shareArticlePayload}
      />

      <ScreenSlideTransition
        visible={createOpen}
        direction="bottom"
        onBack={() => {
          setCreateOpen(false);
          setEditPostId(null);
        }}
      >
        <CreatePostScreen
          editPostId={editPostId}
          onClose={() => {
            setCreateOpen(false);
            setEditPostId(null);
          }}
          onPublished={(post) => {
            const wasEdit = Boolean(editPostId);
            setCreateOpen(false);
            setEditPostId(null);
            setItems((prev) => [
              { kind: 'post', key: `post-${post.id}`, post },
              ...prev.filter((it) => !(it.kind === 'post' && it.post.id === post.id)),
            ]);
            if (!wasEdit) setScope('following');
            showToast(wasEdit ? 'Đã cập nhật bài' : 'Đã đăng bài');
          }}
        />
      </ScreenSlideTransition>

      <ScreenSlideTransition
        visible={searchOpen}
        direction="right"
        onBack={() => setSearchOpen(false)}
      >
        <ExploreSearchScreen
          onBack={() => setSearchOpen(false)}
          onOpenDish={(id) => {
            setSearchOpen(false);
            openDetail('food', id);
          }}
          onOpenArticle={(id) => {
            setSearchOpen(false);
            openDetail('article', id);
          }}
          onOpenPost={(id) => {
            setSearchOpen(false);
            openDetail('post', id);
          }}
          onOpenUser={(userId) => {
            setSearchOpen(false);
            setProfileUserId(userId);
          }}
        />
      </ScreenSlideTransition>

      <ScreenSlideTransition
        visible={Boolean(detail)}
        direction="right"
        onBack={() => setDetail(null)}
      >
        {detail ? (
          <ExploreDetailScreen
            type={detail.type}
            resourceId={detail.resourceId}
            onBack={() => setDetail(null)}
            onPostChange={patchFeedPost}
            onArticleChange={patchFeedArticle}
          />
        ) : null}
      </ScreenSlideTransition>

      <ScreenSlideTransition
        visible={Boolean(profileUserId)}
        direction="right"
        onBack={() => setProfileUserId(null)}
      >
        {profileUserId ? (
          <PublicProfileScreen
            userId={profileUserId}
            onBack={() => setProfileUserId(null)}
            onOpenPost={(postId) => {
              setProfileUserId(null);
              openDetail('post', postId);
            }}
          />
        ) : null}
      </ScreenSlideTransition>

      <ScreenSlideTransition
        visible={savedOpen}
        direction="right"
        onBack={() => setSavedOpen(false)}
      >
        <SavedCollectionsScreen
          onBack={() => setSavedOpen(false)}
          onOpenArticle={(id) => {
            setSavedOpen(false);
            openDetail('article', id);
          }}
          onOpenPost={(id) => {
            setSavedOpen(false);
            openDetail('post', id);
          }}
          onOpenDish={(id) => {
            setSavedOpen(false);
            openDetail('food', id);
          }}
          onUnsave={(type, id) => {
            if (type === 'article') {
              setSavedArticles((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
              setItems((prev) =>
                prev.map((it) =>
                  it.kind === 'article' && it.article.id === id
                    ? { ...it, article: { ...it.article, isSaved: false } }
                    : it,
                ),
              );
            } else if (type === 'post') {
              setSavedPosts((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
              setItems((prev) =>
                prev.map((it) =>
                  it.kind === 'post' && it.post.id === id
                    ? { ...it, post: { ...it.post, isSaved: false } }
                    : it,
                ),
              );
            } else if (type === 'dish') {
              setSavedDishes((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
            }
          }}
        />
      </ScreenSlideTransition>

      <ScreenSlideTransition
        visible={Boolean(topicFeed)}
        direction="right"
        onBack={() => setTopicFeed(null)}
      >
        {topicFeed ? (
          <TopicFeedScreen
            topic={topicFeed}
            onBack={() => setTopicFeed(null)}
            onOpenArticle={(id) => {
              setTopicFeed(null);
              openDetail('article', id);
            }}
          />
        ) : null}
      </ScreenSlideTransition>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FEED_BG },
  listContent: { paddingTop: 10, paddingBottom: 140 },
  skeletonWrap: { paddingHorizontal: H_PAD },
  topBar: {
    backgroundColor: WHITE,
    paddingHorizontal: H_PAD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
    shadowColor: '#6B4E12',
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 0,
    zIndex: 10,
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F7F1E3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: CORAL_DOT,
    borderWidth: 2,
    borderColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeTxt: { color: WHITE, fontSize: 10, fontWeight: '800', lineHeight: 12 },

  tabsWrap: { flexDirection: 'row', height: 44 },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabTxt: { fontSize: 15, fontWeight: '600', color: TERTIARY },
  tabTxtActive: { color: INK, fontWeight: '800' },
  tabIndicator: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: YELLOW,
  },

  searchPill: {
    marginHorizontal: 12,
    marginBottom: 6,
    height: 44,
    borderRadius: 22,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  searchPlaceholder: { flex: 1, fontSize: 15, color: TERTIARY },
  followingHintWrap: { paddingHorizontal: H_PAD, paddingVertical: 10 },
  followingHint: { fontSize: 13, color: MUTED },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 108,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#5D490F',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: H_PAD, gap: 12 },
  emptyErr: { color: '#E53E3E', textAlign: 'center' },
  emptyTxt: { color: MUTED, textAlign: 'center', marginTop: 40 },
  retryBtn: {
    backgroundColor: YELLOW,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  retryTxt: { fontWeight: '700', color: INK },
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 120,
    backgroundColor: INK,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toastTxt: { color: WHITE, fontWeight: '600', textAlign: 'center' },
});

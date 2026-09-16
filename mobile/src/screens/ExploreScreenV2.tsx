import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  Bookmark,
  Heart,
  MessageCircle,
  PenLine,
  Plus,
  Search,
  Share2,
  X,
} from 'lucide-react-native';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { AppImage } from '../components/ui/app-image';
import { cn } from '../lib/utils';
import { ExploreDetailScreen, type ExploreDetailType } from './ExploreDetailScreen';
import { ScreenSlideTransition } from '../components/ui/screen-transition';
import { LiquidGlassBottomNav } from '../components/organisms/LiquidGlassBottomNav';
import { AvatarImage } from '../components/organisms/AvatarImage';
import {
  articlesApi,
  communityApi,
  exploreApi,
  type ExploreArticle,
  type ExploreFeedResponse,
  type ExplorePost,
  type ExploreTopic,
} from '../services/api/explore';
import { dishesApi, type DishDetail } from '../services/api/dishes';
import { profileApi } from '../services/api/profile';

const pho = require('../assets/images/random/pho-result.jpg');
const bun = require('../assets/images/random/bun-rieu.jpg');
const rice = require('../assets/images/random/chao-ga.jpg');
const brand = require('../assets/images/logo/mogu-wordmark-header.png');

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_m, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _m;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
      const n = Number.parseInt(hex, 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _m;
    })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

type Props = {
  onBack: () => void;
  onHealth: () => void;
  onProfile: () => void;
  onRandom: () => void;
};
type Tab = 'Dành cho bạn' | 'Món ăn' | 'Bài viết' | 'Cộng đồng';

export function ExploreScreenV2({ onBack, onHealth, onProfile, onRandom }: Props) {
  const [detail, setDetail] = useState<{ type: ExploreDetailType; resourceId: string } | null>(null);
  const [tab, setTab] = useState<Tab>('Dành cho bạn');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Tab: Dành cho bạn ────────────────────────────────────────────────────
  const [feed, setFeed] = useState<ExploreFeedResponse | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState('');

  // ── Tab: Món ăn ──────────────────────────────────────────────────────────
  const [dishes, setDishes] = useState<DishDetail[]>([]);
  const [dishesLoading, setDishesLoading] = useState(false);
  const [dishesError, setDishesError] = useState('');

  // ── Tab: Bài viết ─────────────────────────────────────────────────────────
  const [articles, setArticles] = useState<ExploreArticle[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [articlesError, setArticlesError] = useState('');
  const [savedArticles, setSavedArticles] = useState<Set<string>>(new Set());

  // ── Tab: Cộng đồng ────────────────────────────────────────────────────────
  const [posts, setPosts] = useState<ExplorePost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState('');

  const [refreshing, setRefreshing] = useState(false);
  const [myAvatarUri, setMyAvatarUri] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Create Post ───────────────────────────────────────────────────────────
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);
  const [createPostError, setCreatePostError] = useState('');

  useEffect(() => {
    let active = true;
    profileApi.dashboard().then((data) => {
      if (active) setMyAvatarUri(data.profile.avatar.url);
    }).catch(() => { /* Use the shared fallback when unavailable. */ });
    return () => { active = false; };
  }, []);

  // ── Data fetchers ─────────────────────────────────────────────────────────
  const fetchFeed = useCallback(async () => {
    setFeedLoading(true);
    setFeedError('');
    try {
      const data = await exploreApi.getFeed();
      setFeed(data);
    } catch (e: any) {
      setFeedError(e.message ?? 'Không tải được dữ liệu');
    } finally {
      setFeedLoading(false);
    }
  }, []);

  const searchDishes = useCallback(async (q: string) => {
    setDishesLoading(true);
    setDishesError('');
    try {
      // Backend public /dishes chỉ trả PUBLISHED — không cần truyền status
      const result = await dishesApi.search({ q, limit: 20 });
      setDishes(result.data);
    } catch (e: any) {
      setDishesError(e.message ?? 'Không tải được danh sách món');
    } finally {
      setDishesLoading(false);
    }
  }, []);

  const fetchArticles = useCallback(async (q?: string) => {
    setArticlesLoading(true);
    setArticlesError('');
    try {
      const result = await articlesApi.list({ q, limit: 20 });
      setArticles(result.data);
    } catch (e: any) {
      setArticlesError(e.message ?? 'Không tải được bài viết');
    } finally {
      setArticlesLoading(false);
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    setPostsLoading(true);
    setPostsError('');
    try {
      const result = await communityApi.listPosts({ limit: 20 });
      setPosts(result.data);
    } catch (e: any) {
      setPostsError(e.message ?? 'Không tải được bài đăng');
    } finally {
      setPostsLoading(false);
    }
  }, []);

  const handleCreatePost = useCallback(async () => {
    const text = newPostContent.trim();
    if (!text) return;
    setSubmittingPost(true);
    setCreatePostError('');
    try {
      await communityApi.createPost({ content: text });
      setNewPostContent('');
      setCreatePostOpen(false);
      setTab('Cộng đồng');
      await fetchPosts();
    } catch (e: any) {
      setCreatePostError(e?.message || 'Không thể tạo bài viết');
    } finally {
      setSubmittingPost(false);
    }
  }, [newPostContent, fetchPosts]);

  // ── Tab switch triggers ───────────────────────────────────────────────────
  useEffect(() => {
    if (tab === 'Dành cho bạn' && !feed) fetchFeed();
    if (tab === 'Món ăn' && dishes.length === 0) searchDishes(searchQuery);
    if (tab === 'Bài viết' && articles.length === 0) fetchArticles();
    if (tab === 'Cộng đồng' && posts.length === 0) fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ── Debounced search ─────────────────────────────────────────────────────
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      if (tab === 'Món ăn') searchDishes(searchQuery);
      if (tab === 'Bài viết') fetchArticles(searchQuery);
    }, 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, tab, searchDishes, fetchArticles]);

  // ── Pull-to-refresh ───────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (tab === 'Dành cho bạn') await fetchFeed();
    if (tab === 'Món ăn') await searchDishes(searchQuery);
    if (tab === 'Bài viết') await fetchArticles(searchQuery);
    if (tab === 'Cộng đồng') await fetchPosts();
    setRefreshing(false);
  }, [tab, searchQuery, fetchFeed, searchDishes, fetchArticles, fetchPosts]);

  // ── Like toggle ───────────────────────────────────────────────────────────
  const handleLikePost = useCallback(async (postId: string) => {
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, isLiked: !p.isLiked, likeCount: p.likeCount + (p.isLiked ? -1 : 1) }
          : p,
      ),
    );
    try {
      await communityApi.toggleLike(postId);
    } catch {
      // Rollback on error
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, isLiked: !p.isLiked, likeCount: p.likeCount + (p.isLiked ? -1 : 1) }
            : p,
        ),
      );
    }
  }, []);

  const placeholder =
    tab === 'Món ăn'
      ? 'Tìm tên món, nguyên liệu…'
      : tab === 'Bài viết'
        ? 'Tìm bài viết, chủ đề…'
        : tab === 'Cộng đồng'
          ? 'Tìm người dùng, bài đăng…'
          : 'Tìm món ăn, bài viết, địa điểm…';

  return (
    <SafeAreaView className="flex-1 bg-mogu-cream" edges={['top', 'left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View className="h-[62px] flex-row justify-between items-center">
          <Image
            source={brand}
            style={{ width: 112, height: 44 }}
            resizeMode="contain"
          />
          <View className="flex-row items-center gap-[18px] relative">
            <Bell size={25} />
            <View className="absolute right-[52px] top-px w-2 h-2 rounded-full bg-[#FF796F]" />
            <Pressable accessibilityRole="button" accessibilityLabel="Mở hồ sơ cá nhân"
              onPress={onProfile} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
              <AvatarImage uri={myAvatarUri} size={44} />
            </Pressable>
          </View>
        </View>

        <Text className="text-[30px] font-bold text-[#161616] mt-3">Khám phá</Text>

        {/* Search bar */}
        <View className="h-[52px] rounded-[18px] bg-white border border-[#E8E0D2] mt-[18px] px-4 flex-row items-center gap-2.5">
          <Search size={22} color="#666" />
          <Input
            className="h-auto flex-1 border-0 bg-transparent p-0 text-[15px] shadow-none"
            placeholder={placeholder}
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              if (text.trim() && tab === 'Dành cho bạn') setTab('Món ăn');
            }}
            returnKeyType="search"
          />
        </View>

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 16, alignItems: 'center' }}
        >
          {(['Dành cho bạn', 'Món ăn', 'Bài viết', 'Cộng đồng'] as Tab[]).map((x) => (
            <Pressable
              key={x}
              onPress={() => setTab(x)}
              style={{ flexGrow: 0, flexShrink: 0 }}
              className={cn(
                'h-10 px-[18px] rounded-full items-center justify-center',
                tab === x ? 'bg-mogu-yellow' : 'bg-white',
              )}
            >
              <Text
                className={cn(
                  'text-sm',
                  tab === x ? 'font-semibold text-[#161616]' : 'text-[#303030]',
                )}
              >
                {x}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Tab: Dành cho bạn ─────────────────────────────────────────── */}
        {tab === 'Dành cho bạn' && (
          <>
            {feedLoading && !feed ? (
              <LoadingState />
            ) : feedError ? (
              <ErrorState message={feedError} onRetry={fetchFeed} />
            ) : feed ? (
              <>
                <Heading text="Chủ đề hôm nay" onPress={() => setTab('Bài viết')} />
                <TopicsRow topics={feed.topics} onPressTopic={() => setTab('Bài viết')} />

                {feed.featuredArticle && (
                  <>
                    <Heading text="Bài viết nổi bật" onPress={() => setTab('Bài viết')} />
                    <ArticleCard
                      onPress={() =>
                        setDetail({ type: 'article', resourceId: feed.featuredArticle!.id })
                      }
                      coverImageUrl={feed.featuredArticle.coverImageUrl}
                      title={feed.featuredArticle.title}
                      topic={feed.featuredArticle.topic?.title}
                      readMinutes={feed.featuredArticle.readMinutes}
                      featured
                      saved={savedArticles.has(feed.featuredArticle.id)}
                      onSave={() => {
                        setSavedArticles((prev) => {
                          const next = new Set(prev);
                          if (next.has(feed.featuredArticle!.id)) next.delete(feed.featuredArticle!.id);
                          else next.add(feed.featuredArticle!.id);
                          return next;
                        });
                      }}
                    />
                  </>
                )}

                {feed.recentPosts.length > 0 && (
                  <>
                    <Heading text="Cộng đồng đang nói gì?" onPress={() => setTab('Cộng đồng')} />
                    {feed.recentPosts.slice(0, 2).map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onPress={() => setDetail({ type: 'post', resourceId: post.id })}
                        onLike={() => handleLikePost(post.id)}
                      />
                    ))}
                  </>
                )}
              </>
            ) : null}
          </>
        )}

        {/* ── Tab: Món ăn ───────────────────────────────────────────────── */}
        {tab === 'Món ăn' && (
          <>
            <Filters labels={['Tất cả', 'Bữa sáng', 'Bữa trưa', 'Lành mạnh', 'Dưới 50K']} />
            <Heading text={searchQuery ? `Kết quả cho "${searchQuery}"` : 'Khám phá món ăn'} />
            {dishesLoading && dishes.length === 0 ? (
              <LoadingState />
            ) : dishesError ? (
              <ErrorState message={dishesError} onRetry={() => searchDishes(searchQuery)} />
            ) : dishes.length > 0 ? (
              dishes.map((dish) => {
                const nutrition = (dish.nutritionProfiles ?? [])[0];
                const media = dish.media ?? [];
                const primaryMedia = media.find((m) => m.isPrimary) ?? media[0];
                const imageUri = primaryMedia
                  ? `${(
                      (
                        globalThis as typeof globalThis & {
                          process?: { env?: Record<string, string | undefined> };
                        }
                      ).process?.env?.EXPO_PUBLIC_SUPABASE_URL ?? ''
                    ).replace(/\/$/, '')}/storage/v1/object/public/${primaryMedia.bucket || 'dish-images'}/${primaryMedia.storageKey}`
                  : null;
                const metaParts: string[] = [];
                if (nutrition?.calories) metaParts.push(`${nutrition.calories} kcal`);
                if (dish.prepMinutes) metaParts.push(`${dish.prepMinutes} phút`);
                if ((dish.priceMin ?? null) !== null || (dish.priceMax ?? null) !== null) {
                  const pMin = dish.priceMin ?? dish.priceMax ?? 0;
                  const pMax = dish.priceMax ?? dish.priceMin ?? 0;
                  metaParts.push(`${(pMin / 1000).toFixed(0)}K–${(pMax / 1000).toFixed(0)}K`);
                }
                return (
                  <FoodCard
                    key={dish.id}
                    onPress={() => setDetail({ type: 'food', resourceId: dish.id })}
                    imageUri={imageUri}
                    fallbackImage={pho}
                    name={dish.name}
                    meta={metaParts.join('  ·  ')}
                    badge={dish.region?.name ?? dish.categories?.[0]?.name ?? ''}
                  />
                );
              })
            ) : !dishesLoading ? (
              <View className="py-10 items-center px-6">
                <Text className="text-[#161616] font-semibold text-base text-center">
                  Chưa có món phù hợp
                </Text>
                <Text className="text-[#626262] text-sm text-center mt-2">
                  Thử tìm kiếm khác hoặc quay lại sau.
                </Text>
              </View>
            ) : null}
          </>
        )}

        {/* ── Tab: Bài viết ─────────────────────────────────────────────── */}
        {tab === 'Bài viết' && (
          <>
            <Filters labels={['Tất cả', 'Dinh dưỡng', 'Cách nấu', 'Sức khỏe', 'Mẹo hay']} />
            {articlesLoading && articles.length === 0 ? (
              <LoadingState />
            ) : articlesError ? (
              <ErrorState message={articlesError} onRetry={() => fetchArticles(searchQuery)} />
            ) : articles.length > 0 ? (
              <>
                <Heading text="Bài viết mới cho bạn" />
                {articles.map((article) => (
                  <ArticleCard
                    key={article.id}
                    onPress={() => setDetail({ type: 'article', resourceId: article.id })}
                    coverImageUrl={article.coverImageUrl}
                    title={article.title}
                    topic={article.topic?.title}
                    readMinutes={article.readMinutes}
                    saved={savedArticles.has(article.id)}
                    onSave={() => {
                      setSavedArticles((prev) => {
                        const next = new Set(prev);
                        if (next.has(article.id)) next.delete(article.id);
                        else next.add(article.id);
                        return next;
                      });
                    }}
                  />
                ))}
              </>
            ) : (
              <View className="py-10 items-center px-6">
                <Text className="text-[#161616] font-semibold text-base text-center">
                  Chưa có bài viết
                </Text>
                <Text className="text-[#626262] text-sm text-center mt-2">
                  Nội dung sẽ xuất hiện khi có bài đã xuất bản.
                </Text>
              </View>
            )}
          </>
        )}

        {/* ── Tab: Cộng đồng ────────────────────────────────────────────── */}
        {tab === 'Cộng đồng' && (
          <>
            <Text className="text-[20px] font-bold text-[#161616] mt-3">Mọi người đang ăn gì?</Text>
            {postsLoading && posts.length === 0 ? (
              <LoadingState />
            ) : postsError ? (
              <ErrorState message={postsError} onRetry={fetchPosts} />
            ) : posts.length > 0 ? (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onPress={() => setDetail({ type: 'post', resourceId: post.id })}
                  onLike={() => handleLikePost(post.id)}
                />
              ))
            ) : (
              <View className="py-10 items-center px-6">
                <Text className="text-[#161616] font-semibold text-base text-center">
                  Chưa có bài cộng đồng
                </Text>
                <Text className="text-[#626262] text-sm text-center mt-2">
                  Hãy là người đầu tiên chia sẻ món hôm nay.
                </Text>
              </View>
            )}
          </>
        )}

        <View className="h-[100px]" />
      </ScrollView>

      {/* FAB */}
      <Pressable
        className="absolute right-5 bottom-[92px] w-14 h-14 rounded-full bg-mogu-yellow items-center justify-center"
        style={{ elevation: 5 }}
        onPress={() => setCreatePostOpen(true)}
      >
        <Plus size={24} color="#161616" />
        <PenLine size={14} color="#161616" className="absolute right-[13px] bottom-[13px]" />
      </Pressable>

      <Modal
        visible={createPostOpen}
        animationType="slide"
        transparent
        onRequestClose={() => !submittingPost && setCreatePostOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={() => !submittingPost && setCreatePostOpen(false)}
          />
          <View className="bg-white rounded-t-[28px] p-5 pb-8 max-h-[85%]">
            <View className="flex-row items-center justify-between pb-3 border-b border-[#E8E0D2]">
              <Text className="text-lg font-bold text-[#161616]">Tạo bài viết mới</Text>
              <Pressable
                onPress={() => !submittingPost && setCreatePostOpen(false)}
                className="w-8 h-8 rounded-full bg-[#F5F2EC] items-center justify-center"
              >
                <X size={18} color="#626262" />
              </Pressable>
            </View>

            <View className="mt-4">
              <Textarea
                value={newPostContent}
                onChangeText={setNewPostContent}
                placeholder="Chia sẻ món ăn, trải nghiệm hôm nay của bạn..."
                className="min-h-[140px] text-base p-3 border border-[#E8E0D2] rounded-2xl bg-[#FFFDF7]"
                editable={!submittingPost}
                autoFocus
              />
            </View>

            {createPostError ? (
              <Text className="text-[#FF4D3D] text-xs mt-2">{createPostError}</Text>
            ) : null}

            <View className="mt-4 flex-row justify-end gap-3">
              <Pressable
                onPress={() => setCreatePostOpen(false)}
                disabled={submittingPost}
                className="px-5 py-3 rounded-xl border border-[#D4D0C8] items-center justify-center"
              >
                <Text className="font-semibold text-[#626262]">Hủy</Text>
              </Pressable>

              <Pressable
                onPress={handleCreatePost}
                disabled={submittingPost || !newPostContent.trim()}
                className={cn(
                  'px-6 py-3 rounded-xl bg-mogu-yellow items-center justify-center flex-row gap-2',
                  (!newPostContent.trim() || submittingPost) && 'opacity-50'
                )}
              >
                {submittingPost && <ActivityIndicator size="small" color="#161616" />}
                <Text className="font-bold text-[#161616]">Đăng bài</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <LiquidGlassBottomNav
        active="explore"
        onHome={onBack}
        onRandom={onRandom}
        onHealth={onHealth}
        onProfile={onProfile}
      />

      {/* ── Detail Screen with animated slide transition ── */}
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
          />
        ) : null}
      </ScreenSlideTransition>
    </SafeAreaView>
  );
}

import { ListSkeleton } from '../components/skeletons/ScreenSkeletons';

// ─── Helper components ────────────────────────────────────────────────────────

function LoadingState() {
  return <ListSkeleton rows={4} />;
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ paddingVertical: 24, alignItems: 'center', gap: 12 }}>
      <Text style={{ color: '#E53E3E', fontSize: 14, textAlign: 'center' }}>{message}</Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: '#F5B900',
            borderRadius: 20,
          }}
        >
          <Text style={{ fontWeight: '600', fontSize: 14 }}>Thử lại</Text>
        </Pressable>
      )}
    </View>
  );
}

function Filters({ labels }: { labels: string[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingBottom: 14, alignItems: 'center' }}
    >
      {labels.map((x, i) => (
        <Pressable
          key={x}
          onPress={() => setActiveIdx(i)}
          style={{ flexGrow: 0, flexShrink: 0 }}
          className={cn(
            'h-10 px-4 rounded-full justify-center',
            i === activeIdx ? 'bg-mogu-yellow' : 'bg-white',
          )}
        >
          <Text
            className={cn(
              'text-sm',
              i === activeIdx ? 'font-semibold text-[#161616]' : 'text-[#303030]',
            )}
          >
            {x}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function TopicsRow({
  topics,
  onPressTopic,
}: {
  topics: ExploreTopic[];
  onPressTopic?: (topic: ExploreTopic) => void;
}) {
  const displayTopics =
    topics.length > 0
      ? topics
      : [
        { id: '1', slug: 'mon-ngon-mua-mua', title: 'Món ngon\nmùa mưa', coverImageUrl: null, articleCount: 0 },
        { id: '2', slug: 'an-lanh-manh', title: 'Ăn lành mạnh', coverImageUrl: null, articleCount: 0 },
        { id: '3', slug: 'duoi-50k', title: 'Dưới 50K', coverImageUrl: null, articleCount: 0 },
      ];

  const fallbackImages = [pho, rice, bun];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12, paddingBottom: 18 }}
    >
      {displayTopics.map((topic, i) => (
        <Pressable
          key={topic.id}
          onPress={() => onPressTopic?.(topic)}
          style={{
            width: 250,
            height: 210,
            borderRadius: 20,
            overflow: 'hidden',
          }}
        >
          <Image
            source={topic.coverImageUrl ? { uri: topic.coverImageUrl } : fallbackImages[i % 3]}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
          <View
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.24)',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          <Text
            style={{
              position: 'absolute',
              left: 16,
              bottom: 16,
              color: '#fff',
              fontSize: 18,
              fontWeight: 'bold',
              lineHeight: 23,
            }}
          >
            {topic.title}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function Heading({ text, onPress }: { text: string; onPress?: () => void }) {
  return (
    <View className="flex-row justify-between items-center mt-3.5 mb-3.5">
      <Text className="text-[20px] font-bold text-[#161616]">{text}</Text>
      <Pressable onPress={onPress} hitSlop={8} disabled={!onPress}>
        <Text className="text-[14px] text-[#CC9700]">Xem tất cả ›</Text>
      </Pressable>
    </View>
  );
}

function FoodCard(p: {
  onPress?: () => void;
  imageUri?: string | null;
  fallbackImage: any;
  name: string;
  meta: string;
  badge: string;
}) {
  return (
    <Pressable
      onPress={p.onPress}
      className="h-[205px] rounded-[20px] overflow-hidden bg-white flex-row mb-4"
    >
      <AppImage
        uri={p.imageUri}
        fallbackSource={p.fallbackImage}
        style={{ width: '44%', height: '100%' }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={200}
        showLoader
      />
      <View className="flex-1 p-3.5">
        <Text className="text-[21px] font-bold text-[#161616] mt-[10px]">{p.name}</Text>
        <Text className="text-[13px] text-[#666] mt-[7px]">{p.meta}</Text>
        {p.badge ? (
          <Badge variant="secondary" className="self-start bg-[#FFF1B3] rounded-full px-2.5 py-1 mt-3">
            <Text className="text-xs text-[#161616]">{p.badge}</Text>
          </Badge>
        ) : null}
        <Text className="text-[14px] text-[#444] mt-2.5" style={{ lineHeight: 20 }}>
          Đậm đà, giàu dinh dưỡng và phù hợp với bạn hôm nay.
        </Text>
      </View>
    </Pressable>
  );
}

function ArticleCard(p: {
  onPress?: () => void;
  coverImageUrl: string | null;
  title: string;
  topic?: string;
  readMinutes?: number;
  featured?: boolean;
  saved?: boolean;
  onSave?: () => void;
}) {
  const fallbackImages = [rice, pho, bun];
  const fallback = fallbackImages[Math.floor(Math.random() * fallbackImages.length)];

  return (
    <Pressable
      onPress={p.onPress}
      className="h-[156px] rounded-[20px] overflow-hidden bg-white flex-row mb-4"
    >
      <Image
        source={p.coverImageUrl ? { uri: p.coverImageUrl } : fallback}
        style={{ width: '42%', height: '100%' }}
        resizeMode="cover"
      />
      <View className="flex-1 p-3.5 justify-center">
        {p.topic && (
          <Text className="text-xs text-[#A47700] mb-1.5">{p.topic}</Text>
        )}
        <Text className="text-[18px] font-bold text-[#161616]" style={{ lineHeight: 24 }}>
          {p.title}
        </Text>
        {p.readMinutes && (
          <Text className="text-[13px] text-[#666] mt-2">
            {p.readMinutes} phút đọc
          </Text>
        )}
      </View>
      {p.onSave && (
        <Pressable onPress={p.onSave} className="absolute right-3 bottom-3">
          <Bookmark
            size={22}
            fill={p.saved ? '#FFD54F' : 'transparent'}
            color={p.saved ? '#FFD54F' : '#888'}
          />
        </Pressable>
      )}
    </Pressable>
  );
}

function PostCard(p: {
  post: ExplorePost;
  onPress?: () => void;
  onLike: () => void;
}) {
  const { post } = p;
  const timeAgo = formatTimeAgo(post.createdAt);

  return (
    <Pressable onPress={p.onPress}>
      <Card className="bg-white rounded-[20px] p-4 mb-4 border-0">
        <View className="flex-row items-center gap-2.5">
          <AvatarImage uri={post.author.avatarUrl} size={42} />
          <View>
            <Text className="text-[16px] font-semibold text-[#161616]">
              {post.author.displayName ?? 'Người dùng Mogu'}
            </Text>
            <Text className="text-[13px] text-[#666]">{timeAgo}</Text>
          </View>
        </View>

        {post.content ? (
          <Text className="text-[16px] text-[#303030] my-3.5">{decodeHtmlEntities(post.content)}</Text>
        ) : null}

        {post.imageUrls.length > 0 && (
          <Image
            source={{ uri: post.imageUrls[0] }}
            className="w-full rounded-2xl"
            style={{ width: '100%', height: 220, borderRadius: 16 }}
            resizeMode="cover"
          />
        )}

        <View className="flex-row gap-5 mt-3.5">
          <Pressable onPress={p.onLike} className="flex-row items-center gap-1.5">
            <Heart
              size={22}
              color={post.isLiked ? '#FF796F' : '#666'}
              fill={post.isLiked ? '#FF796F' : 'transparent'}
            />
            {post.likeCount > 0 && (
              <Text className="text-[13px] text-[#666]">{post.likeCount}</Text>
            )}
          </Pressable>
          <View className="flex-row items-center gap-1.5">
            <MessageCircle size={22} color="#666" />
            {post.commentCount > 0 && (
              <Text className="text-[13px] text-[#666]">{post.commentCount}</Text>
            )}
          </View>
          <Share2 size={22} color="#666" />
        </View>
      </Card>
    </Pressable>
  );
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ`;
  const days = Math.floor(hours / 24);
  return `${days} ngày`;
}

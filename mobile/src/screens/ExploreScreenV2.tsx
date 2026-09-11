import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
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
} from 'lucide-react-native';
import { cn } from '../lib/utils';
import { ExploreDetailScreen, type ExploreDetailType } from './ExploreDetailScreen';
import { LiquidGlassBottomNav } from '../components/organisms/LiquidGlassBottomNav';
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

const pho = require('../assets/images/random/pho-result.jpg');
const bun = require('../assets/images/random/bun-rieu.jpg');
const rice = require('../assets/images/random/chao-ga.jpg');
const avatar = require('../assets/images/home/avatar.jpg');
const brand = require('../assets/images/logo/mogu-wordmark-header.png');

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
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ── Tab switch triggers ───────────────────────────────────────────────────
  useEffect(() => {
    if (tab === 'Dành cho bạn' && !feed) fetchFeed();
    if (tab === 'Món ăn') searchDishes(searchQuery);
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

  if (detail) {
    return (
      <ExploreDetailScreen
        type={detail.type}
        resourceId={detail.resourceId}
        onBack={() => setDetail(null)}
      />
    );
  }

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
            <Image
              source={avatar}
              style={{ width: 44, height: 44, borderRadius: 22 }}
            />
          </View>
        </View>

        <Text className="text-[30px] font-bold text-[#161616] mt-3">Khám phá</Text>

        {/* Search bar */}
        <View className="h-[52px] rounded-[18px] bg-white border border-[#E8E0D2] mt-[18px] px-4 flex-row items-center gap-2.5">
          <Search size={22} color="#666" />
          <TextInput
            className="flex-1 text-[15px]"
            placeholder={placeholder}
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
        </View>

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 16 }}
        >
          {(['Dành cho bạn', 'Món ăn', 'Bài viết', 'Cộng đồng'] as Tab[]).map((x) => (
            <Pressable
              key={x}
              onPress={() => setTab(x)}
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
                <Heading text="Chủ đề hôm nay" />
                <TopicsRow topics={feed.topics} />

                {feed.featuredArticle && (
                  <>
                    <Heading text="Bài viết nổi bật" />
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
                    <Heading text="Cộng đồng đang nói gì?" />
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
            {dishesLoading ? (
              <LoadingState />
            ) : dishesError ? (
              <ErrorState message={dishesError} onRetry={() => searchDishes(searchQuery)} />
            ) : dishes.length > 0 ? (
              dishes.map((dish) => {
                const nutrition = (dish.nutritionProfiles ?? [])[0];
                const media = dish.media ?? [];
                const primaryMedia = media.find((m) => m.isPrimary) ?? media[0];
                const imageUri = primaryMedia
                  ? `https://lkqvyvllmrbxgaoqrkhd.supabase.co/storage/v1/object/public/dish-images/${primaryMedia.storageKey}`
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
      >
        <Plus size={24} />
        <PenLine size={14} className="absolute right-[13px] bottom-[13px]" />
      </Pressable>

      <LiquidGlassBottomNav
        active="explore"
        onHome={onBack}
        onRandom={onRandom}
        onHealth={onHealth}
        onProfile={onProfile}
      />
    </SafeAreaView>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#F5B900" />
    </View>
  );
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
      contentContainerStyle={{ gap: 8, paddingBottom: 14 }}
    >
      {labels.map((x, i) => (
        <Pressable
          key={x}
          onPress={() => setActiveIdx(i)}
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

function TopicsRow({ topics }: { topics: ExploreTopic[] }) {
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
        <View
          key={topic.id}
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
        </View>
      ))}
    </ScrollView>
  );
}

function Heading({ text }: { text: string }) {
  return (
    <View className="flex-row justify-between items-center mt-3.5 mb-3.5">
      <Text className="text-[20px] font-bold text-[#161616]">{text}</Text>
      <Text className="text-[14px] text-[#CC9700]">Xem tất cả ›</Text>
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
      <Image
        source={p.imageUri ? { uri: p.imageUri } : p.fallbackImage}
        style={{ width: '44%', height: '100%' }}
        resizeMode="cover"
      />
      <View className="flex-1 p-3.5">
        <Text className="text-[21px] font-bold text-[#161616] mt-[10px]">{p.name}</Text>
        <Text className="text-[13px] text-[#666] mt-[7px]">{p.meta}</Text>
        <Text className="self-start bg-[#FFF1B3] rounded-full px-2.5 py-1.5 mt-3 text-xs text-[#161616]">
          {p.badge}
        </Text>
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
    <Pressable onPress={p.onPress} className="bg-white rounded-[20px] p-4 mb-4">
      <View className="flex-row items-center gap-2.5">
        <Image
          source={post.author.avatarUrl ? { uri: post.author.avatarUrl } : avatar}
          style={{ width: 42, height: 42, borderRadius: 21 }}
        />
        <View>
          <Text className="text-[16px] font-semibold text-[#161616]">
            {post.author.displayName ?? 'Người dùng Mogu'}
          </Text>
          <Text className="text-[13px] text-[#666]">{timeAgo}</Text>
        </View>
      </View>

      {post.content ? (
        <Text className="text-[16px] text-[#303030] my-3.5">{post.content}</Text>
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

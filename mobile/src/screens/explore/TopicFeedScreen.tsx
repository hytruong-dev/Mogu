import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Bookmark,
  Heart,
  MessageSquare,
  MoreHorizontal,
  Share2,
  User,
} from 'lucide-react-native';
import { apiRequest } from '../../services/api/client';
import { articlesApi, type ExploreArticle, type ExploreTopic } from '../../services/api/explore';
import { AppImage } from '../../components/ui/app-image';
import { ContentActionSheet } from './ContentActionSheet';
import {
  ArticleShareSheet,
  toShareArticle,
  type ExploreShareArticle,
} from './ArticleShareSheet';
import type { ContentActionTarget } from './buildContentActions';
import { formatRelativeTime } from './utils';

type Props = {
  topic: ExploreTopic;
  onBack: () => void;
  onOpenArticle: (id: string) => void;
};

type FilterType = 'latest' | '5min' | 'popular';

const CREAM_BG = '#FAF8F5';
const INK_COLOR = '#161616';
const YELLOW_BRAND = '#FCD34D';

export function TopicFeedScreen({ topic, onBack, onOpenArticle }: Props) {
  const [articles, setArticles] = useState<ExploreArticle[]>([]);
  const [topicDetail, setTopicDetail] = useState<ExploreTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterType>('latest');

  // Context menu state
  const [actionTarget, setActionTarget] = useState<ContentActionTarget | null>(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [shareArticlePayload, setShareArticlePayload] = useState<ExploreShareArticle | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<{ data: ExploreArticle[]; topic?: ExploreTopic }>(
        `/topics/${encodeURIComponent(topic.slug)}/feed?limit=40`,
      );
      setArticles(res.data ?? []);
      if (res.topic) {
        setTopicDetail(res.topic);
      }
    } catch (e: any) {
      setError(e?.message || 'Không tải được chủ đề');
    } finally {
      setLoading(false);
    }
  }, [topic.slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggleLike = async (articleId: string, currentLiked?: boolean, currentCount?: number) => {
    const nextLiked = !currentLiked;
    const nextCount = currentLiked ? Math.max(0, (currentCount ?? 1) - 1) : (currentCount ?? 0) + 1;

    setArticles((prev) =>
      prev.map((a) => (a.id === articleId ? { ...a, isLiked: nextLiked, likeCount: nextCount } : a)),
    );

    try {
      const res = await articlesApi.toggleLike(articleId);
      setArticles((prev) =>
        prev.map((a) =>
          a.id === articleId
            ? { ...a, isLiked: res.liked, likeCount: res.likeCount ?? nextCount }
            : a,
        ),
      );
    } catch {
      setArticles((prev) =>
        prev.map((a) => (a.id === articleId ? { ...a, isLiked: currentLiked, likeCount: currentCount } : a)),
      );
    }
  };

  const handleToggleSave = async (articleId: string, currentSaved?: boolean) => {
    const nextSaved = !currentSaved;
    setArticles((prev) =>
      prev.map((a) => (a.id === articleId ? { ...a, isSaved: nextSaved } : a)),
    );

    try {
      if (nextSaved) {
        await articlesApi.save(articleId);
      } else {
        await articlesApi.unsave(articleId);
      }
    } catch {
      setArticles((prev) =>
        prev.map((a) => (a.id === articleId ? { ...a, isSaved: currentSaved } : a)),
      );
    }
  };

  const openShareArticle = (article: ExploreArticle | ExploreShareArticle) => {
    setShareArticlePayload(toShareArticle(article));
    setShareSheetOpen(true);
  };

  const openActionSheet = (article: ExploreArticle) => {
    setActionTarget({
      kind: 'ARTICLE',
      id: article.id,
      title: article.title,
      imageUrl: article.coverImageUrl,
      subtitle: 'Bài viết • Mogu',
      isSaved: Boolean(article.isSaved),
    });
    setActionOpen(true);
  };

  const displayTitle = topicDetail?.title || topic.title || '';
  const displaySubtitle = topicDetail?.description || topic.description || '';

  const filteredArticles = useMemo(() => {
    let list = [...articles];
    if (filter === '5min') {
      list = list.filter((a) => (a.readMinutes ?? 0) <= 5);
    } else if (filter === 'popular') {
      list.sort(
        (a, b) =>
          (b.likeCount ?? 0) + (b.viewCount ?? 0) - ((a.likeCount ?? 0) + (a.viewCount ?? 0)),
      );
    } else {
      list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    return list;
  }, [articles, filter]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn} accessibilityLabel="Quay lại">
          <ArrowLeft size={20} color={INK_COLOR} strokeWidth={2.2} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {displayTitle || 'Chủ đề'}
          </Text>
          {displaySubtitle ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {displaySubtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* Filter Tabs Row */}
      <View style={styles.filterRow}>
        <Pressable
          onPress={() => setFilter('latest')}
          style={[styles.filterChip, filter === 'latest' ? styles.filterChipActive : styles.filterChipInactive]}
        >
          <Text
            style={[
              styles.filterText,
              filter === 'latest' ? styles.filterTextActive : styles.filterTextInactive,
            ]}
          >
            Mới nhất
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter('5min')}
          style={[styles.filterChip, filter === '5min' ? styles.filterChipActive : styles.filterChipInactive]}
        >
          <Text
            style={[
              styles.filterText,
              filter === '5min' ? styles.filterTextActive : styles.filterTextInactive,
            ]}
          >
            5 phút
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter('popular')}
          style={[styles.filterChip, filter === 'popular' ? styles.filterChipActive : styles.filterChipInactive]}
        >
          <Text
            style={[
              styles.filterText,
              filter === 'popular' ? styles.filterTextActive : styles.filterTextInactive,
            ]}
          >
            Phổ biến
          </Text>
        </Pressable>
      </View>

      {/* Content Feed */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={YELLOW_BRAND} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorTxt}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryTxt}>Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredArticles}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.empty}>Chưa có bài viết trong chủ đề này</Text>
            </View>
          }
          renderItem={({ item }) => {
            const authorName = item.author?.displayName || 'Mogu review';
            const isLiked = Boolean(item.isLiked);
            const isSaved = Boolean(item.isSaved);
            const likes = item.likeCount ?? 0;
            const comments = item.commentCount ?? 0;

            return (
              <View style={styles.card}>
                {/* Author row */}
                <View style={styles.authorRow}>
                  <View style={styles.authorInfo}>
                    <View style={styles.avatarWrap}>
                      {item.author?.avatarUrl ? (
                        <AppImage uri={item.author.avatarUrl} style={styles.avatarImg} contentFit="cover" />
                      ) : (
                        <User size={18} color="#854D0E" strokeWidth={2} />
                      )}
                    </View>
                    <View>
                      <Text style={styles.authorName}>{authorName}</Text>
                      {formatRelativeTime(item.createdAt) ? (
                        <Text style={styles.authorTime}>
                          {formatRelativeTime(item.createdAt)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Pressable
                    onPress={() => openActionSheet(item)}
                    style={styles.moreBtn}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityLabel="Thêm"
                  >
                    <MoreHorizontal size={20} color={INK_COLOR} />
                  </Pressable>
                </View>

                {/* Cover Image with Floating Badge */}
                <Pressable
                  onPress={() => onOpenArticle(item.id)}
                  style={styles.imagePressable}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                >
                  <View style={styles.coverWrap}>
                    <AppImage uri={item.coverImageUrl} style={styles.cover} contentFit="cover" />
                    <View style={styles.articleBadge}>
                      <Text style={styles.articleBadgeText}>Bài viết</Text>
                    </View>
                  </View>

                  {/* Title & read time */}
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.readMinutes ? (
                    <Text style={styles.readTime}>
                      {item.readMinutes} phút đọc
                    </Text>
                  ) : null}
                </Pressable>

                {/* Action Row */}
                <View style={styles.actionRow}>
                  <View style={styles.actionLeft}>
                    {/* Heart Like */}
                    <Pressable
                      style={styles.actionItem}
                      onPress={() => void handleToggleLike(item.id, isLiked, likes)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Thích"
                    >
                      <Heart
                        size={20}
                        color={isLiked ? '#FF5F57' : INK_COLOR}
                        fill={isLiked ? '#FF5F57' : 'transparent'}
                        strokeWidth={1.9}
                      />
                      <Text style={styles.actionCount}>{likes}</Text>
                    </Pressable>

                    {/* Comment */}
                    <Pressable
                      style={styles.actionItem}
                      onPress={() => onOpenArticle(item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Bình luận"
                    >
                      <MessageSquare size={20} color={INK_COLOR} strokeWidth={1.9} />
                      <Text style={styles.actionCount}>{comments}</Text>
                    </Pressable>

                    {/* Share */}
                    <Pressable
                      style={styles.actionItem}
                      onPress={() => openShareArticle(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Chia sẻ"
                    >
                      <Share2 size={20} color={INK_COLOR} strokeWidth={1.9} />
                    </Pressable>
                  </View>

                  {/* Bookmark Save */}
                  <Pressable
                    style={styles.actionItem}
                    onPress={() => void handleToggleSave(item.id, isSaved)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel={isSaved ? 'Bỏ lưu' : 'Lưu'}
                  >
                    <Bookmark
                      size={20}
                      color={INK_COLOR}
                      fill={isSaved ? INK_COLOR : 'transparent'}
                      strokeWidth={1.9}
                    />
                    <Text style={styles.actionLabel}>Lưu</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Context Action Sheet */}
      <ContentActionSheet
        open={actionOpen}
        onOpenChange={setActionOpen}
        target={actionTarget}
        entryPoint="FEED"
        onToast={() => undefined}
        onRequestShare={(t) => {
          openShareArticle(
            toShareArticle({
              id: t.id,
              title: t.title,
              coverImageUrl: t.imageUrl,
              authorName: t.authorName,
              shareUrl: t.shareUrl,
            }),
          );
        }}
      />

      <ArticleShareSheet
        open={shareSheetOpen}
        onOpenChange={setShareSheetOpen}
        article={shareArticlePayload}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM_BG },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: INK_COLOR,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#737373',
    textAlign: 'center',
    marginTop: 2,
  },
  headerRightPlaceholder: {
    width: 40,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 10,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
  },
  filterChipActive: {
    backgroundColor: YELLOW_BRAND,
  },
  filterChipInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  filterText: {
    fontSize: 14,
  },
  filterTextActive: {
    fontWeight: '700',
    color: INK_COLOR,
  },
  filterTextInactive: {
    fontWeight: '500',
    color: '#262626',
  },
  listContent: {
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  empty: {
    textAlign: 'center',
    color: '#8A8A8A',
    fontSize: 14,
  },
  errorTxt: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 14,
    lineHeight: 20,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: YELLOW_BRAND,
    borderRadius: 999,
  },
  retryTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: INK_COLOR,
  },
  card: {
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 36,
    height: 36,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
    color: INK_COLOR,
  },
  authorTime: {
    fontSize: 12,
    color: '#8A8A8A',
    marginTop: 1,
  },
  moreBtn: {
    padding: 6,
  },
  imagePressable: {
    width: '100%',
  },
  coverWrap: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F3EFE6',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  articleBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: YELLOW_BRAND,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  articleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: INK_COLOR,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: INK_COLOR,
    lineHeight: 25,
    marginTop: 12,
  },
  readTime: {
    fontSize: 12,
    color: '#737373',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 4,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionCount: {
    fontSize: 13,
    fontWeight: '600',
    color: INK_COLOR,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: INK_COLOR,
  },
});

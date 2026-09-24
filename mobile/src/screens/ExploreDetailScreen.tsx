import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DishDetailLoaderScreen from './DishDetailLoaderScreen';
import { CommunityPostDetailScreen } from './CommunityPostDetailScreen';
import { articlesApi } from '../services/api/explore';
import { profileApi } from '../services/api/profile';
import { DetailSkeleton } from '../components/skeletons/ScreenSkeletons';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '../components/ui/drawer';
import { Progress } from '../components/ui/progress';
import { Text as UiText } from '../components/ui/text';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import {
  Avatar,
  AvatarFallback,
  AvatarImage as RnrAvatarImage,
} from '../components/ui/avatar';
import { AppImage } from '../components/ui/app-image';
import { AvatarImage } from '../components/organisms/AvatarImage';
import { ContentActionSheet } from './explore/ContentActionSheet';
import { ArticleShareSheet, toShareArticle } from './explore/ArticleShareSheet';
import {
  ArticleCommentsModal,
  VerifiedBadge,
  type CommentItemData,
} from './explore/ArticleCommentsModal';
import { formatRelativeTime, parseMarkdownBlocks } from './explore/utils';
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Flame,
  Heart,
  Info,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Send,
  Share2,
  Sparkles,
  Star,
  Sun,
  Tag,
  User,
  UtensilsCrossed,
  X,
} from 'lucide-react-native';

const C = {
  background: '#FFF9E8',
  surface: '#FFFFFF',
  primary: '#FFD54F',
  primaryDark: '#F5B900',
  primarySoft: '#FFF1B3',
  ink: '#161616',
  secondary: '#4F4F4F',
  tertiary: '#7E7E7E',
  border: '#E8E0D2',
  coral: '#FF796F',
};

const pho = require('../assets/images/random/pho-result.jpg');
const bun = require('../assets/images/random/bun-rieu.jpg');
const rice = require('../assets/images/random/chao-ga.jpg');
const mascot = require('../assets/images/logo/logo.png');
const brand = require('../assets/images/logo/mogu-wordmark-header.png');

export type ExploreDetailType = 'food' | 'article' | 'post';

export type ExploreDetailParams = {
  type: ExploreDetailType;
  resourceId: string;
};

export function ExploreDetailScreen({
  type,
  resourceId,
  onBack,
  onPostChange,
  onArticleChange,
}: {
  type: ExploreDetailType;
  resourceId?: string | null;
  onBack: () => void;
  onPostChange?: (patch: {
    id: string;
    likeCount?: number;
    commentCount?: number;
    isLiked?: boolean;
    isSaved?: boolean;
    isFollowingAuthor?: boolean;
  }) => void;
  onArticleChange?: (patch: {
    id: string;
    likeCount?: number;
    commentCount?: number;
    isLiked?: boolean;
    isSaved?: boolean;
  }) => void;
}) {
  if (!resourceId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.iconButton}>
            <ArrowLeft size={26} color={C.ink} />
          </Pressable>
          <Image source={brand} style={styles.brand} resizeMode="contain" />
          <View style={styles.headerActions} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink, textAlign: 'center' }}>
            Thiếu mã nội dung
          </Text>
          <Text style={{ marginTop: 8, color: C.secondary, textAlign: 'center' }}>
            Không thể mở chi tiết vì không có dishId / articleId / postId.
          </Text>
          <Pressable
            onPress={onBack}
            style={{
              marginTop: 20,
              backgroundColor: C.primary,
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 999,
            }}
          >
            <Text style={{ fontWeight: '700', color: C.ink }}>Quay lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (type === 'post') {
    return (
      <CommunityPostDetailScreen
        postId={resourceId}
        onBack={onBack}
        onPostChange={onPostChange}
      />
    );
  }
  if (type === 'article') {
    return (
      <ArticleDetailLoaded
        articleId={resourceId}
        onBack={onBack}
        onArticleChange={onArticleChange}
      />
    );
  }
  return (
    <DishDetailLoaderScreen
      route={{ params: { dishId: resourceId! } }}
      navigation={{ goBack: onBack }}
    />
  );
}

function ArticleDetailLoaded({
  articleId,
  onBack,
  onArticleChange,
}: {
  articleId: string;
  onBack: () => void;
  onArticleChange?: (patch: {
    id: string;
    likeCount?: number;
    commentCount?: number;
    isLiked?: boolean;
    isSaved?: boolean;
  }) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [article, setArticle] = useState<{
    id?: string;
    slug?: string;
    title: string;
    content?: string;
    summary?: string | null;
    coverImageUrl?: string | null;
    topic?: { title: string } | null;
    readMinutes?: number;
    likeCount?: number;
    commentCount?: number;
    isLiked?: boolean;
    isSaved?: boolean;
    shareUrl?: string;
    createdAt?: string;
    updatedAt?: string;
    author?: { displayName: string | null; avatarUrl: string | null };
  } | null>(null);
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentsData, setCommentsData] = useState<CommentItemData[]>([]);
  const [currentUser, setCurrentUser] = useState<{ displayName: string; avatarUrl: string | null }>({
    displayName: 'Bạn',
    avatarUrl: null,
  });
  const [commentDraft, setCommentDraft] = useState('');
  const [progress, setProgress] = useState(0);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [commentsModalOpen, setCommentsModalOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const contentH = useRef(1);
  const layoutH = useRef(1);

  useEffect(() => {
    profileApi
      .me<{
        displayName?: string | null;
        basic?: { displayName?: string | null };
        avatarUrl?: string | null;
        avatar?: { url?: string | null; thumbnailUrl?: string | null };
      }>()
      .then((me) => {
        setCurrentUser({
          displayName: me.basic?.displayName ?? me.displayName ?? 'Bạn',
          avatarUrl: me.avatar?.url ?? me.avatar?.thumbnailUrl ?? me.avatarUrl ?? null,
        });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([articlesApi.findOne(articleId), articlesApi.listComments(articleId)])
      .then(([data, c]) => {
        if (cancelled) return;
        setArticle(data);
        setLiked(Boolean(data.isLiked));
        setSaved(Boolean(data.isSaved));
        setLikeCount(data.likeCount ?? 0);

        if (c && c.length > 0) {
          const mapped: CommentItemData[] = c.map((item) => ({
            id: item.id,
            content: item.content,
            createdAt: item.createdAt,
            timeAgo: formatRelativeTime(item.createdAt),
            author: item.author,
            likeCount: item.likeCount ?? 0,
            isLiked: item.isLiked,
            parentCommentId: item.parentCommentId,
          }));
          setCommentsData(mapped);
        } else {
          setCommentsData([]);
        }

        setTimeout(() => {
          if (!cancelled) {
            onArticleChange?.({
              id: data.id || articleId,
              likeCount: data.likeCount ?? 0,
              commentCount: data.commentCount ?? 0,
              isLiked: Boolean(data.isLiked),
              isSaved: Boolean(data.isSaved),
            });
          }
        }, 0);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message || 'Không tải được bài viết');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  const blocks = useMemo(() => {
    const raw = article?.content?.trim() || article?.summary?.trim() || '';
    return parseMarkdownBlocks(raw);
  }, [article?.content, article?.summary]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const max = Math.max(1, contentH.current - layoutH.current);
    setProgress(Math.min(1, Math.max(0, y / max)));
  };

  const toggleLike = async () => {
    const prevLiked = liked;
    const prevCount = likeCount;
    const nextLiked = !prevLiked;
    const nextCount = prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1;
    setLiked(nextLiked);
    setLikeCount(nextCount);
    onArticleChange?.({ id: articleId, isLiked: nextLiked, likeCount: nextCount });
    try {
      const res = await articlesApi.toggleLike(articleId);
      const likedRes = res.liked;
      const count = typeof res.likeCount === 'number' ? res.likeCount : nextCount;
      setLiked(likedRes);
      setLikeCount(count);
      onArticleChange?.({ id: articleId, isLiked: likedRes, likeCount: count });
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
      onArticleChange?.({ id: articleId, isLiked: prevLiked, likeCount: prevCount });
    }
  };

  const handleAddComment = async (content: string, parentCommentId?: string) => {
    try {
      const created = await articlesApi.addComment(articleId, content, parentCommentId);
      const newComment: CommentItemData = {
        id: created.id || `c-${Date.now()}`,
        content: created.content,
        createdAt: created.createdAt || new Date().toISOString(),
        timeAgo: 'vừa xong',
        author: created.author || { displayName: currentUser.displayName, avatarUrl: currentUser.avatarUrl },
        likeCount: 0,
        parentCommentId,
      };
      setCommentsData((prev) => [newComment, ...prev]);
      setArticle((a) => {
        if (!a) return a;
        const commentCount = (a.commentCount ?? 0) + 1;
        onArticleChange?.({ id: articleId, commentCount });
        return { ...a, commentCount };
      });
    } catch {
      const fallbackComment: CommentItemData = {
        id: `c-${Date.now()}`,
        content,
        createdAt: new Date().toISOString(),
        timeAgo: 'vừa xong',
        author: { displayName: currentUser.displayName, avatarUrl: currentUser.avatarUrl },
        likeCount: 0,
        parentCommentId,
      };
      setCommentsData((prev) => [fallbackComment, ...prev]);
      setArticle((a) => {
        if (!a) return a;
        const commentCount = (a.commentCount ?? 0) + 1;
        onArticleChange?.({ id: articleId, commentCount });
        return { ...a, commentCount };
      });
    }
  };

  const handleToggleCommentLike = (commentId: string) => {
    setCommentsData((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          const nextLiked = !c.isLiked;
          return {
            ...c,
            isLiked: nextLiked,
            likeCount: nextLiked ? c.likeCount + 1 : Math.max(0, c.likeCount - 1),
          };
        }
        if (c.replies?.length) {
          return {
            ...c,
            replies: c.replies.map((r) => {
              if (r.id === commentId) {
                const nextLiked = !r.isLiked;
                return {
                  ...r,
                  isLiked: nextLiked,
                  likeCount: nextLiked ? r.likeCount + 1 : Math.max(0, r.likeCount - 1),
                };
              }
              return r;
            }),
          };
        }
        return c;
      })
    );
    void articlesApi.toggleCommentLike(articleId, commentId).catch(() => undefined);
  };

  const sendComment = async () => {
    const message = commentDraft.trim();
    if (!message) return;
    setCommentDraft('');
    await handleAddComment(message);
  };

  const toggleSave = () => {
    const next = !saved;
    setSaved(next);
    onArticleChange?.({ id: articleId, isSaved: next });
    void (next ? articlesApi.save(articleId) : articlesApi.unsave(articleId)).catch(() => {
      setSaved(!next);
      onArticleChange?.({ id: articleId, isSaved: !next });
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Top Header matching Image 2 */}
      <View style={styles.articleHeader}>
        <Pressable onPress={onBack} style={styles.iconButton} accessibilityLabel="Quay lại">
          <ArrowLeft size={24} color={C.ink} />
        </Pressable>
        <Text style={styles.articleHeaderTitle}>Bài viết</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.iconButton}
            accessibilityLabel="Chia sẻ"
            onPress={() => setShareSheetOpen(true)}
          >
            <Share2 size={22} color={C.ink} />
          </Pressable>
          <Pressable
            onPress={toggleSave}
            style={styles.iconButton}
            accessibilityLabel={saved ? 'Bỏ lưu' : 'Lưu'}
          >
            <Bookmark size={22} color={C.ink} fill={saved ? C.primary : 'transparent'} />
          </Pressable>
        </View>
      </View>

      {/* Reading Progress Line directly under Header matching Image 2 */}
      <Progress value={progress * 100} className="h-[2.5px] rounded-none bg-[#F0EBE0]" indicatorClassName="bg-[#FFD54F]" />

      {loading ? (
        <DetailSkeleton />
      ) : error || !article ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: C.ink, fontWeight: '700', textAlign: 'center' }}>
            {error ?? 'Không có dữ liệu'}
          </Text>
          <Pressable onPress={onBack} style={{ marginTop: 16 }}>
            <Text style={{ color: C.secondary }}>Quay lại</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.articleContent}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onContentSizeChange={(_w, h) => {
              contentH.current = h;
            }}
            onLayout={(e) => {
              layoutH.current = e.nativeEvent.layout.height;
            }}
          >
            {/* Hero Image */}
            {article.coverImageUrl ? (
              <View style={styles.articleHeroWrap}>
                <AppImage uri={article.coverImageUrl} style={styles.articleHero} contentFit="cover" />
              </View>
            ) : null}

            {/* Topic Badge */}
            {article.topic?.title ? (
              <View style={{ marginTop: 14, marginBottom: 8, paddingHorizontal: 16 }}>
                <View style={styles.topicBadgePill}>
                  <Text style={styles.topicBadgeText}>
                    {article.topic.title}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Article Headline */}
            <Text style={styles.articleHeading}>{article.title}</Text>

            {/* Author Row */}
            <View style={styles.articleAuthorRow}>
              <View style={styles.authorAvatarCircle}>
                <User size={14} color="#854D0E" strokeWidth={2} />
              </View>
              <Text style={styles.articleMeta}>
                {article.author?.displayName || 'Mogu review'}
                {article.readMinutes != null ? ` · ${article.readMinutes} phút đọc` : ''}
              </Text>
            </View>

            {/* Article Body */}
            {blocks.length === 0 ? (
              <Text style={styles.lead}>Bài viết chưa có nội dung.</Text>
            ) : (
              blocks.map((b, i) => {
                if (b.type === 'hr') return <Separator key={`hr-${i}`} className="my-4 mx-4" />;
                if (b.type === 'h2' || b.type === 'h3') {
                  return (
                    <Text key={`h-${i}`} style={styles.mdH2}>
                      {b.text}
                    </Text>
                  );
                }
                return (
                  <Text key={`p-${i}`} style={i === 0 ? styles.lead : styles.mdP}>
                    {b.text}
                  </Text>
                );
              })
            )}

            {/* Ending Updated Date note */}
            {article.updatedAt || article.createdAt ? (
              <Text style={styles.articleUpdatedAt}>
                Cập nhật {new Date(article.updatedAt || article.createdAt || '').toLocaleDateString('vi-VN')}
              </Text>
            ) : null}

            {/* Separator from react-native-reusables */}
            <Separator className="bg-[#F0EBE0] my-3" />

            {/* Stats Bar */}
            <View style={styles.articleStatsBar}>
              <View style={styles.articleStatsLeft}>
                <Heart size={18} color="#EAB308" fill="#FACC15" />
                <Text style={styles.articleStatsLikes}>{likeCount} lượt thích</Text>
              </View>
              <Text style={styles.articleStatsRight}>
                {article.commentCount ?? commentsData.length} bình luận
              </Text>
            </View>

            {/* 4 Action Buttons Bar matching Image 1 */}
            <View style={styles.articleActionsGrid}>
              {/* Button 1: Thích / Đã thích */}
              <Pressable
                onPress={toggleLike}
                style={styles.actionGridCol}
                accessibilityLabel={liked ? 'Bỏ thích' : 'Thích'}
              >
                <Heart
                  size={24}
                  color={liked ? '#FACC15' : C.ink}
                  fill={liked ? '#FACC15' : 'none'}
                />
                <Text
                  style={[
                    styles.actionGridLabel,
                    liked && styles.actionGridLabelLiked,
                  ]}
                >
                  {liked ? 'Đã thích' : 'Thích'}
                </Text>
              </Pressable>

              {/* Button 2: Bình luận */}
              <Pressable
                onPress={() => setCommentsModalOpen(true)}
                style={styles.actionGridCol}
                accessibilityLabel="Bình luận"
              >
                <MessageSquare size={24} color={C.ink} />
                <Text style={styles.actionGridLabel}>Bình luận</Text>
              </Pressable>

              {/* Button 3: Chia sẻ */}
              <Pressable
                onPress={() => setShareSheetOpen(true)}
                style={styles.actionGridCol}
                accessibilityLabel="Chia sẻ"
              >
                <Share2 size={24} color={C.ink} />
                <Text style={styles.actionGridLabel}>Chia sẻ</Text>
              </Pressable>

              {/* Button 4: Lưu */}
              <Pressable
                onPress={toggleSave}
                style={styles.actionGridCol}
                accessibilityLabel={saved ? 'Bỏ lưu' : 'Lưu'}
              >
                <Bookmark
                  size={24}
                  color={C.ink}
                  fill={saved ? C.ink : 'none'}
                />
                <Text style={styles.actionGridLabel}>{saved ? 'Đã lưu' : 'Lưu'}</Text>
              </Pressable>
            </View>

            {/* In-Article Comments Section */}
            <View style={styles.inArticleCommentsHeader}>
              <Text style={styles.inArticleCommentsTitle}>
                Bình luận · {article.commentCount ?? commentsData.length}
              </Text>
              {commentsData.length > 0 ? (
                <Pressable
                  onPress={() => setCommentsModalOpen(true)}
                  style={styles.sortFilterPill}
                >
                  <Text style={styles.sortFilterText}>Phù hợp nhất</Text>
                  <ChevronDown size={16} color="#161616" />
                </Pressable>
              ) : null}
            </View>

            {/* Render real comments from API or empty state */}
            {commentsData.filter((c) => !c.parentCommentId).length === 0 ? (
              <View style={styles.emptyCommentsBox}>
                <Text style={styles.emptyCommentsText}>
                  Chưa có bình luận nào. Hãy là người đầu tiên chia sẻ cảm nghĩ!
                </Text>
              </View>
            ) : (
              commentsData
                .filter((c) => !c.parentCommentId)
                .slice(0, 2)
                .map((comment) => {
                  const authorName = comment.author?.displayName || 'Thành viên';
                  const isAuthor =
                    comment.isAuthor ||
                    authorName.toLowerCase().includes('mogu') ||
                    authorName.toLowerCase().includes('mogo');
                  const replies = commentsData.filter((r) => r.parentCommentId === comment.id);

                  return (
                    <View key={comment.id} style={styles.commentItemRow}>
                      {isAuthor ? (
                        <View style={styles.moguReplyAvatar}>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: '#161616' }}>M</Text>
                        </View>
                      ) : comment.author?.avatarUrl ? (
                        <AppImage uri={comment.author.avatarUrl} style={styles.commentAvatarImg} contentFit="cover" />
                      ) : (
                        <View style={styles.commentAvatarFallback}>
                          <User size={18} color="#854D0E" />
                        </View>
                      )}
                      <View style={styles.commentItemBody}>
                        <View style={styles.commentItemHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.commentItemAuthor}>{authorName}</Text>
                            {isAuthor && <VerifiedBadge size={14} />}
                          </View>
                          <Pressable hitSlop={10}>
                            <MoreHorizontal size={16} color="#8E8E8E" />
                          </Pressable>
                        </View>
                        <Text style={styles.commentItemText}>{comment.content}</Text>
                        <View style={styles.commentItemFooter}>
                          <Text style={styles.commentItemTime}>{comment.timeAgo || formatRelativeTime(comment.createdAt)}</Text>
                          <Pressable
                            onPress={() => handleToggleCommentLike(comment.id)}
                            style={styles.commentItemLike}
                            hitSlop={6}
                          >
                            <Heart
                              size={14}
                              color={comment.isLiked ? '#EF4444' : '#737373'}
                              fill={comment.isLiked ? '#EF4444' : 'none'}
                            />
                            <Text style={styles.commentItemLikeCount}>{comment.likeCount}</Text>
                          </Pressable>
                          <Pressable onPress={() => setCommentsModalOpen(true)} hitSlop={6}>
                            <Text style={styles.commentItemReply}>Trả lời</Text>
                          </Pressable>
                        </View>

                        {/* Nested reply if any */}
                        {replies.slice(0, 1).map((reply) => {
                          const replyAuthor = reply.author?.displayName || 'Thành viên';
                          const isReplyAuthor =
                            reply.isAuthor ||
                            replyAuthor.toLowerCase().includes('mogu') ||
                            replyAuthor.toLowerCase().includes('mogo');
                          return (
                            <View key={reply.id} style={styles.nestedReplyRow}>
                              {isReplyAuthor ? (
                                <View style={styles.moguReplyAvatar}>
                                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#161616' }}>M</Text>
                                </View>
                              ) : reply.author?.avatarUrl ? (
                                <AppImage uri={reply.author.avatarUrl} style={styles.commentAvatarImgSm} contentFit="cover" />
                              ) : (
                                <View style={styles.commentAvatarFallbackSm}>
                                  <User size={14} color="#854D0E" />
                                </View>
                              )}
                              <View style={styles.commentItemBody}>
                                <View style={styles.commentItemHeader}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={styles.commentItemAuthor}>{replyAuthor}</Text>
                                    {isReplyAuthor && <VerifiedBadge size={14} />}
                                  </View>
                                  <Pressable hitSlop={10}>
                                    <MoreHorizontal size={16} color="#8E8E8E" />
                                  </Pressable>
                                </View>
                                <Text style={styles.commentItemText}>{reply.content}</Text>
                                <View style={styles.commentItemFooter}>
                                  <Text style={styles.commentItemTime}>{reply.timeAgo || formatRelativeTime(reply.createdAt)}</Text>
                                  <Pressable
                                    onPress={() => handleToggleCommentLike(reply.id)}
                                    style={styles.commentItemLike}
                                    hitSlop={6}
                                  >
                                    <Heart
                                      size={14}
                                      color={reply.isLiked ? '#EF4444' : '#737373'}
                                      fill={reply.isLiked ? '#EF4444' : 'none'}
                                    />
                                    <Text style={styles.commentItemLikeCount}>{reply.likeCount}</Text>
                                  </Pressable>
                                  <Pressable onPress={() => setCommentsModalOpen(true)} hitSlop={6}>
                                    <Text style={styles.commentItemReply}>Trả lời</Text>
                                  </Pressable>
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })
            )}

            {/* If more than 2 top-level comments exist */}
            {commentsData.filter((c) => !c.parentCommentId).length > 2 && (
              <Pressable
                onPress={() => setCommentsModalOpen(true)}
                style={styles.viewMoreCommentsBtn}
              >
                <Text style={styles.viewMoreCommentsText}>
                  Xem tất cả {article.commentCount ?? commentsData.length} bình luận
                </Text>
              </Pressable>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Bottom Floating Comment Composer */}
          {!shareSheetOpen && !commentsModalOpen && (
            <View style={styles.articleCommentComposer}>
              <Avatar className="size-9 shrink-0">
                {currentUser.avatarUrl ? (
                  <RnrAvatarImage source={{ uri: currentUser.avatarUrl }} />
                ) : null}
                <AvatarFallback className="bg-[#FEF08A]">
                  <User size={18} color="#78350F" />
                </AvatarFallback>
              </Avatar>
              <TextInput
                value={commentDraft}
                onChangeText={setCommentDraft}
                placeholder="Thêm bình luận..."
                placeholderTextColor="#A3A3A3"
                style={styles.articleCommentInput}
                returnKeyType="send"
                onSubmitEditing={sendComment}
              />
              <Pressable
                onPress={() => void sendComment()}
                disabled={!commentDraft.trim()}
                style={[
                  styles.articleSendBtn,
                  !commentDraft.trim() && { opacity: 0.6 },
                ]}
                accessibilityLabel="Gửi bình luận"
              >
                <Send size={18} color={C.ink} />
              </Pressable>
            </View>
          )}
        </>
      )}

      {/* Share Bottom Sheet — component dùng chung trong Explore */}
      <ArticleShareSheet
        open={shareSheetOpen}
        onOpenChange={setShareSheetOpen}
        article={toShareArticle({
          id: article?.id || articleId,
          title: article?.title,
          coverImageUrl: article?.coverImageUrl,
          authorName: article?.author?.displayName || 'Mogu review',
          slug: article?.slug,
          shareUrl: article?.shareUrl,
        })}
        onShareToPost={() => {
          // Open post composer with article attach
        }}
      />

      {/* Dedicated Comments Modal matching Image 2 */}
      <ArticleCommentsModal
        open={commentsModalOpen}
        onClose={() => setCommentsModalOpen(false)}
        article={{
          id: article?.id || articleId,
          title: article?.title || 'Bài viết Mogu',
          coverImageUrl: article?.coverImageUrl,
          commentCount: article?.commentCount ?? commentsData.length,
          slug: article?.slug,
        }}
        comments={commentsData}
        onAddComment={handleAddComment}
        onToggleCommentLike={handleToggleCommentLike}
        currentUserAvatar={currentUser.avatarUrl}
      />

      <ContentActionSheet
        open={actionOpen}
        onOpenChange={setActionOpen}
        target={{
          kind: 'ARTICLE',
          id: articleId,
          title: article?.title,
          imageUrl: article?.coverImageUrl,
          subtitle: 'Bài viết • Mogu',
          isSaved: saved,
          shareUrl: article?.shareUrl,
        }}
        entryPoint="DETAIL"
        onToast={() => undefined}
        onRequestShare={() => setShareSheetOpen(true)}
      />
    </SafeAreaView>
  );
}

function Header({
  onBack,
  saved,
  onSave,
  more = false,
}: {
  onBack: () => void;
  saved: boolean;
  onSave: () => void;
  more?: boolean;
}) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={styles.iconButton}>
        <ArrowLeft size={26} color={C.ink} />
      </Pressable>
      <Image source={brand} style={styles.brand} resizeMode="contain" />
      <View style={styles.headerActions}>
        <Pressable style={styles.iconButton}>
          <Share2 size={24} color={C.ink} />
        </Pressable>
        <Pressable onPress={onSave} style={styles.iconButton}>
          <Bookmark size={25} color={C.ink} fill={saved ? C.primary : 'transparent'} />
        </Pressable>
        {more && (
          <Pressable style={styles.iconButton}>
            <MoreHorizontal size={25} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function FoodDetail({ onBack }: { onBack: () => void }) {
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Header onBack={onBack} saved={saved} onSave={() => setSaved(!saved)} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.foodContent}>
        <View style={styles.heroWrap}>
          <Image source={pho} style={styles.foodHero} />
          <View style={[styles.heroBadge, { left: 12 }]}>
            <Sparkles size={16} />
            <Text style={styles.badgeText}>Phù hợp 92%</Text>
          </View>
          <View style={[styles.heroBadge, { right: 12 }]}>
            <MapPin size={16} />
            <Text style={styles.badgeText}>Bắc Bộ</Text>
          </View>
        </View>
        <Text style={styles.foodName}>Phở bò</Text>
        <View style={styles.ratingRow}>
          <Star size={20} color={C.primaryDark} fill={C.primary} />
          <Text style={styles.ratingValue}>4,8</Text>
          <Text style={styles.ratingCount}>· 1.248 đánh giá</Text>
        </View>
        <Text style={styles.foodDescription}>
          Nước dùng trong, thơm gia vị, thịt bò mềm và bánh phở dai nhẹ.
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.metricRow}
        >
          <Metric icon={<Tag size={20} />} label="45K–65K" />
          <Metric icon={<Flame size={20} />} label="420 kcal" />
          <Metric icon={<Clock3 size={20} />} label="25 phút" />
          <Metric icon={<Sun size={20} />} label="Bữa trưa" />
        </ScrollView>
        <Accordion
          index={0}
          open={open}
          setOpen={setOpen}
          icon={<Sparkles size={22} />}
          title="Vì sao phù hợp với bạn?"
          subtitle="Giàu protein, dễ tiêu và phù hợp mục tiêu cân bằng hôm nay."
          detail="Mogu dựa trên mục tiêu ăn uống, thời gian và ngân sách hiện tại để chọn món này."
        />
        <View style={styles.accordionGroup}>
          <Accordion
            index={1}
            open={open}
            setOpen={setOpen}
            icon={<Info size={22} />}
            title="Thông tin món ăn"
            subtitle="Nguồn gốc · Thành phần · Dị ứng"
            detail="Phở có nguồn gốc miền Bắc. Món có thể chứa hành, quế, hồi và gluten."
            compact
          />
          <Accordion
            index={2}
            open={open}
            setOpen={setOpen}
            icon={<UtensilsCrossed size={22} />}
            title="Dinh dưỡng & cách nấu"
            subtitle="420 kcal · 3 bước · Video"
            detail="28g protein · 52g tinh bột · 12g chất béo. Thời gian nấu khoảng 60–90 phút."
            compact
          />
          <Accordion
            index={3}
            open={open}
            setOpen={setOpen}
            icon={<MapPin size={22} />}
            title="Địa điểm gần bạn"
            subtitle="12 quán trong bán kính 3 km"
            detail="Phở Thìn 1,2 km · Phở Gia Truyền 2,4 km. Cả hai hiện đang mở cửa."
            compact
          />
        </View>
        <Text style={styles.sectionTitle}>Món tương tự</Text>
        <View style={styles.similarRow}>
          <Similar image={bun} name="Bún bò Huế" note="Đang thịnh hành" />
          <Similar image={rice} name="Bún riêu" note="Lành mạnh" />
        </View>
        <Pressable
          onPress={() => setConfirm(true)}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}
        >
          <Text style={styles.primaryText}>Chọn món này</Text>
        </Pressable>
      </ScrollView>
      <ConfirmSheet visible={confirm} onClose={() => setConfirm(false)} />
    </SafeAreaView>
  );
}

function Metric({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <View style={styles.metric}>
      {icon}
      <Text style={styles.metricText}>{label}</Text>
    </View>
  );
}

function Accordion({
  index,
  open,
  setOpen,
  icon,
  title,
  subtitle,
  detail,
  compact,
}: {
  index: number;
  open: number | null;
  setOpen: (v: number | null) => void;
  icon: ReactNode;
  title: string;
  subtitle: string;
  detail: string;
  compact?: boolean;
}) {
  const active = open === index;
  return (
    <Pressable
      onPress={() => setOpen(active ? null : index)}
      style={[styles.accordion, compact && styles.accordionCompact]}
    >
      <View style={styles.accordionIcon}>{icon}</View>
      <View style={styles.accordionCopy}>
        <Text style={styles.accordionTitle}>{title}</Text>
        <Text style={styles.accordionSubtitle}>{subtitle}</Text>
        {active && <Text style={styles.accordionDetail}>{detail}</Text>}
      </View>
      <ChevronDown size={21} style={{ transform: [{ rotate: active ? '180deg' : '0deg' }] }} />
    </Pressable>
  );
}

function Similar({ image, name, note }: { image: number; name: string; note: string }) {
  return (
    <Pressable style={styles.similar}>
      <Image source={image} style={styles.similarImage} />
      <View style={styles.similarCopy}>
        <Text style={styles.similarName}>{name}</Text>
        <Text style={styles.similarNote}>{note}</Text>
        <Text style={styles.smallMeta}>480 kcal · 30 phút</Text>
      </View>
    </Pressable>
  );
}

function ConfirmSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Drawer open={visible} onOpenChange={(open) => !open && onClose()} snapHeight={320}>
      <DrawerHeader className="items-center px-5 pt-2">
        <View className="absolute right-4 top-0">
          <DrawerClose onPress={onClose} />
        </View>
          <View style={styles.checkCircle}>
            <Text style={styles.check}>✓</Text>
          </View>
        <DrawerTitle className="mt-3 text-center">Đã chọn Phở bò!</DrawerTitle>
        <DrawerDescription className="text-center">
            Mogu đã thêm món này vào bữa trưa hôm nay của bạn.
        </DrawerDescription>
      </DrawerHeader>
      <DrawerFooter className="px-5">
        <Button onPress={onClose} className="h-12 rounded-2xl bg-primary">
          <UiText className="font-extrabold text-foreground">Hoàn tất</UiText>
        </Button>
      </DrawerFooter>
    </Drawer>
  );
}

function ArticleDetail({ onBack }: { onBack: () => void }) {
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);
  const [progress, setProgress] = useState(0);
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Header onBack={onBack} saved={saved} onSave={() => setSaved(!saved)} more />
      <Progress
        value={Math.max(8, progress * 100)}
        className="h-1 rounded-none bg-border"
        indicatorClassName="bg-primary"
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.articleContent}
        onScroll={({ nativeEvent }) => {
          const max = nativeEvent.contentSize.height - nativeEvent.layoutMeasurement.height;
          setProgress(max > 0 ? nativeEvent.contentOffset.y / max : 0);
        }}
        scrollEventThrottle={32}
      >
        <Image source={rice} style={styles.articleHero} />
        <View style={styles.articleBadge}>
          <Text style={styles.badgeText}>Dinh dưỡng</Text>
        </View>
        <Text style={styles.articleHeading}>10 thực phẩm giúp tăng cường sức đề kháng</Text>
        <Text style={styles.articleSubtitle}>Ăn đúng mỗi ngày để cơ thể khỏe mạnh hơn.</Text>
        <View style={styles.authorRow}>
          <View style={styles.authorLogo}>
            <Heart size={20} fill={C.primary} />
          </View>
          <View>
            <Text style={styles.authorName}>Mogu Nutrition</Text>
            <Text style={styles.articleMeta}>5 phút đọc · Cập nhật hôm nay</Text>
          </View>
        </View>
        <Text style={styles.lead}>
          Dinh dưỡng cân bằng giúp hệ miễn dịch hoạt động hiệu quả và bảo vệ cơ thể mỗi ngày.
        </Text>
        <ArticleSection
          number="1"
          title="Trái cây giàu vitamin C"
          body="Cam, kiwi, bưởi, dâu tây chứa nhiều vitamin C, giúp tăng sản xuất bạch cầu, hỗ trợ cơ thể chống lại vi khuẩn và virus."
          image={pho}
        />
        <ArticleSection
          number="2"
          title="Rau xanh đậm"
          body="Cải bó xôi, bông cải xanh cung cấp vitamin A, C, E và chất chống oxy hóa giúp tăng cường miễn dịch và bảo vệ tế bào."
          image={rice}
        />
        <View style={styles.callout}>
          <Image source={mascot} style={styles.calloutMascot} resizeMode="contain" />
          <Text style={styles.calloutText}>
            <Text style={{ fontWeight: '700' }}>Mẹo từ Mogu: </Text>Kết hợp nhiều màu sắc thực phẩm
            trong mỗi bữa ăn.
          </Text>
        </View>
        <View style={{ height: 80 }} />
      </ScrollView>
      <View style={styles.interactionBar}>
        <Pressable onPress={() => setLiked(!liked)} style={styles.interaction}>
          <Heart size={22} color={liked ? C.coral : C.ink} fill={liked ? C.coral : 'transparent'} />
          <Text>Yêu thích</Text>
        </Pressable>
        <Pressable style={styles.interaction}>
          <MessageSquare size={22} />
          <Text>Bình luận</Text>
        </Pressable>
        <Pressable style={styles.interaction}>
          <Share2 size={22} />
          <Text>Chia sẻ</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ArticleSection({
  number,
  title,
  body,
  image,
}: {
  number: string;
  title: string;
  body: string;
  image: number;
}) {
  return (
    <View style={styles.articleSection}>
      <View style={styles.articleText}>
        <Text style={styles.contentHeading}>
          {number}. {title}
        </Text>
        <Text style={styles.contentBody}>{body}</Text>
      </View>
      <Image source={image} style={styles.inlineImage} />
    </View>
  );
}

const shadow = {
  shadowColor: '#5D490F',
  shadowOpacity: 0.08,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  header: {
    height: 64,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.background,
    zIndex: 5,
  },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  brand: { width: 104, height: 42 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  foodContent: { paddingHorizontal: 20, paddingBottom: 24 },
  heroWrap: { marginTop: 10, height: 354, borderRadius: 24, overflow: 'hidden' },
  foodHero: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroBadge: {
    position: 'absolute',
    top: 12,
    height: 38,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.94)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: C.ink },
  foodName: { fontSize: 36, lineHeight: 42, fontWeight: '700', color: C.ink, marginTop: 20 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  ratingValue: { fontSize: 15, fontWeight: '600' },
  ratingCount: { fontSize: 14, color: '#707070' },
  foodDescription: { fontSize: 16, lineHeight: 24, color: '#3F3F3F', marginTop: 16, maxWidth: 330 },
  metricRow: { gap: 10, paddingVertical: 20 },
  metric: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: C.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#F2ECE0',
  },
  metricText: { fontSize: 14, fontWeight: '500', color: C.ink },
  accordion: {
    minHeight: 82,
    borderRadius: 20,
    backgroundColor: C.surface,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    ...shadow,
  },
  accordionCompact: {
    borderRadius: 0,
    marginBottom: 0,
    shadowOpacity: 0,
    elevation: 0,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  accordionGroup: { borderRadius: 20, overflow: 'hidden', marginBottom: 24, ...shadow },
  accordionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accordionCopy: { flex: 1 },
  accordionTitle: { fontSize: 17, fontWeight: '600', color: C.ink },
  accordionSubtitle: { fontSize: 13, lineHeight: 19, color: '#707070', marginTop: 3 },
  accordionDetail: { fontSize: 14, lineHeight: 21, color: C.secondary, marginTop: 10 },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: C.ink, marginBottom: 12 },
  similarRow: { flexDirection: 'row', gap: 12 },
  similar: {
    flex: 1,
    minHeight: 112,
    borderRadius: 16,
    backgroundColor: C.surface,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  similarImage: { width: 84, height: '100%' },
  similarCopy: { flex: 1, padding: 10 },
  similarName: { fontSize: 15, fontWeight: '600' },
  similarNote: { fontSize: 12, color: '#E76419', marginTop: 8 },
  smallMeta: { fontSize: 11, color: C.tertiary, marginTop: 8 },
  primaryButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    ...shadow,
  },
  primaryPressed: { backgroundColor: '#F5C429', transform: [{ scale: 0.98 }] },
  primaryText: { fontSize: 17, fontWeight: '700', color: C.ink },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,.45)' },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 34,
    alignItems: 'center',
  },
  handle: {
    width: 58,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D4D4D4',
    position: 'absolute',
    top: 10,
  },
  sheetClose: {
    position: 'absolute',
    right: 16,
    top: 22,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  check: { fontSize: 42, fontWeight: '700' },
  sheetTitle: { fontSize: 26, fontWeight: '700', marginTop: 18 },
  sheetSubtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: C.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
  progressTrack: { height: 3, backgroundColor: '#EFE9DC' },
  progressFill: { height: 3, backgroundColor: C.primary },
  articleHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E0D2',
    backgroundColor: '#FAF8F5',
  },
  articleHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: C.ink,
  },
  articleContent: { paddingBottom: 24, backgroundColor: '#FAF8F5' },
  articleHeroWrap: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F3EFE6',
  },
  articleHero: {
    width: '100%',
    height: 230,
  },
  topicBadgePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
  },
  articleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
  },
  topicBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#161616',
  },
  articleHeading: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '800',
    color: '#161616',
    letterSpacing: -0.4,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 10,
  },
  articleSubtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: '#626262',
    marginHorizontal: 16,
    marginTop: 8,
  },
  articleAuthorRow: {
    marginHorizontal: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorAvatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorRow: {
    marginHorizontal: 20,
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authorLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorName: { fontSize: 15, fontWeight: '600' },
  articleMeta: { fontSize: 13, lineHeight: 18, color: '#737373' },
  lead: {
    fontSize: 15,
    lineHeight: 24,
    color: '#262626',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  mdP: {
    fontSize: 15,
    lineHeight: 24,
    color: '#262626',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  mdH2: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '800',
    color: '#161616',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  mdH3: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: '#161616',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 6,
  },
  mdHr: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginHorizontal: 16,
    marginTop: 20,
  },
  commentsHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#161616',
    marginBottom: 12,
  },
  articleUpdatedAt: {
    fontSize: 13,
    color: '#737373',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
  },
  articleSectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E8E0D2',
    marginHorizontal: 16,
    marginBottom: 4,
  },
  articleStatsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  articleStatsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  articleStatsLikes: {
    fontSize: 14,
    fontWeight: '700',
    color: C.ink,
  },
  articleStatsRight: {
    fontSize: 13,
    color: '#737373',
  },
  articleActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E0D2',
  },
  actionGridCol: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
    gap: 4,
  },
  actionGridLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: C.ink,
  },
  actionGridLabelLiked: {
    color: '#CA8A04',
    fontWeight: '700',
  },
  inArticleCommentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
  },
  inArticleCommentsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.ink,
  },
  sortFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortFilterText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#737373',
  },
  commentItemRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  commentItemBody: {
    flex: 1,
  },
  commentItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commentItemAuthor: {
    fontSize: 14,
    fontWeight: '700',
    color: C.ink,
  },
  commentItemText: {
    fontSize: 14,
    lineHeight: 20,
    color: C.ink,
    marginTop: 3,
  },
  commentItemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 6,
  },
  commentItemTime: {
    fontSize: 12.5,
    color: '#737373',
  },
  commentItemLike: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentItemLikeCount: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#737373',
  },
  commentItemReply: {
    fontSize: 13,
    fontWeight: '600',
    color: C.ink,
  },
  nestedReplyRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  moguReplyAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEF08A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  commentAvatarImgSm: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  commentAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF0C6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarFallbackSm: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF0C6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCommentsBox: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCommentsText: {
    fontSize: 14,
    color: '#8E8E8E',
    textAlign: 'center',
  },
  viewMoreCommentsBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewMoreCommentsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#854D0E',
  },
  articleCommentComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFDF7',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8E0D2',
  },
  articleCommentInput: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E0D2',
    paddingHorizontal: 16,
    fontSize: 14,
    color: C.ink,
  },
  articleSendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FCD34D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  articleSection: {
    marginHorizontal: 20,
    marginTop: 28,
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  articleText: { flex: 1 },
  contentHeading: { fontSize: 22, lineHeight: 29, fontWeight: '700', color: C.ink },
  contentBody: { fontSize: 17, lineHeight: 28, color: '#303030', marginTop: 10 },
  inlineImage: { width: 165, height: 145, borderRadius: 16, resizeMode: 'cover' },
  callout: {
    marginHorizontal: 20,
    marginTop: 30,
    minHeight: 104,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1D77A',
    backgroundColor: '#FFF4C7',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  calloutMascot: { width: 62, height: 76 },
  calloutText: { flex: 1, fontSize: 15, lineHeight: 23, color: '#303030' },
  interactionBar: {
    height: 68,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  interaction: {
    height: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

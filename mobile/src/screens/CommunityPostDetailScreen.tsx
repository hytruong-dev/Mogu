import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Bookmark,
  Heart,
  MessageCircle,
  MapPin,
  MoreHorizontal,
  Send,
  Share2,
  UtensilsCrossed,
  X,
} from '@/components/icons';
import { communityApi, type ExplorePost, type PostComment } from '../services/api/explore';
import { DetailSkeleton } from '../components/skeletons/ScreenSkeletons';
import { AvatarImage } from '../components/organisms/AvatarImage';
import { useProfileDashboard } from '../hooks/useProfileDashboard';
import { Input } from '../components/ui/input';
import { ContentActionSheet } from './explore/ContentActionSheet';
import {
  ArticleShareSheet,
  toShareArticle,
  type ExploreShareArticle,
} from './explore/ArticleShareSheet';
import type { ContentActionTarget } from './explore/buildContentActions';
import { PostMediaCarousel } from './explore/PostMediaCarousel';
import { formatCount, formatRelativeTime } from './explore/utils';
import {
  BORDER,
  CREAM,
  INK,
  MUTED,
  RED_LIKE,
  TERTIARY,
  WHITE,
  YELLOW,
} from './explore/tokens';
type ReplyTarget = { commentId: string; name: string; mention: string } | null;

export function CommunityPostDetailScreen({
  postId,
  onBack,
  onPostChange,
}: {
  postId?: string | null;
  onBack: () => void;
  /** Sync like/comment/save state back to the explore feed list */
  onPostChange?: (patch: {
    id: string;
    likeCount?: number;
    commentCount?: number;
    isLiked?: boolean;
    isSaved?: boolean;
    isFollowingAuthor?: boolean;
  }) => void;
}) {
  const [loading, setLoading] = useState(Boolean(postId));
  const [error, setError] = useState<string | null>(null);
  const [post, setPost] = useState<ExplorePost | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [saved, setSaved] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [postLiked, setPostLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [replying, setReplying] = useState<ReplyTarget>(null);
  const [value, setValue] = useState('');
  const [actionOpen, setActionOpen] = useState(false);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [sharePayload, setSharePayload] = useState<ExploreShareArticle | null>(null);
  const inputRef = useRef<React.ElementRef<typeof Input>>(null);
  const { dash } = useProfileDashboard();
  const currentUserAvatar = dash?.profile?.avatar?.url;
  const currentUserGender = dash?.profile?.gender;
  const currentUserName = dash?.profile?.username ?? dash?.profile?.displayName;

  useEffect(() => {
    if (!postId) {
      setLoading(false);
      setError('Thiếu postId');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([communityApi.getPost(postId), communityApi.listComments(postId)])
      .then(([p, c]) => {
        if (cancelled) return;
        setPost(p);
        setComments(c);
        setPostLiked(Boolean(p.isLiked));
        setLikeCount(p.likeCount ?? 0);
        setSaved(Boolean(p.isSaved));
        setFollowed(Boolean(p.isFollowingAuthor));
        onPostChange?.({
          id: p.id,
          likeCount: p.likeCount,
          commentCount: p.commentCount,
          isLiked: Boolean(p.isLiked),
          isSaved: Boolean(p.isSaved),
          isFollowingAuthor: Boolean(p.isFollowingAuthor),
        });
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message || 'Không tải được bài đăng');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const beginReply = (comment: PostComment) => {
    const name = comment.author?.displayName || 'Thành viên';
    const mention = name.replace(/\s+/g, '');
    setReplying({ commentId: comment.id, name, mention });
    setValue(`@${mention} `);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const cancelReply = () => {
    setReplying(null);
    setValue('');
    inputRef.current?.blur();
  };

  const sendComment = async () => {
    const message = value.trim();
    if (!message || !postId) return;
    try {
      const created = await communityApi.addComment(
        postId,
        message,
        replying?.commentId,
      );
      setComments((prev) => [...prev, created]);
      setValue('');
      setReplying(null);
      setPost((p) => {
        if (!p) return p;
        const commentCount = (p.commentCount ?? 0) + 1;
        onPostChange?.({ id: postId, commentCount });
        return { ...p, commentCount };
      });
    } catch {
      // keep draft
    }
  };

  const toggleLike = async () => {
    if (!postId) return;
    const prevLiked = postLiked;
    const prevCount = likeCount;
    const nextLiked = !prevLiked;
    const nextCount = prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1;
    setPostLiked(nextLiked);
    setLikeCount(nextCount);
    onPostChange?.({ id: postId, isLiked: nextLiked, likeCount: nextCount });
    try {
      const res = await communityApi.toggleLike(postId);
      const liked = res.liked;
      const count = typeof res.likeCount === 'number' ? res.likeCount : nextCount;
      setPostLiked(liked);
      setLikeCount(count);
      onPostChange?.({ id: postId, isLiked: liked, likeCount: count });
    } catch {
      setPostLiked(prevLiked);
      setLikeCount(prevCount);
      onPostChange?.({ id: postId, isLiked: prevLiked, likeCount: prevCount });
    }
  };

  const toggleFollow = async () => {
    if (!post?.author?.userId || !postId) return;
    const was = followed;
    setFollowed(!was);
    onPostChange?.({ id: postId, isFollowingAuthor: !was });
    try {
      if (was) await communityApi.unfollowUser(post.author.userId);
      else await communityApi.followUser(post.author.userId);
    } catch {
      setFollowed(was);
      onPostChange?.({ id: postId, isFollowingAuthor: was });
    }
  };

  const toggleSave = async () => {
    if (!postId) return;
    const was = saved;
    setSaved(!was);
    onPostChange?.({ id: postId, isSaved: !was });
    try {
      if (was) await communityApi.unsavePost(postId);
      else await communityApi.savePost(postId);
    } catch {
      setSaved(was);
      onPostChange?.({ id: postId, isSaved: was });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
        <View style={s.header}>
          <Pressable onPress={onBack} style={s.iconButton} accessibilityLabel="Quay lại">
            <ArrowLeft size={24} color={INK} />
          </Pressable>
          <Text style={s.headerTitle}>Bài đăng</Text>
          <View style={s.iconButton} />
        </View>
        <DetailSkeleton />
      </SafeAreaView>
    );
  }

  if (error || !post) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
        <View style={s.header}>
          <Pressable onPress={onBack} style={s.iconButton}>
            <ArrowLeft size={24} color={INK} />
          </Pressable>
          <Text style={s.headerTitle}>Bài đăng</Text>
          <View style={s.iconButton} />
        </View>
        <View style={s.center}>
          <Text style={s.errorTxt}>{error ?? 'Không có dữ liệu'}</Text>
          <Pressable onPress={onBack} style={{ marginTop: 16 }}>
            <Text style={{ color: MUTED }}>Quay lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const authorName = post.author?.displayName?.trim() || 'Thành viên NOAN';
  const hasMedia = Boolean(post.media?.length || post.imageUrls?.length);
  const captionLong = (post.content?.length ?? 0) > 90;
  const isOwner = Boolean(post.viewerCapabilities?.canEdit || post.viewerCapabilities?.canDelete);
  const actionTarget: ContentActionTarget = {
    kind: 'COMMUNITY_POST',
    id: post.id,
    authorId: post.author?.userId,
    authorName: post.author?.displayName?.trim() || 'quanghy',
    authorAvatarUrl: post.author?.avatarUrl,
    imageUrl: post.media?.[0]?.url || post.imageUrls?.[0],
    shareUrl: post.shareUrl,
    isSaved: saved,
    isFollowingAuthor: followed,
    commentsEnabled: post.commentsEnabled,
    viewerCapabilities: post.viewerCapabilities,
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.header}>
          <Pressable onPress={onBack} style={s.iconButton} accessibilityLabel="Quay lại">
            <ArrowLeft size={24} color={INK} />
          </Pressable>
          <Text style={s.headerTitle}>Bài đăng</Text>
          <Pressable
            style={s.iconButton}
            accessibilityLabel="Thêm"
            onPress={() => setActionOpen(true)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MoreHorizontal size={22} color={INK} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.authorRow}>
            <AvatarImage
              uri={post.author?.avatarUrl}
              size={44}
              seed={post.author?.userId ?? post.author?.displayName ?? authorName}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.authorName}>{authorName}</Text>
              <Text style={s.time}>{formatRelativeTime(post.createdAt)}</Text>
            </View>
            {!isOwner ? (
              <Pressable
                onPress={() => void toggleFollow()}
                style={[s.followBtn, followed && s.followDone]}
              >
                <Text style={s.followTxt}>{followed ? 'Đang theo dõi' : 'Theo dõi'}</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={s.captionWrap}>
            <Text style={s.caption} numberOfLines={captionExpanded ? undefined : 2}>
              {post.content}
            </Text>
            {captionLong ? (
              <Pressable onPress={() => setCaptionExpanded((v) => !v)}>
                <Text style={s.seeMore}>{captionExpanded ? 'Thu gọn' : 'Xem thêm'}</Text>
              </Pressable>
            ) : null}
          </View>

          {hasMedia ? (
            <PostMediaCarousel
              media={post.media}
              imageUrls={post.imageUrls}
              aspectRatio={1}
              borderRadius={18}
              style={s.mediaWrap}
            />
          ) : null}

          {post.dish || post.place ? (
            <View style={s.tagRow}>
              {post.dish ? (
                <View style={s.tagChip}>
                  <UtensilsCrossed size={13} color="#92400E" />
                  <Text style={s.tagChipText} numberOfLines={1}>
                    {post.dish.name}
                  </Text>
                </View>
              ) : null}
              {post.place ? (
                <View style={s.tagChip}>
                  <MapPin size={13} color="#92400E" />
                  <Text style={s.tagChipText} numberOfLines={1}>
                    {post.place.name}
                    {post.place.addressShort ? ` · ${post.place.addressShort}` : ''}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={s.actions}>
            <View style={s.actionsLeft}>
              <Pressable
                onPress={() => void toggleLike()}
                style={[s.action, postLiked && s.actionLiked]}
                accessibilityLabel={postLiked ? 'Bỏ thích' : 'Thích'}
              >
                <Heart
                  size={20}
                  color={postLiked ? RED_LIKE : INK}
                  fill={postLiked ? RED_LIKE : 'transparent'}
                />
                <Text style={[s.actionCount, postLiked && { color: RED_LIKE }]}>
                  {formatCount(likeCount)}
                </Text>
              </Pressable>
              <Pressable
                style={s.action}
                onPress={() => inputRef.current?.focus()}
                accessibilityLabel="Bình luận"
              >
                <MessageCircle size={20} color={INK} />
                <Text style={s.actionCount}>{formatCount(comments.length)}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!post) return;
                  setSharePayload(
                    toShareArticle({
                      id: post.id,
                      content: post.content,
                      title: post.dish?.name ? `Món: ${post.dish.name}` : undefined,
                      coverImageUrl:
                        post.media?.[0]?.url ||
                        post.imageUrls?.[0] ||
                        post.dish?.thumbnailUrl ||
                        post.place?.thumbnailUrl,
                      authorName: post.author?.displayName,
                      shareUrl: post.shareUrl,
                      kind: 'COMMUNITY_POST',
                    }),
                  );
                  setShareSheetOpen(true);
                }}
                style={s.action}
                accessibilityLabel="Chia sẻ"
              >
                <Share2 size={19} color={INK} />
              </Pressable>
            </View>
            {!isOwner ? (
              <Pressable
                onPress={() => void toggleSave()}
                style={[s.action, saved && s.actionSaved]}
                accessibilityLabel={saved ? 'Bỏ lưu' : 'Lưu'}
              >
                <Bookmark size={20} color={INK} fill={saved ? INK : 'transparent'} />
              </Pressable>
            ) : null}
          </View>

          <View style={s.commentsSection}>
            <View style={s.commentsHeader}>
              <Text style={s.commentsTitle}>Bình luận</Text>
              <View style={s.countBadge}>
                <Text style={s.countBadgeText}>{comments.length}</Text>
              </View>
            </View>
            {comments.length === 0 ? (
              <View style={s.emptyBox}>
                <MessageCircle size={28} color={TERTIARY} />
                <Text style={s.emptyTitle}>Chưa có bình luận</Text>
                <Text style={s.emptyComments}>Hãy là người đầu tiên bắt đầu cuộc trò chuyện</Text>
              </View>
            ) : (
              comments.map((c) => {
                const cName = c.author?.displayName?.trim() || 'Thành viên';
                const isReply = Boolean(c.parentCommentId);
                return (
                  <View key={c.id} style={[s.commentRow, isReply && s.commentRowReply]}>
                    <AvatarImage
                      uri={c.author?.avatarUrl}
                      size={isReply ? 28 : 34}
                      seed={c.author?.userId ?? cName}
                    />
                    <View style={{ flex: 1 }}>
                      <View style={s.bubble}>
                        <Text style={s.commentAuthor}>{cName}</Text>
                        <Text style={s.commentBody}>{c.content}</Text>
                      </View>
                      <View style={s.commentMeta}>
                        <Text style={s.commentTime}>{formatRelativeTime(c.createdAt)}</Text>
                        <Pressable onPress={() => beginReply(c)} hitSlop={6}>
                          <Text style={s.replyTxt}>Trả lời</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>

        <View style={s.composer}>
          {post.commentsEnabled === false ? (
            <Text style={[s.emptyComments, { paddingVertical: 12 }]}>
              Bình luận đã bị tắt cho bài viết này
            </Text>
          ) : (
            <>
              {replying ? (
                <View style={s.replyBar}>
                  <Text style={s.replyHint}>Trả lời @{replying.mention}</Text>
                  <Pressable onPress={cancelReply}>
                    <X size={16} color={MUTED} />
                  </Pressable>
                </View>
              ) : null}
              <View style={s.composerRow}>
                <AvatarImage
                  uri={currentUserAvatar}
                  size={36}
                  gender={currentUserGender}
                  seed={currentUserName}
                />
                <Input
                  ref={inputRef}
                  value={value}
                  onChangeText={setValue}
                  placeholder="Thêm bình luận..."
                  className="min-h-10 flex-1 rounded-full px-3.5 border border-border bg-card"
                />
                <Pressable
                  onPress={() => void sendComment()}
                  disabled={!value.trim()}
                  style={[s.sendBtn, !value.trim() && s.sendBtnDisabled]}
                  accessibilityLabel="Gửi"
                >
                  <Send size={18} color={INK} />
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      <ContentActionSheet
        open={actionOpen}
        onOpenChange={setActionOpen}
        target={actionTarget}
        entryPoint="DETAIL"
        onRemoved={() => onBack()}
        onToast={() => undefined}
        onRequestShare={(t) => {
          setSharePayload(
            toShareArticle({
              id: t.id,
              title: t.title,
              coverImageUrl: t.imageUrl,
              authorName: t.authorName,
              shareUrl: t.shareUrl,
              kind: 'COMMUNITY_POST',
            }),
          );
          setShareSheetOpen(true);
        }}
      />

      <ArticleShareSheet
        open={shareSheetOpen}
        onOpenChange={setShareSheetOpen}
        article={sharePayload}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },
  flex: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 17,
    color: INK,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorTxt: { color: INK, fontWeight: '700', textAlign: 'center' },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  authorName: { fontWeight: '700', color: INK, fontSize: 15 },
  time: { color: TERTIARY, fontSize: 12, marginTop: 1 },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: YELLOW,
  },
  followDone: { backgroundColor: WHITE, borderWidth: 1, borderColor: BORDER },
  followTxt: { fontWeight: '700', fontSize: 13, color: INK },
  captionWrap: { paddingHorizontal: 16, marginTop: 14 },
  caption: { fontSize: 16, lineHeight: 24, color: INK },
  seeMore: { marginTop: 4, color: TERTIARY, fontSize: 14 },
  mediaWrap: { marginTop: 14, marginHorizontal: 16 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginTop: 12 },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
    backgroundColor: '#FFF1C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagChipText: { fontSize: 12.5, fontWeight: '600', color: '#78350F', flexShrink: 1 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 14,
  },
  actionsLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    minWidth: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  actionLiked: { backgroundColor: '#FFF0EF', borderColor: '#FFD0CC' },
  actionSaved: { backgroundColor: '#FFF1C7', borderColor: '#F5D77A' },
  actionCount: { fontWeight: '700', color: INK, fontSize: 13.5 },
  commentsSection: {
    marginTop: 18,
    marginHorizontal: 12,
    backgroundColor: WHITE,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    paddingBottom: 14,
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  commentsTitle: { fontWeight: '800', fontSize: 16, color: INK },
  countBadge: {
    minWidth: 24,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: { fontSize: 12, fontWeight: '800', color: INK },
  emptyBox: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16, gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: INK },
  emptyComments: {
    marginHorizontal: 16,
    color: MUTED,
    fontSize: 13.5,
    textAlign: 'center',
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 14,
    marginTop: 14,
  },
  commentRowReply: { marginLeft: 58 },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: '#F7F3EA',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentBody: { fontSize: 14, lineHeight: 20, color: INK, marginTop: 1 },
  commentAuthor: { fontWeight: '700', fontSize: 13, color: INK },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 5,
    marginLeft: 12,
  },
  commentTime: { fontSize: 12, color: TERTIARY },
  replyTxt: { fontSize: 12, fontWeight: '700', color: MUTED },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 8 : 12,
    backgroundColor: CREAM,
  },
  replyBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  replyHint: { color: MUTED, fontSize: 12 },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#F1EBDD' },
});

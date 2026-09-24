import React, { useState, useRef } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Check,
  Heart,
  MoreHorizontal,
  Send,
  User,
  X,
} from 'lucide-react-native';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import { Separator } from '../../components/ui/separator';
import { Text } from '../../components/ui/text';

const C = {
  bg: '#FFFDF7',
  surface: '#FFFFFF',
  ink: '#161616',
  muted: '#737373',
  border: '#F0EBE0',
  inputBorder: '#E8E0D2',
  yellowPrimary: '#FCD34D',
  goldBadge: '#F59E0B',
  goldAccent: '#CA8A04',
};

export function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: C.goldBadge,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
      }}
    >
      <Check size={size * 0.65} color="#FFFFFF" strokeWidth={3.5} />
    </View>
  );
}

export interface CommentItemData {
  id: string;
  author: {
    userId?: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  content: string;
  createdAt: string;
  timeAgo?: string;
  likeCount: number;
  isLiked?: boolean;
  isAuthor?: boolean;
  replies?: CommentItemData[];
  parentCommentId?: string | null;
}

export interface ArticleCommentsModalProps {
  open: boolean;
  onClose: () => void;
  article: {
    id: string;
    title: string;
    coverImageUrl?: string | null;
    commentCount?: number;
    slug?: string;
  };
  comments: CommentItemData[];
  onAddComment: (content: string, parentCommentId?: string) => Promise<void>;
  onToggleCommentLike?: (commentId: string) => void;
  currentUserAvatar?: string | null;
}

export function ArticleCommentsModal({
  open,
  onClose,
  article,
  comments,
  onAddComment,
  onToggleCommentLike,
  currentUserAvatar,
}: ArticleCommentsModalProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const inputRef = useRef<TextInput>(null);

  if (!open) return null;

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    try {
      await onAddComment(text, replyingTo?.id);
      setDraft('');
      setReplyingTo(null);
    } catch {
      // keep draft on error
    }
  };

  const handleStartReply = (commentId: string, authorName: string) => {
    setReplyingTo({ id: commentId, name: authorName });
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const toggleExpand = (id: string) => {
    setExpandedReplies((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Organize top-level comments and nested replies
  const topLevel = comments.filter((c) => !c.parentCommentId);
  const repliesByParent = comments.reduce<Record<string, CommentItemData[]>>((acc, c) => {
    if (c.parentCommentId) {
      if (!acc[c.parentCommentId]) acc[c.parentCommentId] = [];
      acc[c.parentCommentId].push(c);
    }
    return acc;
  }, {});

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
        {/* Top Header matching Image 2 */}
        <View style={s.header}>
          <Pressable
            onPress={onClose}
            style={s.backBtn}
            hitSlop={10}
            accessibilityLabel="Quay lại"
          >
            <ArrowLeft size={24} color={C.ink} />
          </Pressable>
          <Text style={s.headerTitle}>Bình luận</Text>
          <View style={s.headerRightSpacer} />
        </View>

        <Separator className="bg-[#F0EBE0]" />

        {/* Article Context Mini Banner matching Image 2 */}
        <View style={s.articleBanner}>
          {article.coverImageUrl ? (
            <Image
              source={{ uri: article.coverImageUrl }}
              style={s.articleBannerImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[s.articleBannerImage, { backgroundColor: '#E5DDCB' }]} />
          )}
          <View style={s.articleBannerInfo}>
            <Text style={s.articleBannerTitle} numberOfLines={2}>
              {article.title}
            </Text>
            <Text style={s.articleBannerCount}>
              {article.commentCount ?? comments.length} bình luận
            </Text>
          </View>
        </View>

        <Separator className="bg-[#F0EBE0]" />

        {/* Comments Scroll Thread */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {topLevel.length === 0 ? (
              <View style={s.emptyCommentsWrap}>
                <Text style={s.emptyCommentsTitle}>Chưa có bình luận nào</Text>
                <Text style={s.emptyCommentsSub}>
                  Hãy là người đầu tiên chia sẻ cảm nghĩ về bài viết này nhé!
                </Text>
              </View>
            ) : (
              topLevel.map((comment) => {
              const replies = [
                ...(comment.replies || []),
                ...(repliesByParent[comment.id] || []),
              ];
              // De-duplicate replies
              const uniqueReplies = Array.from(
                new Map(replies.map((r) => [r.id, r])).values()
              );
              const displayedReplies = expandedReplies[comment.id]
                ? uniqueReplies
                : uniqueReplies.slice(0, 1);
              const authorName = comment.author?.displayName || 'Ẩn danh';
              const timeDisplay = comment.timeAgo || comment.createdAt;

              return (
                <View key={comment.id} style={s.commentGroup}>
                  {/* Parent Comment Row */}
                  <View style={s.commentRow}>
                    <Avatar className="size-9 shrink-0">
                      {comment.author?.avatarUrl ? (
                        <AvatarImage source={{ uri: comment.author.avatarUrl }} />
                      ) : null}
                      <AvatarFallback className="bg-[#FFF0C6]">
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#765400' }}>
                          {authorName.slice(0, 2).toUpperCase()}
                        </Text>
                      </AvatarFallback>
                    </Avatar>

                    <View style={s.commentBodyWrap}>
                      <View style={s.commentHeaderRow}>
                        <Text style={s.authorName}>
                          {authorName}
                          {timeDisplay ? (
                            <Text style={s.commentTime}> · {timeDisplay}</Text>
                          ) : null}
                        </Text>
                        <Pressable style={s.moreBtn} hitSlop={10}>
                          <MoreHorizontal size={16} color="#8E8E8E" />
                        </Pressable>
                      </View>
                      <Text style={s.commentContent}>{comment.content}</Text>
                      <View style={s.commentActionRow}>
                        <Pressable
                          onPress={() => onToggleCommentLike?.(comment.id)}
                          style={s.likeAction}
                          hitSlop={8}
                        >
                          <Heart
                            size={14}
                            color={comment.isLiked ? '#EF4444' : '#737373'}
                            fill={comment.isLiked ? '#EF4444' : 'none'}
                          />
                          <Text style={s.likeCountText}>{comment.likeCount}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleStartReply(comment.id, authorName)}
                          hitSlop={8}
                        >
                          <Text style={s.replyText}>Trả lời</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  {/* Replies (Nested Thread with Indentation & Line) */}
                  {uniqueReplies.length > 0 && (
                    <View style={s.repliesContainer}>
                      {displayedReplies.map((reply) => {
                        const replyAuthor = reply.author?.displayName || 'Mogu review';
                        const isMogu =
                          reply.isAuthor ||
                          replyAuthor.toLowerCase().includes('mogu') ||
                          replyAuthor.toLowerCase().includes('mogo');
                        const replyTime = reply.timeAgo || reply.createdAt;

                        return (
                          <View key={reply.id} style={s.replyRow}>
                            {isMogu ? (
                              <View style={s.moguAvatarWrap}>
                                <Text style={s.moguAvatarText}>M</Text>
                              </View>
                            ) : (
                              <Avatar className="size-7 shrink-0">
                                {reply.author?.avatarUrl ? (
                                  <AvatarImage source={{ uri: reply.author.avatarUrl }} />
                                ) : null}
                                <AvatarFallback className="bg-[#FFF0C6]">
                                  <User size={14} color="#765400" />
                                </AvatarFallback>
                              </Avatar>
                            )}

                            <View style={s.commentBodyWrap}>
                              <View style={s.commentHeaderRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  <Text style={s.authorName}>{replyAuthor}</Text>
                                  {isMogu && <VerifiedBadge size={14} />}
                                  {replyTime ? (
                                    <Text style={s.commentTime}> · {replyTime}</Text>
                                  ) : null}
                                </View>
                                <Pressable style={s.moreBtn} hitSlop={10}>
                                  <MoreHorizontal size={16} color="#8E8E8E" />
                                </Pressable>
                              </View>
                              <Text style={s.commentContent}>{reply.content}</Text>
                              <View style={s.commentActionRow}>
                                <Pressable
                                  onPress={() => onToggleCommentLike?.(reply.id)}
                                  style={s.likeAction}
                                  hitSlop={8}
                                >
                                  <Heart
                                    size={14}
                                    color={reply.isLiked ? '#EF4444' : '#737373'}
                                    fill={reply.isLiked ? '#EF4444' : 'none'}
                                  />
                                  <Text style={s.likeCountText}>{reply.likeCount}</Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => handleStartReply(comment.id, replyAuthor)}
                                  hitSlop={8}
                                >
                                  <Text style={s.replyText}>Trả lời</Text>
                                </Pressable>
                              </View>
                            </View>
                          </View>
                        );
                      })}

                      {/* "Xem thêm câu trả lời" */}
                      {uniqueReplies.length > 1 && !expandedReplies[comment.id] && (
                        <Pressable
                          onPress={() => toggleExpand(comment.id)}
                          style={s.viewMoreRepliesRow}
                        >
                          <Text style={s.viewMoreRepliesText}>
                            Xem thêm {uniqueReplies.length - 1} câu trả lời
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            })
            )}
          </ScrollView>

          {/* Replying Banner matching Image 2 */}
          {replyingTo && (
            <View style={s.replyingBanner}>
              <Text style={s.replyingText}>
                Đang trả lời <Text style={s.replyingTarget}>@{replyingTo.name}</Text>
              </Text>
              <Pressable
                onPress={() => setReplyingTo(null)}
                style={s.cancelReplyBtn}
                hitSlop={8}
              >
                <X size={16} color={C.ink} />
              </Pressable>
            </View>
          )}

          {/* Bottom Floating Composer matching Image 2 */}
          <View
            style={[
              s.composerWrap,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <View style={s.composerRow}>
              {/* User Avatar from shadcn/react-native-reusables (never distorted) */}
              <Avatar className="size-10 shrink-0">
                {currentUserAvatar ? (
                  <AvatarImage source={{ uri: currentUserAvatar }} />
                ) : null}
                <AvatarFallback className="bg-[#FEF08A]">
                  <User size={18} color="#78350F" />
                </AvatarFallback>
              </Avatar>

              <TextInput
                ref={inputRef}
                value={draft}
                onChangeText={setDraft}
                placeholder={
                  replyingTo ? 'Viết câu trả lời...' : 'Thêm bình luận...'
                }
                placeholderTextColor="#A3A3A3"
                style={s.input}
                returnKeyType="send"
                onSubmitEditing={handleSend}
              />

              <Pressable
                onPress={handleSend}
                disabled={!draft.trim()}
                style={[
                  s.sendBtn,
                  !draft.trim() && { opacity: 0.6 },
                ]}
                accessibilityLabel="Gửi bình luận"
              >
                <Send size={18} color={C.ink} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    backgroundColor: C.bg,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.3,
  },
  headerRightSpacer: {
    width: 40,
  },
  articleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.bg,
    gap: 12,
  },
  articleBannerImage: {
    width: 50,
    height: 50,
    borderRadius: 12,
  },
  articleBannerInfo: {
    flex: 1,
  },
  articleBannerTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: C.ink,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  articleBannerCount: {
    fontSize: 12.5,
    color: C.muted,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  commentGroup: {
    marginBottom: 20,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 12,
  },
  commentBodyWrap: {
    flex: 1,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
    color: C.ink,
  },
  commentTime: {
    fontSize: 12,
    fontWeight: '400',
    color: C.muted,
  },
  moreBtn: {
    padding: 4,
  },
  commentContent: {
    fontSize: 14,
    lineHeight: 20,
    color: C.ink,
    marginTop: 4,
  },
  commentActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 6,
  },
  likeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  likeCountText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: C.muted,
  },
  replyText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.ink,
  },
  repliesContainer: {
    marginLeft: 22,
    marginTop: 10,
    paddingLeft: 14,
    borderLeftWidth: 2,
    borderLeftColor: '#F0EBE0',
  },
  replyRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  moguAvatarWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.yellowPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moguAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: C.ink,
  },
  viewMoreRepliesRow: {
    marginTop: 2,
    marginBottom: 4,
  },
  viewMoreRepliesText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.goldAccent,
  },
  replyingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FAF5EA',
    borderTopWidth: 1,
    borderColor: C.border,
  },
  replyingText: {
    fontSize: 12.5,
    color: C.muted,
  },
  replyingTarget: {
    fontWeight: '700',
    color: C.goldAccent,
  },
  cancelReplyBtn: {
    padding: 4,
  },
  emptyCommentsWrap: {
    paddingHorizontal: 24,
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyCommentsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.ink,
  },
  emptyCommentsSub: {
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
  },
  composerWrap: {
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.inputBorder,
    paddingHorizontal: 16,
    fontSize: 14,
    color: C.ink,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.yellowPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

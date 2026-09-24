import React, { useState, useEffect, useRef } from 'react';
import {
  Pressable,
  Share,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import Svg, { Path } from 'react-native-svg';
import {
  Check,
  ChevronRight,
  Link2,
  MessageCircle,
  MoreHorizontal,
  SquarePen,
  Users,
} from 'lucide-react-native';

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '../../components/ui/drawer';
import { Button } from '../../components/ui/button';
import { Separator } from '../../components/ui/separator';
import { Text } from '../../components/ui/text';
import { AppImage } from '../../components/ui/app-image';

const C = {
  sheetBg: '#FAF8F5',
  cardBg: '#FAF5EA',
  cardBorder: '#EDE4D1',
  ink: '#161616',
  muted: '#737373',
  yellowCircle: '#FCD34D',
  yellowBadge: '#FACC15',
  msgCircle: '#FFFBEB',
  msgBorder: '#FDE68A',
  fbCircle: '#EFF6FF',
  fbBorder: '#BFDBFE',
  otherCircle: '#F5F5F4',
  otherBorder: '#E7E5E4',
  cancelBg: '#F2ECE0',
};

function FacebookIcon({ size = 24, color = '#1877F2' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </Svg>
  );
}

/** Payload dùng chung cho mọi nút Share trong Khám phá (bài viết / bài đăng) */
export type ExploreShareArticle = {
  id?: string;
  title: string;
  coverImageUrl?: string | null;
  authorName?: string | null;
  slug?: string;
  shareUrl?: string;
  kind?: 'ARTICLE' | 'COMMUNITY_POST' | 'DISH';
};

export interface ArticleShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  article: ExploreShareArticle | null;
  onShareToPost?: () => void;
  onShareToFriends?: () => void;
}

export type ExploreShareSheetProps = ArticleShareSheetProps;

export function toShareArticle(input: {
  id?: string;
  title?: string | null;
  coverImageUrl?: string | null;
  imageUrl?: string | null;
  authorName?: string | null;
  author?: { displayName?: string | null } | null;
  slug?: string | null;
  shareUrl?: string | null;
  kind?: 'ARTICLE' | 'COMMUNITY_POST' | 'DISH';
  content?: string | null;
}): ExploreShareArticle {
  const titleFromContent =
    input.content?.trim().replace(/\s+/g, ' ').slice(0, 90) || null;
  return {
    id: input.id,
    title: input.title || titleFromContent || 'Bài viết Mogu',
    coverImageUrl: input.coverImageUrl ?? input.imageUrl ?? null,
    authorName: input.authorName ?? input.author?.displayName ?? 'Mogu review',
    slug: input.slug ?? undefined,
    shareUrl: input.shareUrl ?? undefined,
    kind: input.kind ?? 'ARTICLE',
  };
}

function resolveShareUrl(article: ExploreShareArticle) {
  if (article.shareUrl) return article.shareUrl;
  const id = article.slug || article.id || '';
  if (article.kind === 'COMMUNITY_POST') return `https://mogu.vn/explore/posts/${id}`;
  if (article.kind === 'DISH') return `https://mogu.vn/dishes/${id}`;
  return `https://mogu.vn/explore/articles/${id}`;
}

export function ArticleShareSheet({
  open,
  onOpenChange,
  article,
  onShareToPost,
  onShareToFriends,
}: ArticleShareSheetProps) {
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setShowCopiedToast(false);
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    }
  }, [open]);

  if (!article) return null;

  const shareUrl = resolveShareUrl(article);

  const triggerToast = () => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setShowCopiedToast(true);
    toastTimeout.current = setTimeout(() => {
      setShowCopiedToast(false);
    }, 2500);
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(shareUrl);
    triggerToast();
  };

  const handleMessageShare = async () => {
    await Share.share({
      message: `${article.title}\n${shareUrl}`,
    }).catch(() => undefined);
  };

  const handleFacebookShare = async () => {
    await Share.share({
      message: `${article.title}\n${shareUrl}`,
      url: shareUrl,
    }).catch(() => undefined);
  };

  const handleMoreShare = async () => {
    await Share.share({
      message: `${article.title}\n${shareUrl}`,
      url: shareUrl,
    }).catch(() => undefined);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      snapHeight={500}
      sheetBackgroundColor={C.sheetBg}
    >
      <DrawerHeader className="pb-2 pt-1 items-center justify-center">
        <DrawerTitle className="text-[18px] font-bold text-[#161616] text-center">
          Chia sẻ bài viết
        </DrawerTitle>
      </DrawerHeader>

      <DrawerContent className="px-5">
        {/* Floating Copied Toast */}
        {showCopiedToast && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={s.toastContainer}
            pointerEvents="none"
          >
            <View style={s.toastBadge}>
              <View style={s.toastIconCircle}>
                <Check size={11} color="#161616" strokeWidth={3.5} />
              </View>
              <Text style={s.toastText}>Đã sao chép liên kết</Text>
            </View>
          </Animated.View>
        )}

        {/* Article Preview Mini Card — luôn hiện thumbnail (AppImage + fallback) */}
        <View style={s.previewCard}>
          <AppImage
            uri={article.coverImageUrl}
            style={s.previewImage}
            contentFit="cover"
            borderRadius={12}
            showLoader={false}
            accessibilityLabel="Ảnh xem trước"
          />
          <View style={s.previewInfo}>
            <RNText style={s.previewTitle} numberOfLines={2}>
              {article.title}
            </RNText>
            <RNText style={s.previewAuthor}>
              {article.authorName || 'Mogo review'}
            </RNText>
          </View>
        </View>

        {/* Primary 4 Quick Share Channels */}
        <View style={s.channelsRow}>
          {/* 1. Sao chép liên kết */}
          <Pressable
            style={s.channelItem}
            onPress={handleCopyLink}
            accessibilityLabel="Sao chép liên kết"
          >
            <View style={[s.channelCircle, { backgroundColor: C.yellowCircle }]}>
              <Link2 size={24} color={C.ink} strokeWidth={2.2} />
            </View>
            <Text style={s.channelLabel}>Sao chép{'\n'}liên kết</Text>
          </Pressable>

          {/* 2. Tin nhắn */}
          <Pressable
            style={s.channelItem}
            onPress={handleMessageShare}
            accessibilityLabel="Chia sẻ qua tin nhắn"
          >
            <View
              style={[
                s.channelCircle,
                { backgroundColor: C.msgCircle, borderColor: C.msgBorder, borderWidth: 1 },
              ]}
            >
              <MessageCircle size={24} color={C.ink} strokeWidth={2} />
            </View>
            <Text style={s.channelLabel}>Tin nhắn</Text>
          </Pressable>

          {/* 3. Facebook */}
          <Pressable
            style={s.channelItem}
            onPress={handleFacebookShare}
            accessibilityLabel="Chia sẻ qua Facebook"
          >
            <View
              style={[
                s.channelCircle,
                { backgroundColor: C.fbCircle, borderColor: C.fbBorder, borderWidth: 1 },
              ]}
            >
              <FacebookIcon size={24} />
            </View>
            <Text style={s.channelLabel}>Facebook</Text>
          </Pressable>

          {/* 4. Khác */}
          <Pressable
            style={s.channelItem}
            onPress={handleMoreShare}
            accessibilityLabel="Chia sẻ khác"
          >
            <View
              style={[
                s.channelCircle,
                { backgroundColor: C.otherCircle, borderColor: C.otherBorder, borderWidth: 1 },
              ]}
            >
              <MoreHorizontal size={24} color={C.ink} strokeWidth={2} />
            </View>
            <Text style={s.channelLabel}>Khác</Text>
          </Pressable>
        </View>

        {/* Secondary Share Options List */}
        <View style={s.optionsList}>
          <Pressable
            style={s.optionRow}
            onPress={() => {
              onOpenChange(false);
              onShareToPost?.();
            }}
          >
            <SquarePen size={20} color={C.ink} strokeWidth={2} />
            <Text style={s.optionText}>Chia sẻ lên bài viết của bạn</Text>
            <ChevronRight size={18} color="#9CA3AF" />
          </Pressable>

          <Separator className="bg-[#F0EBE0]" />

          <Pressable
            style={s.optionRow}
            onPress={() => {
              onOpenChange(false);
              onShareToFriends?.();
            }}
          >
            <Users size={20} color={C.ink} strokeWidth={2} />
            <Text style={s.optionText}>Gửi cho bạn bè trong Mogu</Text>
            <ChevronRight size={18} color="#9CA3AF" />
          </Pressable>
        </View>

        {/* Cancel Button using shadcn Button */}
        <Button
          variant="secondary"
          className="w-full h-12 rounded-2xl bg-[#F2ECE0] active:bg-[#E8E1D3]"
          onPress={() => onOpenChange(false)}
          accessibilityLabel="Hủy"
        >
          <Text className="text-[15px] font-semibold text-[#161616]">Hủy</Text>
        </Button>
      </DrawerContent>
    </Drawer>
  );
}

const s = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: -40,
    alignSelf: 'center',
    zIndex: 999,
  },
  toastBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#20252C',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  toastIconCircle: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: C.yellowBadge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: C.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 10,
    marginBottom: 18,
  },
  previewImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    flexShrink: 0,
    backgroundColor: '#FFF2C9',
  },
  previewInfo: {
    flex: 1,
    flexShrink: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.ink,
    lineHeight: 19,
    letterSpacing: -0.2,
  },
  previewAuthor: {
    fontSize: 12.5,
    color: C.muted,
    marginTop: 2,
  },
  channelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  channelItem: {
    alignItems: 'center',
    width: 68,
  },
  channelCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  channelLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: C.ink,
    textAlign: 'center',
    lineHeight: 15,
  },
  optionsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0EBE0',
    overflow: 'hidden',
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  optionText: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '500',
    color: C.ink,
  },
});

/** Alias dùng chung trong Explore feed / topic / detail */
export { ArticleShareSheet as ExploreShareSheet };

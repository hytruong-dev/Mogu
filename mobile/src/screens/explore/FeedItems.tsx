import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  BookOpen,
  Bookmark,
  Clock3,
  Flame,
  Globe,
  Heart,
  ImagePlus,
  Lock,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Send,
  Users,
  UtensilsCrossed,
  Wallet,
} from '@/components/icons';
import { AppImage } from '../../components/ui/app-image';
import { AvatarImage } from '../../components/organisms/AvatarImage';
import type { ExploreArticle, ExplorePost, ExploreTopic } from '../../services/api/explore';
import type { Dish } from '../../services/api/dishes';
import {
  BORDER,
  CARD_PAD,
  CARD_RADIUS,
  HONEY,
  INK,
  MEDIA_RADIUS,
  MUTED,
  POST_GAP,
  RED_LIKE,
  STORY_RING,
  TERTIARY,
  WHITE,
  YELLOW,
  YELLOW_SOFT,
} from './tokens';
import { formatCount, formatPriceK, formatRelativeTime, resolveDishImageUrl } from './utils';
import { PostMediaCarousel } from './PostMediaCarousel';

const pho = require('../../assets/images/random/pho-result.jpg');
const bun = require('../../assets/images/random/bun-rieu.jpg');
const rice = require('../../assets/images/random/chao-ga.jpg');
const TOPIC_FALLBACKS = [pho, rice, bun, pho];

const DOUBLE_TAP_MS = 260;

function tapHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/* -------------------------------------------------------------------------- */
/*                               Shared pieces                                */
/* -------------------------------------------------------------------------- */

/** Single-tap → onSingle (delayed), double-tap → onDouble (Instagram behaviour). */
function useDoubleTap(onSingle?: () => void, onDouble?: () => void) {
  const lastTap = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      onDouble?.();
      return;
    }
    lastTap.current = now;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      onSingle?.();
    }, DOUBLE_TAP_MS);
  }, [onSingle, onDouble]);
}

/** Big heart that pops over media on double-tap. */
function HeartBurst({ trigger }: { trigger: number }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!trigger) return;
    opacity.value = withSequence(withTiming(1, { duration: 90 }), withDelay(420, withTiming(0, { duration: 220 })));
    scale.value = withSequence(
      withTiming(0.4, { duration: 0 }),
      withSpring(1.15, { damping: 7, stiffness: 260 }),
      withTiming(1, { duration: 120 }),
    );
  }, [trigger, opacity, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View pointerEvents="none" style={styles.burstWrap}>
      <Animated.View style={[styles.burstShadow, style]}>
        <Heart size={96} color={WHITE} fill={WHITE} strokeWidth={1.2} />
      </Animated.View>
    </View>
  );
}

/** Animated icon button with a spring "pop" on press. */
function PopButton({
  onPress,
  children,
  label,
  count,
  countColor = INK,
  active,
}: {
  onPress?: () => void;
  children: ReactNode;
  label: string;
  count?: number;
  countColor?: string;
  active?: boolean;
}) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={() => {
        scale.value = withSequence(
          withTiming(0.78, { duration: 70 }),
          withSpring(1, { damping: 6, stiffness: 320 }),
        );
        tapHaptic();
        onPress?.();
      }}
      style={styles.actionBtn}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active != null ? { selected: active } : undefined}
      hitSlop={6}
    >
      <Animated.View style={style}>{children}</Animated.View>
      {typeof count === 'number' && count > 0 ? (
        <Text style={[styles.actionCount, { color: countColor }]}>{formatCount(count)}</Text>
      ) : null}
    </Pressable>
  );
}

function MoreButton({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.moreBtn}
      accessibilityRole="button"
      accessibilityLabel="Thêm tuỳ chọn"
      hitSlop={10}
    >
      <MoreHorizontal size={20} color={MUTED} />
    </Pressable>
  );
}

function VisibilityIcon({ visibility }: { visibility?: ExplorePost['visibility'] }) {
  if (visibility === 'PRIVATE') return <Lock size={11} color={TERTIARY} />;
  if (visibility === 'FOLLOWERS') return <Users size={11} color={TERTIARY} />;
  return <Globe size={11} color={TERTIARY} />;
}

function AuthorHeader({
  name,
  avatarUrl,
  seed,
  time,
  visibility,
  onPress,
  right,
  subtitle,
}: {
  name: string;
  avatarUrl?: string | null;
  seed?: string | null;
  time?: string;
  visibility?: ExplorePost['visibility'];
  onPress?: () => void;
  right?: ReactNode;
  subtitle?: string;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onPress}
        style={styles.headerAuthor}
        accessibilityRole="button"
        accessibilityLabel={`Trang cá nhân ${name}`}
      >
        <View style={styles.headerAvatarRing}>
          <AvatarImage uri={avatarUrl} size={38} seed={seed ?? name} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.authorName} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.headerMetaRow}>
            {subtitle ? (
              <Text style={styles.authorTime} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
            {subtitle && time ? <Text style={styles.authorTime}> · </Text> : null}
            {time ? <Text style={styles.authorTime}>{time}</Text> : null}
            {visibility !== undefined || !subtitle ? (
              <>
                <Text style={styles.authorTime}> · </Text>
                <VisibilityIcon visibility={visibility} />
              </>
            ) : null}
          </View>
        </View>
      </Pressable>
      {right}
    </View>
  );
}

/** Caption with tappable "xem thêm" and highlighted hashtags. */
function Caption({ author, text }: { author?: string; text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 140 || text.split('\n').length > 3;
  const parts = text.split(/(#[^\s#]+)/g);

  return (
    <Pressable onPress={() => long && setExpanded((v) => !v)} disabled={!long}>
      <Text style={styles.caption} numberOfLines={expanded || !long ? undefined : 3}>
        {author ? <Text style={styles.captionAuthor}>{author} </Text> : null}
        {parts.map((p, i) =>
          p.startsWith('#') ? (
            <Text key={i} style={styles.hashtag}>
              {p}
            </Text>
          ) : (
            p
          ),
        )}
      </Text>
      {long && !expanded ? <Text style={styles.seeMore}>Xem thêm</Text> : null}
    </Pressable>
  );
}

function MetaPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <View style={styles.metaPill}>
      {icon}
      <Text style={styles.metaPillTxt} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                         Stories row + composer card                        */
/* -------------------------------------------------------------------------- */

function StoryRing({ children, active = true }: { children: ReactNode; active?: boolean }) {
  if (!active) return <View style={[styles.storyRing, styles.storyRingIdle]}>{children}</View>;
  return (
    <LinearGradient
      colors={STORY_RING}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={styles.storyRing}
    >
      <View style={styles.storyInner}>{children}</View>
    </LinearGradient>
  );
}

export function StoriesRow({
  topics,
  onPress,
  onCreate,
  myAvatarUrl,
  myName,
  loading,
}: {
  topics: ExploreTopic[];
  onPress?: (topic: ExploreTopic) => void;
  onCreate?: () => void;
  myAvatarUrl?: string | null;
  myName?: string;
  loading?: boolean;
}) {
  const list = (topics ?? []).slice(0, 12);
  const showSkeleton = loading || list.length === 0;

  if (showSkeleton) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storyRow}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={styles.storyItem}>
            <StoryRing active={true}>
              <View style={[styles.storyImg, { backgroundColor: '#EDE4D0' }]} />
            </StoryRing>
            <View style={{ width: 56, height: 11, borderRadius: 5, backgroundColor: '#EDE4D0', marginTop: 3 }} />
          </View>
        ))}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.storyRow}
    >
      {onCreate ? (
        <Pressable
          onPress={onCreate}
          style={styles.storyItem}
          accessibilityRole="button"
          accessibilityLabel="Tạo bài đăng mới"
        >
          <StoryRing active={false}>
            <AvatarImage uri={myAvatarUrl} size={64} seed={myName ?? 'me'} isCurrentUser />
          </StoryRing>
          <View style={styles.storyPlus}>
            <Plus size={14} color={INK} strokeWidth={3} />
          </View>
          <Text style={styles.storyLabel} numberOfLines={1}>
            Chia sẻ món
          </Text>
        </Pressable>
      ) : null}

      {list.map((topic, i) => (
        <Pressable
          key={topic.id}
          onPress={() => onPress?.(topic)}
          style={styles.storyItem}
          accessibilityRole="button"
          accessibilityLabel={topic.title}
        >
          <StoryRing>
            <AppImage
              uri={topic.coverImageUrl}
              fallbackSource={TOPIC_FALLBACKS[i % TOPIC_FALLBACKS.length]}
              style={styles.storyImg}
              contentFit="cover"
              showLoader={false}
            />
          </StoryRing>
          <Text style={styles.storyLabel} numberOfLines={1}>
            {topic.title.replace(/\n/g, ' ')}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** @deprecated kept for backwards compatibility with other screens. */
export function TopicCircles({
  topics,
  onPress,
}: {
  topics: ExploreTopic[];
  onPress?: (topic: ExploreTopic) => void;
}) {
  if (!topics?.length) return null;
  return <StoriesRow topics={topics} onPress={onPress} />;
}

export function ComposerCard({
  avatarUrl,
  name,
  onPress,
}: {
  avatarUrl?: string | null;
  name?: string;
  onPress?: () => void;
}) {
  return (
    <View style={[styles.card, styles.composer]}>
      <AvatarImage uri={avatarUrl} size={40} seed={name ?? 'me'} isCurrentUser />
      <Pressable
        onPress={onPress}
        style={styles.composerInput}
        accessibilityRole="button"
        accessibilityLabel="Tạo bài đăng"
      >
        <Text style={styles.composerPlaceholder} numberOfLines={1}>
          Hôm nay bạn ăn gì ngon?
        </Text>
      </Pressable>
      <Pressable
        onPress={onPress}
        style={styles.composerIcon}
        accessibilityRole="button"
        accessibilityLabel="Đăng ảnh món ăn"
        hitSlop={6}
      >
        <ImagePlus size={22} color={HONEY} />
      </Pressable>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Dish card                                 */
/* -------------------------------------------------------------------------- */

export const DishFeedItem = memo(function DishFeedItem({
  dish,
  onPress,
  onSave,
  saved,
  onMore,
}: {
  dish: Dish;
  onPress: () => void;
  onSave?: () => void;
  saved?: boolean;
  onMore?: () => void;
}) {
  const uri = resolveDishImageUrl(dish);
  const total = (dish.prepMinutes ?? 0) + (dish.cookMinutes ?? 0);
  const price = formatPriceK(dish.priceMin, dish.priceMax);
  const kcalRaw = dish.calories ?? dish.nutritionProfiles?.[0]?.calories;
  const kcal = kcalRaw ? Math.round(Number(kcalRaw)) : null;
  const [burst, setBurst] = useState(0);

  const handleTap = useDoubleTap(onPress, () => {
    setBurst((b) => b + 1);
    tapHaptic();
    if (!saved) onSave?.();
  });

  return (
    <View style={[styles.card, styles.dishCard]}>
      <Pressable onPress={handleTap} accessibilityRole="button" accessibilityLabel={dish.name}>
        <View style={styles.dishMediaWrap}>
          <AppImage
            uri={uri}
            fallbackSource={pho}
            style={styles.dishMedia}
            contentFit="cover"
            recyclingKey={`dish-${dish.id}`}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.72)']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <View style={styles.dishBadge}>
            <UtensilsCrossed size={12} color={INK} strokeWidth={2.4} />
            <Text style={styles.dishBadgeTxt}>Món ăn gợi ý</Text>
          </View>

          <Pressable
            onPress={() => {
              tapHaptic();
              onSave?.();
            }}
            style={[styles.floatingSave, saved && styles.floatingSaveActive]}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Bỏ lưu món' : 'Lưu món'}
            hitSlop={8}
          >
            <Bookmark size={18} color={saved ? INK : WHITE} fill={saved ? INK : 'transparent'} />
          </Pressable>

          <View style={styles.dishOverlayText} pointerEvents="none">
            <Text style={styles.dishTitle} numberOfLines={2}>
              {dish.name}
            </Text>
            {dish.description ? (
              <Text style={styles.dishDesc} numberOfLines={1}>
                {dish.description}
              </Text>
            ) : null}
          </View>

          <HeartBurst trigger={burst} />
        </View>
      </Pressable>

      <View style={styles.dishFooter}>
        <View style={styles.metaRow}>
          {total > 0 ? <MetaPill icon={<Clock3 size={13} color={HONEY} />} label={`${total} phút`} /> : null}
          {kcal ? <MetaPill icon={<Flame size={13} color="#FF7A45" />} label={`${kcal} kcal`} /> : null}
          {price ? <MetaPill icon={<Wallet size={13} color="#2FA36B" />} label={price} /> : null}
        </View>
        <MoreButton onPress={onMore} />
      </View>
    </View>
  );
});

/* -------------------------------------------------------------------------- */
/*                                Article card                                */
/* -------------------------------------------------------------------------- */

export const ArticleFeedItem = memo(function ArticleFeedItem({
  article,
  onPress,
  onLike,
  onSave,
  onShare,
  saved,
  liked,
  onMore,
  onAuthorPress,
}: {
  article: ExploreArticle;
  onPress: () => void;
  onLike?: () => void;
  onSave?: () => void;
  onShare?: () => void;
  saved?: boolean;
  liked?: boolean;
  onMore?: () => void;
  onAuthorPress?: () => void;
}) {
  const authorName = article.author?.displayName || 'NOAN';
  const isLiked = liked ?? Boolean(article.isLiked);
  const likeCount = article.likeCount ?? 0;
  const commentCount = article.commentCount ?? 0;
  const [burst, setBurst] = useState(0);

  const handleTap = useDoubleTap(onPress, () => {
    setBurst((b) => b + 1);
    tapHaptic();
    if (!isLiked) onLike?.();
  });

  return (
    <View style={styles.card}>
      <AuthorHeader
        name={authorName}
        avatarUrl={article.author?.avatarUrl}
        seed={article.author?.userId ?? authorName}
        subtitle={article.topic?.title ?? 'Bài viết'}
        time={formatRelativeTime(article.createdAt)}
        onPress={onAuthorPress}
        right={<MoreButton onPress={onMore} />}
      />

      <Pressable onPress={handleTap} accessibilityRole="button" accessibilityLabel={article.title}>
        <View style={styles.articleMediaWrap}>
          <AppImage
            uri={article.coverImageUrl}
            fallbackSource={rice}
            style={styles.articleMedia}
            contentFit="cover"
            recyclingKey={`article-${article.id}`}
          />
          <View style={styles.readBadge}>
            <BookOpen size={12} color={WHITE} />
            <Text style={styles.readBadgeTxt}>{article.readMinutes || 1} phút đọc</Text>
          </View>
          <HeartBurst trigger={burst} />
        </View>

        <View style={styles.articleBody}>
          <Text style={styles.articleTitle} numberOfLines={2}>
            {article.title}
          </Text>
          {article.summary ? (
            <Text style={styles.articleSummary} numberOfLines={2}>
              {article.summary}
            </Text>
          ) : null}
          {article.tags?.length ? (
            <Text style={styles.articleTags} numberOfLines={1}>
              {article.tags
                .slice(0, 3)
                .map((t) => `#${t.replace(/\s+/g, '')}`)
                .join('  ')}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.actionRow}>
        <View style={styles.actionLeft}>
          <PopButton
            onPress={onLike}
            label={isLiked ? 'Bỏ thích' : 'Thích'}
            count={likeCount}
            countColor={isLiked ? RED_LIKE : INK}
            active={isLiked}
          >
            <Heart size={24} color={isLiked ? RED_LIKE : INK} fill={isLiked ? RED_LIKE : 'transparent'} />
          </PopButton>
          <PopButton onPress={onPress} label="Bình luận" count={commentCount}>
            <MessageCircle size={23} color={INK} />
          </PopButton>
          <PopButton onPress={onShare} label="Chia sẻ">
            <Send size={22} color={INK} />
          </PopButton>
        </View>
        <PopButton onPress={onSave} label={saved ? 'Bỏ lưu' : 'Lưu'} active={saved}>
          <Bookmark size={23} color={INK} fill={saved ? INK : 'transparent'} />
        </PopButton>
      </View>
    </View>
  );
});

/* -------------------------------------------------------------------------- */
/*                               Community post                               */
/* -------------------------------------------------------------------------- */

export const PostFeedItem = memo(function PostFeedItem({
  post,
  onPress,
  onLike,
  onFollow,
  following,
  onSave,
  saved,
  onShare,
  onMore,
  onAuthorPress,
}: {
  post: ExplorePost;
  onPress: () => void;
  onLike?: () => void;
  onFollow?: () => void;
  following?: boolean;
  onSave?: () => void;
  saved?: boolean;
  onShare?: () => void;
  onMore?: () => void;
  onAuthorPress?: () => void;
}) {
  const hasMedia = Boolean(post.media?.length || post.imageUrls?.length);
  const name = post.author.displayName || 'Thành viên';
  const isOwner = Boolean(post.viewerCapabilities?.canEdit || post.viewerCapabilities?.canDelete);
  const isSaved = Boolean(saved || post.isSaved);
  const [burst, setBurst] = useState(0);

  const handleTap = useDoubleTap(onPress, () => {
    setBurst((b) => b + 1);
    tapHaptic();
    if (!post.isLiked) onLike?.();
  });

  return (
    <View style={styles.card}>
      <AuthorHeader
        name={name}
        avatarUrl={post.author.avatarUrl}
        seed={post.author.userId ?? name}
        time={formatRelativeTime(post.createdAt)}
        visibility={post.visibility ?? 'PUBLIC'}
        onPress={onAuthorPress}
        right={
          <View style={styles.headerRight}>
            {!isOwner && !following ? (
              <Pressable
                onPress={() => {
                  tapHaptic();
                  onFollow?.();
                }}
                style={styles.followBtn}
                accessibilityRole="button"
                accessibilityLabel={`Theo dõi ${name}`}
                hitSlop={6}
              >
                <Plus size={13} color={INK} strokeWidth={3} />
                <Text style={styles.followTxt}>Theo dõi</Text>
              </Pressable>
            ) : null}
            <MoreButton onPress={onMore} />
          </View>
        }
      />

      {hasMedia ? (
        <>
          {post.content ? (
            <View style={styles.captionTop}>
              <Caption text={post.content} />
            </View>
          ) : null}
          <View>
            <PostMediaCarousel
              media={post.media}
              imageUrls={post.imageUrls}
              borderRadius={0}
              onPressImage={handleTap}
            />
            <HeartBurst trigger={burst} />
          </View>
        </>
      ) : (
        <Pressable onPress={handleTap}>
          <LinearGradient
            colors={['#FFF4CC', '#FFE3B8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.textOnlyCard}
          >
            <Text style={styles.textOnlyBody} numberOfLines={6}>
              {post.content}
            </Text>
            <HeartBurst trigger={burst} />
          </LinearGradient>
        </Pressable>
      )}

      {post.dish || post.place ? (
        <View style={styles.attachRow}>
          {post.dish ? (
            <View style={styles.attachChip}>
              {post.dish.thumbnailUrl ? (
                <AppImage
                  uri={post.dish.thumbnailUrl}
                  style={styles.attachThumb}
                  borderRadius={8}
                  showLoader={false}
                />
              ) : (
                <UtensilsCrossed size={14} color={HONEY} />
              )}
              <Text style={styles.attachTxt} numberOfLines={1}>
                {post.dish.name}
              </Text>
            </View>
          ) : null}
          {post.place ? (
            <View style={styles.attachChip}>
              <MapPin size={14} color={RED_LIKE} />
              <Text style={styles.attachTxt} numberOfLines={1}>
                {post.place.name}
                {post.place.addressShort ? ` · ${post.place.addressShort}` : ''}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <View style={styles.actionLeft}>
          <PopButton
            onPress={onLike}
            label={post.isLiked ? 'Bỏ thích' : 'Thích'}
            count={post.likeCount}
            countColor={post.isLiked ? RED_LIKE : INK}
            active={post.isLiked}
          >
            <Heart
              size={24}
              color={post.isLiked ? RED_LIKE : INK}
              fill={post.isLiked ? RED_LIKE : 'transparent'}
            />
          </PopButton>
          <PopButton onPress={onPress} label="Bình luận" count={post.commentCount}>
            <MessageCircle size={23} color={INK} />
          </PopButton>
          <PopButton onPress={onShare} label="Chia sẻ">
            <Send size={22} color={INK} />
          </PopButton>
        </View>
        {!isOwner ? (
          <PopButton onPress={onSave} label={isSaved ? 'Bỏ lưu' : 'Lưu'} active={isSaved}>
            <Bookmark size={23} color={INK} fill={isSaved ? INK : 'transparent'} />
          </PopButton>
        ) : null}
      </View>

      {post.commentCount > 0 ? (
        <Pressable onPress={onPress} style={styles.commentsLink} hitSlop={4}>
          <Text style={styles.seeComments}>Xem tất cả {formatCount(post.commentCount)} bình luận</Text>
        </Pressable>
      ) : post.commentsEnabled !== false ? (
        <Pressable onPress={onPress} style={styles.commentsLink} hitSlop={4}>
          <Text style={styles.seeComments}>Hãy là người đầu tiên bình luận…</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

/* -------------------------------------------------------------------------- */
/*                                   Styles                                   */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  /* stories */
  storyRow: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10, gap: 12 },
  storyItem: { width: 74, alignItems: 'center' },
  storyRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyRingIdle: { borderWidth: 1.5, borderColor: BORDER, backgroundColor: WHITE },
  storyInner: {
    width: 67,
    height: 67,
    borderRadius: 34,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 2.5,
  },
  storyImg: { width: 62, height: 62, borderRadius: 31 },
  storyPlus: {
    position: 'absolute',
    top: 48,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: YELLOW,
    borderWidth: 2.5,
    borderColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: INK,
    textAlign: 'center',
    maxWidth: 74,
  },

  /* card shell */
  card: {
    backgroundColor: WHITE,
    borderRadius: CARD_RADIUS,
    marginHorizontal: 12,
    marginBottom: POST_GAP,
    paddingBottom: 6,
    shadowColor: '#6B4E12',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  /* composer */
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    paddingBottom: 12,
  },
  composerInput: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F7F1E3',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  composerPlaceholder: { fontSize: 15, color: TERTIARY },
  composerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: YELLOW_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: CARD_PAD,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 8,
  },
  headerAuthor: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10, minHeight: 44 },
  headerAvatarRing: {
    borderRadius: 22,
    padding: 1.5,
    borderWidth: 1.5,
    borderColor: YELLOW,
  },
  headerMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  authorName: { fontSize: 15, fontWeight: '700', color: INK },
  authorTime: { fontSize: 12, color: TERTIARY },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: YELLOW,
    borderRadius: 999,
    paddingHorizontal: 12,
    height: 32,
  },
  followTxt: { fontSize: 13, fontWeight: '800', color: INK },
  moreBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  /* heart burst */
  burstWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burstShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },

  /* dish */
  dishCard: { padding: 8, paddingBottom: 4 },
  dishMediaWrap: {
    borderRadius: CARD_RADIUS - 6,
    overflow: 'hidden',
    backgroundColor: '#F0EBE0',
  },
  dishMedia: { width: '100%', aspectRatio: 4 / 5 },
  dishBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: YELLOW,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dishBadgeTxt: { fontSize: 12, fontWeight: '800', color: INK },
  floatingSave: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingSaveActive: { backgroundColor: YELLOW },
  dishOverlayText: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  dishTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: WHITE,
    lineHeight: 30,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 8,
  },
  dishDesc: { marginTop: 4, fontSize: 14, color: 'rgba(255,255,255,0.88)' },
  dishFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 6,
    paddingTop: 8,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FBF5E8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaPillTxt: { fontSize: 12, fontWeight: '700', color: INK },

  /* article */
  articleMediaWrap: {
    marginHorizontal: CARD_PAD - 4,
    borderRadius: MEDIA_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#F0EBE0',
  },
  articleMedia: { width: '100%', aspectRatio: 16 / 10 },
  readBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  readBadgeTxt: { fontSize: 12, fontWeight: '700', color: WHITE },
  articleBody: { paddingHorizontal: CARD_PAD, paddingTop: 12 },
  articleTitle: { fontSize: 19, fontWeight: '800', color: INK, lineHeight: 25 },
  articleSummary: { marginTop: 6, fontSize: 14, lineHeight: 20, color: MUTED },
  articleTags: { marginTop: 6, fontSize: 13, fontWeight: '600', color: HONEY },

  /* post */
  captionTop: { paddingHorizontal: CARD_PAD, paddingBottom: 10 },
  caption: { fontSize: 15, lineHeight: 22, color: INK },
  captionAuthor: { fontWeight: '800' },
  hashtag: { color: HONEY, fontWeight: '700' },
  seeMore: { marginTop: 2, fontSize: 14, fontWeight: '600', color: TERTIARY },
  textOnlyCard: {
    marginHorizontal: CARD_PAD - 4,
    borderRadius: MEDIA_RADIUS,
    paddingHorizontal: 20,
    paddingVertical: 28,
    minHeight: 150,
    justifyContent: 'center',
  },
  textOnlyBody: { fontSize: 19, lineHeight: 28, fontWeight: '700', color: INK, textAlign: 'center' },
  attachRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: CARD_PAD, paddingTop: 10 },
  attachChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    backgroundColor: '#FBF5E8',
    borderRadius: 999,
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 5,
  },
  attachThumb: { width: 22, height: 22 },
  attachTxt: { fontSize: 13, fontWeight: '700', color: INK, flexShrink: 1 },

  /* actions */
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CARD_PAD - 4,
    paddingTop: 6,
  },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  actionCount: { fontSize: 14, fontWeight: '700' },
  commentsLink: { paddingHorizontal: CARD_PAD, paddingBottom: 8 },
  seeComments: { fontSize: 14, color: TERTIARY },
});

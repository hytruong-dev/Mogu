import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Bookmark,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Share2,
} from 'lucide-react-native';
import { AppImage } from '../../components/ui/app-image';
import { AvatarImage } from '../../components/organisms/AvatarImage';
import type { ExploreArticle, ExplorePost, ExploreTopic } from '../../services/api/explore';
import type { Dish } from '../../services/api/dishes';
import {
  BORDER,
  H_PAD,
  INK,
  MEDIA_RADIUS,
  MUTED,
  RED_LIKE,
  TERTIARY,
  WHITE,
  YELLOW,
} from './tokens';
import {
  formatCount,
  formatDishMeta,
  formatRelativeTime,
  resolveDishImageUrl,
} from './utils';
import { PostMediaCarousel } from './PostMediaCarousel';
const pho = require('../../assets/images/random/pho-result.jpg');
const bun = require('../../assets/images/random/bun-rieu.jpg');
const rice = require('../../assets/images/random/chao-ga.jpg');
const TOPIC_FALLBACKS = [pho, rice, bun, pho];

export function TopicCircles({
  topics,
  onPress,
}: {
  topics: ExploreTopic[];
  onPress?: (topic: ExploreTopic) => void;
}) {
  if (!topics || topics.length === 0) return null;
  const list = topics.slice(0, 8);

  return (
    <View style={styles.topicRow}>
      {list.map((topic, i) => (
        <Pressable
          key={topic.id}
          onPress={() => onPress?.(topic)}
          style={styles.topicItem}
          accessibilityRole="button"
          accessibilityLabel={topic.title}
        >
          <View style={styles.topicRing}>
            <AppImage
              uri={topic.coverImageUrl}
              fallbackSource={TOPIC_FALLBACKS[i % TOPIC_FALLBACKS.length]}
              style={styles.topicImg}
              contentFit="cover"
            />
          </View>
          <Text style={styles.topicLabel} numberOfLines={1}>
            {topic.title.replace(/\n/g, ' ')}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function DishFeedItem({
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
  const meta = formatDishMeta(dish);

  return (
    <View style={styles.feedBlock}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={dish.name}>
        <View style={styles.mediaWrap}>
          <AppImage
            uri={uri}
            fallbackSource={pho}
            style={styles.media}
            contentFit="cover"
          />
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeTxt}>Món ăn</Text>
          </View>
        </View>
        <Text style={styles.dishTitle} numberOfLines={2}>
          {dish.name}
        </Text>
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </Pressable>

      <View style={styles.actionRow}>
        <View style={styles.actionLeft}>
          <View style={styles.actionBtn}>
            <Heart size={22} color={INK} />
          </View>
          <View style={styles.actionBtn}>
            <MessageCircle size={22} color={INK} />
          </View>
          <Pressable
            onPress={onSave}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Bỏ lưu' : 'Lưu'}
          >
            <Bookmark size={22} color={INK} fill={saved ? INK : 'transparent'} />
            <Text style={styles.actionLabel}>Lưu</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={onMore}
          style={styles.actionBtn}
          accessibilityLabel="Thêm"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MoreHorizontal size={22} color={INK} />
        </Pressable>
      </View>
    </View>
  );
}

export function ArticleFeedItem({
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
  const authorName = article.author?.displayName || 'Mogu';
  const isLiked = liked ?? Boolean(article.isLiked);
  const likeCount = article.likeCount ?? 0;
  const commentCount = article.commentCount ?? 0;

  return (
    <View style={styles.feedBlock}>
      <View style={styles.postHeader}>
        <Pressable
          onPress={onAuthorPress}
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}
        >
          <AvatarImage uri={article.author?.avatarUrl} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.authorName} numberOfLines={1}>
              {authorName}
            </Text>
            <Text style={styles.authorTime}>{formatRelativeTime(article.createdAt)}</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={onMore}
          style={styles.moreBtn}
          accessibilityLabel="Thêm"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MoreHorizontal size={20} color={INK} />
        </Pressable>
      </View>

      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={article.title}>
        <View style={styles.mediaWrap}>
          <AppImage
            uri={article.coverImageUrl}
            fallbackSource={rice}
            style={styles.media}
            contentFit="cover"
          />
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeTxt}>Bài viết</Text>
          </View>
        </View>
        {article.topic?.title ? (
          <Text style={styles.topicChip} numberOfLines={1}>
            {article.topic.title}
          </Text>
        ) : null}
        <Text style={styles.dishTitle} numberOfLines={2}>
          {article.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {article.readMinutes} phút đọc
        </Text>
      </Pressable>

      <View style={styles.actionRow}>
        <View style={styles.actionLeft}>
          <Pressable onPress={onLike} style={styles.actionBtn} accessibilityLabel="Thích">
            <Heart
              size={24}
              color={isLiked ? RED_LIKE : INK}
              fill={isLiked ? RED_LIKE : 'transparent'}
            />
          </Pressable>
          <Pressable onPress={onPress} style={styles.actionBtn} accessibilityLabel="Bình luận">
            <MessageCircle size={24} color={INK} />
          </Pressable>
          <Pressable onPress={onShare} style={styles.actionBtn} accessibilityLabel="Chia sẻ">
            <Share2 size={22} color={INK} />
          </Pressable>
        </View>
        <Pressable
          onPress={onSave}
          style={styles.actionBtn}
          accessibilityLabel={saved ? 'Bỏ lưu' : 'Lưu'}
        >
          <Bookmark size={22} color={INK} fill={saved ? INK : 'transparent'} />
          <Text style={styles.actionLabel}>Lưu</Text>
        </Pressable>
      </View>

      {likeCount > 0 ? (
        <Text style={styles.likeCount}>{formatCount(likeCount)} lượt thích</Text>
      ) : null}
      {commentCount > 0 ? (
        <Pressable onPress={onPress}>
          <Text style={styles.seeComments}>Xem {commentCount} bình luận</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function PostFeedItem({
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
  const showFollow = !isOwner;

  return (
    <View style={styles.feedBlock}>
      <View style={styles.postHeader}>
        <Pressable onPress={onAuthorPress} style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
          <AvatarImage uri={post.author.avatarUrl} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.authorName} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.authorTime}>{formatRelativeTime(post.createdAt)}</Text>
          </View>
        </Pressable>
        {showFollow ? (
          <Pressable
            onPress={onFollow}
            style={[styles.followBtn, following && styles.followBtnDone]}
            accessibilityRole="button"
            accessibilityLabel={following ? 'Đang theo dõi' : 'Theo dõi'}
          >
            <Text style={styles.followTxt}>{following ? 'Đang theo dõi' : 'Theo dõi'}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onMore}
          style={styles.moreBtn}
          accessibilityLabel="Thêm"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MoreHorizontal size={20} color={INK} />
        </Pressable>
      </View>

      {hasMedia ? (
        <PostMediaCarousel
          media={post.media}
          imageUrls={post.imageUrls}
          borderRadius={MEDIA_RADIUS}
          onPressImage={onPress}
        />
      ) : (
        <Pressable onPress={onPress}>
          <View style={styles.textOnlyCard}>
            <Text style={styles.textOnlyBody} numberOfLines={4}>
              {post.content}
            </Text>
          </View>
        </Pressable>
      )}

      {post.dish || post.place ? (
        <View style={{ marginTop: 8, gap: 4 }}>
          {post.dish ? (
            <Text style={styles.meta} numberOfLines={1}>
              Món: {post.dish.name}
            </Text>
          ) : null}
          {post.place ? (
            <Text style={styles.meta} numberOfLines={1}>
              {post.place.name}
              {post.place.addressShort ? ` · ${post.place.addressShort}` : ''}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <View style={styles.actionLeft}>
          <Pressable onPress={onLike} style={styles.actionBtn} accessibilityLabel="Thích">
            <Heart
              size={24}
              color={post.isLiked ? RED_LIKE : INK}
              fill={post.isLiked ? RED_LIKE : 'transparent'}
            />
          </Pressable>
          <Pressable onPress={onPress} style={styles.actionBtn} accessibilityLabel="Bình luận">
            <MessageCircle size={24} color={INK} />
          </Pressable>
          <Pressable onPress={onShare} style={styles.actionBtn} accessibilityLabel="Chia sẻ">
            <Share2 size={22} color={INK} />
          </Pressable>
        </View>
        {!isOwner ? (
          <Pressable onPress={onSave} style={styles.actionBtn} accessibilityLabel="Lưu">
            <Bookmark
              size={22}
              color={INK}
              fill={saved || post.isSaved ? INK : 'transparent'}
            />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.likeCount}>{formatCount(post.likeCount)} lượt thích</Text>
      <Text style={styles.caption} numberOfLines={2}>
        <Text style={styles.captionAuthor}>{name} </Text>
        {post.content}
      </Text>
      {post.commentCount > 0 ? (
        <Pressable onPress={onPress}>
          <Text style={styles.seeComments}>Xem {post.commentCount} bình luận</Text>
        </Pressable>
      ) : (
        <Pressable onPress={onPress}>
          <Text style={styles.seeMore}>Xem thêm</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topicRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  topicItem: { width: 76, alignItems: 'center', gap: 8, minHeight: 48 },
  topicRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: WHITE,
    overflow: 'hidden',
    backgroundColor: BORDER,
  },
  topicImg: { width: '100%', height: '100%' },
  topicLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: INK,
    textAlign: 'center',
  },

  feedBlock: {
    marginHorizontal: -H_PAD,
    paddingHorizontal: H_PAD,
    marginBottom: 0,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 8,
    borderBottomColor: '#F0E8D8',
  },
  mediaWrap: {
    borderRadius: MEDIA_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#F0EBE0',
  },
  media: { width: '100%', aspectRatio: 16 / 10 },
  typeBadge: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    backgroundColor: YELLOW,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  typeBadgeTxt: { fontSize: 12, fontWeight: '700', color: INK },
  dishTitle: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: '800',
    color: INK,
    lineHeight: 28,
  },
  meta: { marginTop: 4, fontSize: 14, color: MUTED },
  topicChip: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: YELLOW,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '700',
    color: INK,
  },

  actionRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  actionLabel: { fontSize: 14, fontWeight: '600', color: INK },

  authorRow: {
    marginTop: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authorName: { fontSize: 14, fontWeight: '700', color: INK },
  authorTime: { fontSize: 12, color: TERTIARY, marginTop: 1 },

  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  followBtn: {
    backgroundColor: YELLOW,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  followBtnDone: { backgroundColor: WHITE, borderWidth: 1, borderColor: BORDER },
  followTxt: { fontSize: 13, fontWeight: '700', color: INK },
  moreBtn: { padding: 6, minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  postMedia: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: MEDIA_RADIUS,
    backgroundColor: '#F0EBE0',
  },
  textOnlyCard: {
    backgroundColor: WHITE,
    borderRadius: MEDIA_RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    minHeight: 88,
  },
  textOnlyBody: { fontSize: 16, lineHeight: 24, color: INK },
  likeCount: { marginTop: 8, fontSize: 14, fontWeight: '700', color: INK },
  caption: { marginTop: 4, fontSize: 15, lineHeight: 21, color: INK },
  captionAuthor: { fontWeight: '700' },
  seeComments: { marginTop: 4, marginBottom: 8, fontSize: 14, color: TERTIARY },
  seeMore: { marginTop: 2, marginBottom: 8, fontSize: 14, color: TERTIARY },
});

import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommunityPostDetailScreen } from './CommunityPostDetailScreen';
import FoodDetailScreen from './FoodDetailScreen';
import { articlesApi } from '../services/api/explore';
import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  ChevronRight,
  Clock3,
  Flame,
  Heart,
  Info,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Share2,
  Sparkles,
  Star,
  Sun,
  Tag,
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
}: {
  type: ExploreDetailType;
  resourceId?: string | null;
  onBack: () => void;
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
    return <CommunityPostDetailScreen postId={resourceId} onBack={onBack} />;
  }
  if (type === 'article') {
    return <ArticleDetailLoaded articleId={resourceId} onBack={onBack} />;
  }
  return (
    <FoodDetailScreen
      route={{ params: { dishId: resourceId } }}
      navigation={{ goBack: onBack, setOptions: () => undefined }}
    />
  );
}

function ArticleDetailLoaded({
  articleId,
  onBack,
}: {
  articleId: string;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [article, setArticle] = useState<{
    title: string;
    content?: string;
    summary?: string | null;
    coverImageUrl?: string | null;
    topic?: { title: string } | null;
    readMinutes?: number;
  } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    articlesApi
      .findOne(articleId)
      .then((data) => {
        if (!cancelled) setArticle(data);
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

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Header onBack={onBack} saved={saved} onSave={() => setSaved((s) => !s)} />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.primaryDark} />
        </View>
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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.articleContent}>
          {article.coverImageUrl ? (
            <Image source={{ uri: article.coverImageUrl }} style={styles.articleHero} />
          ) : null}
          <View style={styles.articleBadge}>
            <Text style={{ fontWeight: '600', color: C.ink }}>
              {article.topic?.title ?? 'Bài viết'}
            </Text>
          </View>
          <Text style={styles.articleHeading}>{article.title}</Text>
          {article.readMinutes != null ? (
            <Text style={styles.articleMeta}>
              {article.readMinutes} phút đọc
            </Text>
          ) : null}
          <Text style={styles.lead}>
            {article.content?.trim() || article.summary?.trim() || 'Bài viết chưa có nội dung.'}
          </Text>
        </ScrollView>
      )}
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.overlay} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Pressable onPress={onClose} style={styles.sheetClose}>
            <X size={24} />
          </Pressable>
          <View style={styles.checkCircle}>
            <Text style={styles.check}>✓</Text>
          </View>
          <Text style={styles.sheetTitle}>Đã chọn Phở bò!</Text>
          <Text style={styles.sheetSubtitle}>
            Mogu đã thêm món này vào bữa trưa hôm nay của bạn.
          </Text>
          <Pressable style={styles.primaryButton} onPress={onClose}>
            <Text style={styles.primaryText}>Hoàn tất</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ArticleDetail({ onBack }: { onBack: () => void }) {
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);
  const [progress, setProgress] = useState(0);
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Header onBack={onBack} saved={saved} onSave={() => setSaved(!saved)} more />
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.max(8, progress * 100)}%` }]} />
      </View>
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
  progressFill: { height: 3, backgroundColor: C.primaryDark },
  articleContent: { paddingBottom: 18 },
  articleHero: { width: '100%', height: 310, resizeMode: 'cover' },
  articleBadge: {
    alignSelf: 'flex-start',
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: C.primarySoft,
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: -15,
  },
  articleHeading: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '700',
    color: C.ink,
    marginHorizontal: 20,
    marginTop: 24,
  },
  articleSubtitle: {
    fontSize: 17,
    lineHeight: 25,
    color: '#626262',
    marginHorizontal: 20,
    marginTop: 12,
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
  articleMeta: { fontSize: 13, lineHeight: 18, color: '#7A7A7A', marginTop: 2 },
  lead: { fontSize: 18, lineHeight: 29, color: '#292929', marginHorizontal: 20, marginTop: 30 },
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

import { useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  Bookmark,
  Check,
  ChevronRight,
  Compass,
  Heart,
  MessageCircle,
  MoreHorizontal,
  PenLine,
  Plus,
  Search,
  Share2,
  Sparkles,
  Star,
  Utensils,
  X,
} from 'lucide-react-native';
import { Button } from '../components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '../components/ui/drawer';
import { Input } from '../components/ui/input';
import { Text as UiText } from '../components/ui/text';

const CREAM = '#FFF9E8';
const WHITE = '#FFFFFF';
const INK = '#161616';
const SECONDARY = '#4F4F4F';
const MUTED = '#858585';
const YELLOW = '#FFD54F';
const CORAL = '#FF796F';
const BORDER = '#E8E0D2';
const pho = require('../assets/images/random/pho-result.jpg');
const bunRieu = require('../assets/images/random/bun-rieu.jpg');
const chaoGa = require('../assets/images/random/chao-ga.jpg');
const mascot = require('../assets/images/logo/logo.png');
const avatar = require('../assets/images/home/avatar.jpg');
const brand = require('../assets/images/logo/mogu-wordmark-header.png');

type Props = { onBack: () => void };
type Tab = 'Dành cho bạn' | 'Món ăn' | 'Bài viết' | 'Cộng đồng';

export function ExploreScreen({ onBack }: Props) {
  const [tab, setTab] = useState<Tab>('Dành cho bạn');
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [saved, setSaved] = useState<number[]>([]);
  const [liked, setLiked] = useState<number[]>([]);
  const [toast, setToast] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTranslate = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [0, -24],
    extrapolate: 'clamp',
  });
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 70],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const toggleSaved = (index: number) => {
    setSaved((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
    );
    setToast(true);
    setTimeout(() => setToast(false), 1600);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Animated.View
        style={[styles.compactHeader, { transform: [{ translateY: headerTranslate }] }]}
      >
        <Pressable onPress={onBack} style={styles.headerIcon}>
          <ChevronRight size={25} style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
        <Text style={styles.compactTitle}>Khám phá</Text>
        <View style={styles.headerIcon}>
          <Bell size={23} />
        </View>
      </Animated.View>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
      >
        <Animated.View
          style={[
            styles.topHeader,
            { opacity: headerOpacity, transform: [{ translateY: headerTranslate }] },
          ]}
        >
          <View style={styles.topBrand}>
            <Image source={brand} style={styles.brand} resizeMode="contain" />
          </View>
          <View style={styles.headerActions}>
            <View style={styles.notification}>
              <Bell size={25} />
              <View style={styles.redDot} />
            </View>
            <Image source={avatar} style={styles.avatar} />
          </View>
        </Animated.View>
        <Animated.View style={{ opacity: headerOpacity }}>
          <Text style={styles.screenTitle}>Khám phá</Text>
          <Text style={styles.screenSubtitle}>Tìm cảm hứng cho bữa ăn tiếp theo của bạn</Text>
        </Animated.View>
        <View style={styles.searchBox}>
          <Search size={22} color={SECONDARY} />
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm món ăn, bài viết, địa điểm…"
            placeholderTextColor={MUTED}
            className="h-auto flex-1 border-0 bg-transparent p-0 shadow-none"
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {(['Dành cho bạn', 'Món ăn', 'Bài viết', 'Cộng đồng'] as Tab[]).map((item) => (
            <Pressable
              key={item}
              onPress={() => setTab(item)}
              style={[styles.filterChip, tab === item && styles.filterActive]}
            >
              <Text style={[styles.filterText, tab === item && styles.filterTextActive]}>
                {item}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <SectionTitle title="Chủ đề hôm nay" action="Xem tất cả" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topicRow}
        >
          {[
            ['Món ngon\nmùa mưa', pho],
            ['Ăn\nlành mạnh', chaoGa],
            ['Dưới\n50K', bunRieu],
            ['Theo\nthời tiết', pho],
            ['Đang\nphổ biến', bunRieu],
          ].map(([label, image], index) => (
            <Pressable key={index} style={styles.topicCard}>
              <Image source={image as number} style={styles.topicImage} />
              <View style={styles.topicShade} />
              <Text style={styles.topicText}>{label as string}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {(tab === 'Dành cho bạn' || tab === 'Bài viết') && (
          <>
            <SectionTitle title="Bài viết biên tập" action="Xem tất cả" />
            <ArticleCard
              index={0}
              image={pho}
              saved={saved.includes(0)}
              onSave={() => toggleSaved(0)}
            />
            <ArticleCard
              index={1}
              image={chaoGa}
              saved={saved.includes(1)}
              onSave={() => toggleSaved(1)}
            />
          </>
        )}
        {(tab === 'Dành cho bạn' || tab === 'Món ăn') && (
          <>
            <SectionTitle title="Món ăn được yêu thích" action="Xem tất cả" />
            <DishCard
              image={pho}
              name="Phở bò"
              liked={liked.includes(2)}
              onLike={() =>
                setLiked((items) =>
                  items.includes(2) ? items.filter((item) => item !== 2) : [...items, 2],
                )
              }
            />
            <DishCard
              image={bunRieu}
              name="Bún riêu"
              liked={liked.includes(3)}
              onLike={() =>
                setLiked((items) =>
                  items.includes(3) ? items.filter((item) => item !== 3) : [...items, 3],
                )
              }
            />
          </>
        )}
        {(tab === 'Dành cho bạn' || tab === 'Cộng đồng') && (
          <>
            <SectionTitle title="Cộng đồng Mogu" action="Xem tất cả" />
            <CommunityCard
              image={pho}
              liked={liked.includes(4)}
              onLike={() =>
                setLiked((items) =>
                  items.includes(4) ? items.filter((item) => item !== 4) : [...items, 4],
                )
              }
            />
          </>
        )}
        <View style={styles.endSpacer} />
      </Animated.ScrollView>
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => setCreateOpen(true)}
      >
        <Plus size={25} color={INK} />
        <PenLine size={16} color={INK} style={styles.fabPen} />
      </Pressable>
      {toast && (
        <View style={styles.toast}>
          <Check size={18} color="#FFF" />
          <Text style={styles.toastText}>Đã lưu vào bộ sưu tập</Text>
        </View>
      )}
      <CreateSheet visible={createOpen} onClose={() => setCreateOpen(false)} />
    </SafeAreaView>
  );
}

function SectionTitle({ title, action }: { title: string; action: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable style={styles.sectionAction}>
        <Text style={styles.actionText}>{action}</Text>
        <ChevronRight size={18} color="#D99E00" />
      </Pressable>
    </View>
  );
}
function ArticleCard({
  image,
  saved,
  onSave,
  index,
}: {
  image: number;
  saved: boolean;
  onSave: () => void;
  index: number;
}) {
  return (
    <Pressable style={styles.articleCard}>
      <Image source={image} style={styles.articleImage} />
      <View style={styles.articleBody}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{index ? 'DINH DƯỠNG' : 'SỨC KHỎE'}</Text>
        </View>
        <Text style={styles.articleTitle}>
          {index
            ? 'Ăn uống lành mạnh: bắt đầu từ những điều nhỏ'
            : 'Bí quyết chọn một bữa sáng đủ năng lượng'}
        </Text>
        <Text style={styles.articleSummary}>
          {index
            ? 'Những lựa chọn đơn giản giúp bạn ăn ngon và cân bằng hơn mỗi ngày.'
            : 'Gợi ý thực tế để bữa sáng vừa nhanh, vừa đủ chất cho cơ thể.'}
        </Text>
        <View style={styles.metaRow}>
          <Image source={avatar} style={styles.miniAvatar} />
          <Text style={styles.metaText}>Mogu Editorial · 5 phút đọc</Text>
          <Pressable onPress={onSave} style={styles.saveIcon}>
            <Bookmark
              size={21}
              color={saved ? '#D99E00' : MUTED}
              fill={saved ? YELLOW : 'transparent'}
            />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
function DishCard({
  image,
  name,
  liked,
  onLike,
}: {
  image: number;
  name: string;
  liked: boolean;
  onLike: () => void;
}) {
  return (
    <Pressable style={styles.dishCard}>
      <Image source={image} style={styles.dishImage} />
      <View style={styles.dishBody}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>KẾT QUẢ RANDOM</Text>
        </View>
        <Text style={styles.dishTitle}>{name}</Text>
        <Text style={styles.dishDescription}>
          Phù hợp với mục tiêu và sở thích của bạn hôm nay.
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.rating}>
            <Star size={16} color="#D99E00" fill={YELLOW} />
            <Text style={styles.metaText}>4,8 · 420 kcal · 25 phút</Text>
          </View>
          <Pressable onPress={onLike}>
            <Heart size={22} color={liked ? CORAL : MUTED} fill={liked ? CORAL : 'transparent'} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
function CommunityCard({
  image,
  liked,
  onLike,
}: {
  image: number;
  liked: boolean;
  onLike: () => void;
}) {
  return (
    <Pressable style={styles.communityCard}>
      <View style={styles.authorRow}>
        <Image source={avatar} style={styles.authorAvatar} />
        <View style={styles.flex}>
          <Text style={styles.authorName}>Minh Quân</Text>
          <Text style={styles.metaText}>Hôm nay · Hà Nội</Text>
        </View>
        <MoreHorizontal size={22} color={MUTED} />
      </View>
      <Text style={styles.postText}>
        Phở bò hôm nay ngon quá! Mình đã thử Random theo gợi ý của Mogu và rất bất ngờ.
      </Text>
      <View style={styles.randomBadge}>
        <Sparkles size={15} />
        <Text style={styles.badgeText}>KẾT QUẢ RANDOM</Text>
      </View>
      <Image source={image} style={styles.postImage} />
      <View style={styles.postActions}>
        <Pressable style={styles.postAction} onPress={onLike}>
          <Heart size={21} color={liked ? CORAL : SECONDARY} fill={liked ? CORAL : 'transparent'} />
          <Text style={styles.postMeta}>{liked ? '13' : '12'}</Text>
        </Pressable>
        <View style={styles.postAction}>
          <MessageCircle size={21} color={SECONDARY} />
          <Text style={styles.postMeta}>4</Text>
        </View>
        <View style={styles.postAction}>
          <Share2 size={21} color={SECONDARY} />
          <Text style={styles.postMeta}>Chia sẻ</Text>
        </View>
      </View>
    </Pressable>
  );
}
function CreateSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Drawer open={visible} onOpenChange={(open) => !open && onClose()} snapHeight={360}>
      <DrawerHeader className="flex-row items-start justify-between px-5">
        <View className="flex-1">
          <DrawerTitle>Tạo nội dung</DrawerTitle>
          <DrawerDescription>Chia sẻ điều thú vị của bạn với cộng đồng Mogu.</DrawerDescription>
        </View>
        <DrawerClose onPress={onClose} />
      </DrawerHeader>
      <DrawerContent className="gap-2 px-4 pb-6">
        {[
          ['Viết bài viết', <PenLine size={23} key="pen" />],
          ['Chia sẻ kết quả Random', <Sparkles size={23} key="spark" />],
          ['Đăng ảnh món ăn', <Utensils size={23} key="food" />],
        ].map(([label, icon]) => (
          <Button
            key={label as string}
            variant="outline"
            onPress={onClose}
            className="h-14 justify-start gap-3 rounded-2xl px-3"
          >
            <View style={styles.createIcon}>{icon as ReactNode}</View>
            <UiText className="flex-1 text-left font-semibold text-foreground">
              {label as string}
            </UiText>
            <ChevronRight size={20} color={MUTED} />
          </Button>
        ))}
      </DrawerContent>
    </Drawer>
  );
}

const shadow = {
  shadowColor: '#5D490F',
  shadowOpacity: 0.1,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  compactHeader: {
    position: 'absolute',
    zIndex: 5,
    top: 0,
    left: 0,
    right: 0,
    height: 58,
    backgroundColor: CREAM,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  compactTitle: { fontSize: 20, fontWeight: '700', color: INK },
  headerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topHeader: {
    height: 80,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topBrand: { width: 115, height: 46 },
  brand: { width: 112, height: 45 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  notification: { position: 'relative' },
  redDot: {
    position: 'absolute',
    right: -3,
    top: -2,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: CORAL,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: WHITE },
  screenTitle: { marginTop: 2, fontSize: 30, lineHeight: 36, fontWeight: '700', color: INK },
  screenSubtitle: { marginTop: 2, color: SECONDARY, fontSize: 15, lineHeight: 22 },
  searchBox: {
    height: 52,
    marginTop: 20,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    backgroundColor: WHITE,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  searchInput: { flex: 1, height: 50, fontSize: 15, color: INK },
  tabRow: { gap: 8, paddingVertical: 16 },
  filterChip: {
    height: 40,
    borderRadius: 999,
    paddingHorizontal: 18,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterActive: { backgroundColor: YELLOW, borderColor: YELLOW },
  filterText: { fontSize: 14, fontWeight: '500', color: '#303030' },
  filterTextActive: { fontWeight: '600', color: INK },
  sectionHeader: {
    marginTop: 12,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: INK },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionText: { color: '#CC9700', fontSize: 14, fontWeight: '500' },
  topicRow: { gap: 12, paddingBottom: 8 },
  topicCard: { width: 144, height: 130, borderRadius: 18, overflow: 'hidden', ...shadow },
  topicImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  topicShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,.25)' },
  topicText: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    color: WHITE,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  articleCard: {
    borderRadius: 20,
    backgroundColor: WHITE,
    overflow: 'hidden',
    marginBottom: 16,
    ...shadow,
  },
  articleImage: { width: '100%', height: 172, resizeMode: 'cover' },
  articleBody: { padding: 16, gap: 8 },
  badge: {
    alignSelf: 'flex-start',
    height: 24,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: '#FFF1B3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, lineHeight: 15, fontWeight: '600', color: INK },
  articleTitle: { fontSize: 20, lineHeight: 27, fontWeight: '700', color: INK },
  articleSummary: { fontSize: 15, lineHeight: 23, color: SECONDARY },
  metaRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniAvatar: { width: 24, height: 24, borderRadius: 12 },
  metaText: { color: MUTED, fontSize: 13, lineHeight: 18 },
  saveIcon: { marginLeft: 'auto', padding: 6 },
  dishCard: {
    borderRadius: 20,
    backgroundColor: WHITE,
    overflow: 'hidden',
    marginBottom: 16,
    ...shadow,
  },
  dishImage: { width: '100%', height: 205, resizeMode: 'cover' },
  dishBody: { padding: 16, gap: 8 },
  dishTitle: { fontSize: 22, fontWeight: '700', color: INK },
  dishDescription: { fontSize: 15, lineHeight: 23, color: SECONDARY },
  rating: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  communityCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: WHITE,
    marginBottom: 16,
    ...shadow,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorAvatar: { width: 40, height: 40, borderRadius: 20 },
  authorName: { fontSize: 16, lineHeight: 21, fontWeight: '600', color: INK },
  postText: { marginTop: 14, fontSize: 16, lineHeight: 24, color: '#303030' },
  randomBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#FFF1B3',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  postImage: { width: '100%', height: 205, marginTop: 12, borderRadius: 16, resizeMode: 'cover' },
  postActions: { flexDirection: 'row', alignItems: 'center', gap: 22, marginTop: 12 },
  postAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  postMeta: { color: SECONDARY, fontSize: 13 },
  endSpacer: { height: 16 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 22,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  fabPressed: { transform: [{ scale: 0.94 }], backgroundColor: '#F4BF24' },
  fabPen: { position: 'absolute', right: 14, bottom: 14 },
  toast: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    paddingHorizontal: 16,
    height: 42,
    borderRadius: 21,
    backgroundColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toastText: { color: WHITE, fontSize: 13, fontWeight: '600' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,.45)' },
  createSheet: {
    minHeight: 310,
    backgroundColor: WHITE,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  sheetHandle: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    width: 58,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D4D4D4',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontSize: 26, fontWeight: '700', color: INK },
  sheetSub: { marginTop: 4, color: SECONDARY, fontSize: 15, lineHeight: 22 },
  createOption: {
    height: 64,
    marginTop: 12,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  createIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF1B3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: INK },
});

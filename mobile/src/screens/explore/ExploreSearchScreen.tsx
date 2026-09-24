import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Search, UserPlus, X } from 'lucide-react-native';
import { AppImage } from '../../components/ui/app-image';
import { AvatarImage } from '../../components/organisms/AvatarImage';
import {
  exploreApi,
  type ExploreArticle,
  type ExplorePost,
} from '../../services/api/explore';
import type { Dish } from '../../services/api/dishes';
import {
  BORDER,
  CREAM,
  INK,
  MUTED,
  TERTIARY,
  WHITE,
  YELLOW,
} from './tokens';
import {
  clearRecentSearches,
  loadRecentSearches,
  pushRecentSearch,
  removeRecentSearch,
  resolveDishImageUrl,
} from './utils';

const pho = require('../../assets/images/random/pho-result.jpg');

type Filter = 'Tất cả' | 'Món ăn' | 'Bài viết' | 'Bài đăng' | 'Người dùng';

type SearchUser = {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
};

type SearchItem =
  | { kind: 'dish'; id: string; dish: Dish }
  | { kind: 'article'; id: string; article: ExploreArticle }
  | { kind: 'post'; id: string; post: ExplorePost }
  | { kind: 'user'; id: string; user: SearchUser };

type Props = {
  onBack: () => void;
  onOpenDish: (id: string) => void;
  onOpenArticle: (id: string) => void;
  onOpenPost?: (id: string) => void;
  onOpenUser?: (userId: string) => void;
};

function filterToType(f: Filter): string | undefined {
  if (f === 'Món ăn') return 'dish';
  if (f === 'Bài viết') return 'article';
  if (f === 'Bài đăng') return 'post';
  if (f === 'Người dùng') return 'user';
  return undefined;
}

export function ExploreSearchScreen({
  onBack,
  onOpenDish,
  onOpenArticle,
  onOpenPost,
  onOpenUser,
}: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('Tất cả');
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SearchItem[]>([]);
  const [trending, setTrending] = useState<{
    hashtags: Array<{ tag: string; postCount: number }>;
    articles: ExploreArticle[];
    posts: ExplorePost[];
    dishes: any[];
  } | null>(null);
  const inputRef = useRef<TextInput>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadRecentSearches().then(setRecent);
    exploreApi.trending().then(setTrending).catch(() => {});
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  const runSearch = useCallback(async (q: string, f: Filter) => {
    const term = q.trim();
    if (!term) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await exploreApi.search({
        q: term,
        type: filterToType(f),
        limit: 20,
      });

      const dishes = (res.dishes ?? []) as Dish[];
      const articles = res.articles ?? [];
      const posts = res.posts ?? [];
      const users = res.users ?? [];

      const next: SearchItem[] = [];
      if (f === 'Tất cả' || f === 'Món ăn') {
        for (const dish of dishes) next.push({ kind: 'dish', id: `d-${dish.id}`, dish });
      }
      if (f === 'Tất cả' || f === 'Bài viết') {
        for (const article of articles) {
          next.push({ kind: 'article', id: `a-${article.id}`, article });
        }
      }
      if (f === 'Tất cả' || f === 'Bài đăng') {
        for (const post of posts) next.push({ kind: 'post', id: `p-${post.id}`, post });
      }
      if (f === 'Tất cả' || f === 'Người dùng') {
        for (const user of users) {
          next.push({ kind: 'user', id: `u-${user.userId}`, user });
        }
      }

      if (f === 'Tất cả') {
        const byKind = {
          dish: next.filter((x) => x.kind === 'dish'),
          article: next.filter((x) => x.kind === 'article'),
          post: next.filter((x) => x.kind === 'post'),
          user: next.filter((x) => x.kind === 'user'),
        };
        const mixed: SearchItem[] = [];
        const max = Math.max(
          byKind.dish.length,
          byKind.article.length,
          byKind.post.length,
          byKind.user.length,
        );
        for (let i = 0; i < max; i++) {
          if (byKind.dish[i]) mixed.push(byKind.dish[i]);
          if (byKind.article[i]) mixed.push(byKind.article[i]);
          if (byKind.post[i]) mixed.push(byKind.post[i]);
          if (byKind.user[i]) mixed.push(byKind.user[i]);
        }
        setItems(mixed);
      } else {
        setItems(next);
      }
      setRecent(await pushRecentSearch(term));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void runSearch(query, filter);
    }, 350);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, filter, runSearch]);

  const showRecent = !query.trim();

  const renderItem = ({ item }: { item: SearchItem }) => {
    if (item.kind === 'dish') {
      return (
        <Pressable
          style={styles.gridCard}
          onPress={() => onOpenDish(item.dish.id)}
          accessibilityRole="button"
        >
          <AppImage
            uri={resolveDishImageUrl(item.dish)}
            fallbackSource={pho}
            style={styles.gridImg}
            contentFit="cover"
          />
          <Text style={styles.gridTitle} numberOfLines={1}>
            {item.dish.name}
          </Text>
        </Pressable>
      );
    }
    if (item.kind === 'article') {
      return (
        <Pressable
          style={styles.gridCard}
          onPress={() => onOpenArticle(item.article.id)}
          accessibilityRole="button"
        >
          <AppImage
            uri={item.article.coverImageUrl}
            fallbackSource={pho}
            style={styles.gridImg}
            contentFit="cover"
          />
          <Text style={styles.gridTitle} numberOfLines={1}>
            {item.article.title}
          </Text>
        </Pressable>
      );
    }
    if (item.kind === 'post') {
      const cover = item.post.media?.[0]?.url || item.post.imageUrls?.[0] || null;
      return (
        <Pressable
          style={styles.gridCard}
          onPress={() => onOpenPost?.(item.post.id)}
          accessibilityRole="button"
        >
          {cover ? (
            <AppImage uri={cover} fallbackSource={pho} style={styles.gridImg} contentFit="cover" />
          ) : (
            <View style={[styles.gridImg, styles.postPlaceholder]}>
              <Text style={styles.postPreview} numberOfLines={4}>
                {item.post.content}
              </Text>
            </View>
          )}
          <Text style={styles.gridTitle} numberOfLines={1}>
            {item.post.author?.displayName || 'Bài đăng'}
          </Text>
        </Pressable>
      );
    }
    const handle =
      item.user.displayName?.replace(/\s+/g, '').toLowerCase() ||
      item.user.userId.slice(0, 8);
    return (
      <Pressable
        style={styles.gridCard}
        onPress={() => onOpenUser?.(item.user.userId)}
        accessibilityRole="button"
      >
        <AppImage
          uri={item.user.avatarUrl}
          fallbackSource={pho}
          style={styles.gridImg}
          contentFit="cover"
        />
        <View style={styles.userFooter}>
          <AvatarImage uri={item.user.avatarUrl} size={28} />
          <Text style={styles.userHandle} numberOfLines={1}>
            @{handle}
          </Text>
          <View style={styles.followMini}>
            <UserPlus size={14} color={INK} />
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn} accessibilityLabel="Quay lại">
          <ArrowLeft size={24} color={INK} />
        </Pressable>
        <View style={styles.searchField}>
          <Search size={18} color={TERTIARY} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Tìm món, bài viết, bài đăng, người dùng"
            placeholderTextColor={TERTIARY}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <X size={16} color={MUTED} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {showRecent ? (
        <View style={styles.recentBlock}>
          {recent.length > 0 ? (
            <>
              <View style={styles.recentHead}>
                <Text style={styles.recentTitle}>Tìm kiếm gần đây</Text>
                <Pressable
                  onPress={async () => {
                    await clearRecentSearches();
                    setRecent([]);
                  }}
                >
                  <Text style={styles.clearTxt}>Xóa</Text>
                </Pressable>
              </View>
              <View style={styles.chips}>
                {recent.map((q) => (
                  <Pressable key={q} style={styles.chip} onPress={() => setQuery(q)}>
                    <Text style={styles.chipTxt} numberOfLines={1}>
                      {q}
                    </Text>
                    <Pressable
                      onPress={async () => setRecent(await removeRecentSearch(q))}
                      hitSlop={6}
                    >
                      <X size={12} color={MUTED} />
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {trending?.hashtags && trending.hashtags.length > 0 ? (
            <View style={{ marginTop: recent.length > 0 ? 18 : 0 }}>
              <View style={styles.recentHead}>
                <Text style={styles.recentTitle}>Chủ đề thịnh hành 🔥</Text>
              </View>
              <View style={styles.chips}>
                {trending.hashtags.map((h) => (
                  <Pressable
                    key={h.tag}
                    style={[styles.chip, { backgroundColor: '#FFF5D6', borderColor: '#FFE494' }]}
                    onPress={() => setQuery(h.tag)}
                  >
                    <Text
                      style={[styles.chipTxt, { color: '#8F5E00', fontWeight: '700' }]}
                      numberOfLines={1}
                    >
                      #{h.tag}
                    </Text>
                    {h.postCount > 1 ? (
                      <Text style={{ fontSize: 11, color: '#A07010' }}>{h.postCount}</Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {trending?.dishes && trending.dishes.length > 0 ? (
            <View style={{ marginTop: 18 }}>
              <Text style={styles.recentTitle}>Món ăn được quan tâm</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, marginTop: 10, paddingBottom: 4 }}
              >
                {trending.dishes.map((dish) => (
                  <Pressable
                    key={dish.id}
                    onPress={() => onOpenDish(dish.id)}
                    style={{
                      backgroundColor: WHITE,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: BORDER,
                      padding: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <AppImage
                      uri={resolveDishImageUrl(dish)}
                      fallbackSource={pho}
                      style={{ width: 36, height: 36, borderRadius: 8 }}
                      contentFit="cover"
                    />
                    <Text
                      style={{ fontSize: 13, fontWeight: '700', color: INK }}
                      numberOfLines={1}
                    >
                      {dish.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {(['Tất cả', 'Món ăn', 'Bài viết', 'Bài đăng', 'Người dùng'] as Filter[]).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterPill, filter === f && styles.filterActive]}
          >
            <Text style={[styles.filterTxt, filter === f && styles.filterTxtActive]}>{f}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={YELLOW} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          renderItem={renderItem}
          ListEmptyComponent={
            query.trim() ? (
              <Text style={styles.empty}>Không có kết quả phù hợp.</Text>
            ) : (
              <Text style={styles.emptyHint}>
                Gõ để tìm món, bài viết, bài đăng hoặc người dùng.
              </Text>
            )
          }
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 4,
    gap: 8,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  searchField: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  input: { flex: 1, fontSize: 15, color: INK, paddingVertical: 0 },
  recentBlock: { paddingHorizontal: 16, marginTop: 16 },
  recentHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recentTitle: { fontSize: 16, fontWeight: '800', color: INK },
  clearTxt: { fontSize: 14, fontWeight: '700', color: '#C08000' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: WHITE,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: BORDER,
    maxWidth: '100%',
  },
  chipTxt: { fontSize: 13, color: INK, maxWidth: 140 },
  filters: { paddingHorizontal: 16, gap: 8, paddingVertical: 14 },
  filterPill: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterActive: { backgroundColor: YELLOW },
  filterTxt: { fontSize: 14, color: INK },
  filterTxtActive: { fontWeight: '700' },
  gridContent: { paddingHorizontal: 16, paddingBottom: 40 },
  gridRow: { gap: 12, marginBottom: 12 },
  gridCard: {
    flex: 1,
    backgroundColor: WHITE,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  gridImg: { width: '100%', aspectRatio: 1 },
  postPlaceholder: {
    backgroundColor: '#F3EFE6',
    padding: 12,
    justifyContent: 'center',
  },
  postPreview: { fontSize: 13, color: INK, lineHeight: 18 },
  gridTitle: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    color: INK,
  },
  userFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  userHandle: { flex: 1, fontSize: 13, fontWeight: '700', color: INK },
  followMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { textAlign: 'center', color: MUTED, marginTop: 40, paddingHorizontal: 24 },
  emptyHint: { textAlign: 'center', color: TERTIARY, marginTop: 24 },
});

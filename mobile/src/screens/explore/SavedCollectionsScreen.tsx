import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Bookmark } from 'lucide-react-native';
import { articlesApi, communityApi, type ExploreArticle, type ExplorePost } from '../../services/api/explore';
import { dishesApi, type Dish } from '../../services/api/dishes';
import { toggleDishSave } from '../../services/saved-dishes-store';
import { apiRequest } from '../../services/api/client';
import { AppImage } from '../../components/ui/app-image';
import { CREAM, INK, PRIMARY } from './tokens';

type Tab = 'articles' | 'posts' | 'dishes';

type Props = {
  onBack: () => void;
  onOpenArticle?: (id: string) => void;
  onOpenPost?: (id: string) => void;
  onOpenDish?: (id: string) => void;
  onUnsave?: (type: 'article' | 'post' | 'dish', id: string) => void;
};

export function SavedCollectionsScreen({
  onBack,
  onOpenArticle,
  onOpenPost,
  onOpenDish,
  onUnsave,
}: Props) {
  const [tab, setTab] = useState<Tab>('articles');
  const [articles, setArticles] = useState<ExploreArticle[]>([]);
  const [posts, setPosts] = useState<ExplorePost[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);

  const handleUnsaveArticle = async (id: string) => {
    try {
      await articlesApi.unsave(id);
      setArticles((prev) => prev.filter((a) => a.id !== id));
      onUnsave?.('article', id);
    } catch {}
  };

  const handleUnsavePost = async (id: string) => {
    try {
      await communityApi.unsavePost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      onUnsave?.('post', id);
    } catch {}
  };

  const handleUnsaveDish = async (id: string) => {
    try {
      await toggleDishSave(id);
      setDishes((prev) => prev.filter((d) => d.id !== id));
      onUnsave?.('dish', id);
    } catch {}
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, p, d] = await Promise.all([
        apiRequest<{ data?: ExploreArticle[]; items?: Array<{ article: ExploreArticle }> }>(
          '/me/saved-articles?limit=40',
        ).catch(() => ({ data: [] as ExploreArticle[] })),
        apiRequest<{ items?: Array<{ post: ExplorePost }> }>('/me/saved-posts?limit=40').catch(
          () => ({ items: [] }),
        ),
        dishesApi.getSaved?.().catch(() => ({ data: [] as Dish[] })) ??
          Promise.resolve({ data: [] as Dish[] }),
      ]);
      setArticles((a as any).data ?? (a as any).items?.map((x: any) => x.article) ?? []);
      setPosts(p.items?.map((x) => x.post) ?? []);
      setDishes((d as any).data ?? (Array.isArray(d) ? d : []));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'articles', label: 'Bài viết' },
    { key: 'posts', label: 'Bài đăng' },
    { key: 'dishes', label: 'Món' },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.iconBtn}>
          <ArrowLeft size={24} color={INK} />
        </Pressable>
        <Text style={styles.title}>Đã lưu</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.tabs}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tab, tab === t.key && styles.tabActive]}
          >
            <Text style={[styles.tabTxt, tab === t.key && styles.tabTxtActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={INK} />
        </View>
      ) : tab === 'articles' ? (
        <FlatList
          data={articles}
          keyExtractor={(i) => i.id}
          ListEmptyComponent={<Text style={styles.empty}>Chưa lưu bài viết nào</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Pressable
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                onPress={() => onOpenArticle?.(item.id)}
              >
                <AppImage uri={item.coverImageUrl} style={styles.thumb} contentFit="cover" />
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {item.title}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleUnsaveArticle(item.id)}
                hitSlop={8}
                style={{ padding: 8 }}
                accessibilityLabel="Bỏ lưu bài viết"
              >
                <Bookmark size={20} color={PRIMARY} fill={PRIMARY} />
              </Pressable>
            </View>
          )}
        />
      ) : tab === 'posts' ? (
        <FlatList
          data={posts}
          keyExtractor={(i) => i.id}
          ListEmptyComponent={<Text style={styles.empty}>Chưa lưu bài đăng nào</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Pressable style={{ flex: 1 }} onPress={() => onOpenPost?.(item.id)}>
                <Text style={styles.rowTitle} numberOfLines={3}>
                  {item.content}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleUnsavePost(item.id)}
                hitSlop={8}
                style={{ padding: 8 }}
                accessibilityLabel="Bỏ lưu bài đăng"
              >
                <Bookmark size={20} color={PRIMARY} fill={PRIMARY} />
              </Pressable>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={dishes}
          keyExtractor={(i) => i.id}
          ListEmptyComponent={<Text style={styles.empty}>Chưa lưu món nào</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Pressable style={{ flex: 1 }} onPress={() => onOpenDish?.(item.id)}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {item.name}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleUnsaveDish(item.id)}
                hitSlop={8}
                style={{ padding: 8 }}
                accessibilityLabel="Bỏ lưu món"
              >
                <Bookmark size={20} color={PRIMARY} fill={PRIMARY} />
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: INK },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  tabActive: { backgroundColor: PRIMARY },
  tabTxt: { fontWeight: '600', color: '#666' },
  tabTxtActive: { color: INK },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
  },
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: '#EEE' },
  rowTitle: { flex: 1, color: INK, fontWeight: '600', fontSize: 14 },
});

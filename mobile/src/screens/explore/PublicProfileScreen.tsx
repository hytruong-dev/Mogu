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
import { ArrowLeft } from 'lucide-react-native';
import { communityApi, type ExplorePost } from '../../services/api/explore';
import { AppImage } from '../../components/ui/app-image';
import { CREAM, INK, PRIMARY } from './tokens';

type Props = {
  userId: string;
  onBack: () => void;
  onOpenPost?: (postId: string) => void;
};

export function PublicProfileScreen({ userId, onBack, onOpenPost }: Props) {
  const [profile, setProfile] = useState<{
    userId: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    followerCount: number;
    followingCount: number;
    postCount: number;
    isFollowing: boolean;
    isSelf: boolean;
  } | null>(null);
  const [posts, setPosts] = useState<ExplorePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingBusy, setFollowingBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [p, list] = await Promise.all([
        communityApi.getPublicProfile(userId),
        communityApi.listUserPosts(userId, { limit: 30 }),
      ]);
      setProfile(p);
      setPosts(list.data ?? []);
    } catch (e: any) {
      setError(e?.message || 'Không tải được hồ sơ');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleFollow = async () => {
    if (!profile || profile.isSelf) return;
    setFollowingBusy(true);
    const was = profile.isFollowing;
    setProfile({ ...profile, isFollowing: !was, followerCount: profile.followerCount + (was ? -1 : 1) });
    try {
      if (was) await communityApi.unfollowUser(userId);
      else await communityApi.followUser(userId);
    } catch {
      setProfile({ ...profile, isFollowing: was, followerCount: profile.followerCount });
    } finally {
      setFollowingBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.iconBtn} accessibilityLabel="Quay lại">
          <ArrowLeft size={24} color={INK} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {profile?.displayName || 'Hồ sơ'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={INK} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>Thử lại</Text>
          </Pressable>
        </View>
      ) : profile ? (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListHeaderComponent={
            <View style={styles.profileBlock}>
              <AppImage
                uri={profile.avatarUrl}
                style={styles.avatar}
                contentFit="cover"
              />
              <Text style={styles.name}>{profile.displayName || 'Người dùng Mogu'}</Text>
              {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statNum}>{profile.postCount}</Text>
                  <Text style={styles.statLabel}>Bài đăng</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statNum}>{profile.followerCount}</Text>
                  <Text style={styles.statLabel}>Người theo dõi</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statNum}>{profile.followingCount}</Text>
                  <Text style={styles.statLabel}>Đang theo dõi</Text>
                </View>
              </View>
              {!profile.isSelf ? (
                <Pressable
                  onPress={() => void toggleFollow()}
                  disabled={followingBusy}
                  style={[styles.followBtn, profile.isFollowing && styles.followingBtn]}
                >
                  <Text style={styles.followTxt}>
                    {profile.isFollowing ? 'Đang theo dõi' : 'Theo dõi'}
                  </Text>
                </Pressable>
              ) : null}
              <Text style={styles.sectionTitle}>Bài đăng</Text>
            </View>
          }
          ListEmptyComponent={
            <Text style={styles.empty}>Chưa có bài đăng công khai</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.postCard}
              onPress={() => onOpenPost?.(item.id)}
            >
              {item.imageUrls?.[0] || item.media?.[0]?.url ? (
                <AppImage
                  uri={item.imageUrls?.[0] || item.media?.[0]?.url}
                  style={styles.postImg}
                  contentFit="cover"
                />
              ) : null}
              <Text style={styles.postContent} numberOfLines={3}>
                {item.content}
              </Text>
              <Text style={styles.postMeta}>
                {item.likeCount} thích · {item.commentCount} bình luận
              </Text>
            </Pressable>
          )}
        />
      ) : null}
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: INK },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: INK, marginBottom: 12 },
  retryBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryTxt: { fontWeight: '700', color: INK },
  profileBlock: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#E8E0D2' },
  name: { marginTop: 12, fontSize: 20, fontWeight: '800', color: INK },
  bio: { marginTop: 6, fontSize: 14, color: '#666', textAlign: 'center' },
  statsRow: { flexDirection: 'row', marginTop: 16, gap: 28 },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '800', color: INK },
  statLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  followBtn: {
    marginTop: 16,
    backgroundColor: PRIMARY,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 999,
  },
  followingBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0D6C4' },
  followTxt: { fontWeight: '700', color: INK },
  sectionTitle: {
    alignSelf: 'stretch',
    marginTop: 24,
    fontSize: 16,
    fontWeight: '700',
    color: INK,
  },
  empty: { textAlign: 'center', color: '#999', padding: 24 },
  postCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    paddingBottom: 12,
  },
  postImg: { width: '100%', aspectRatio: 1, backgroundColor: '#EEE' },
  postContent: { paddingHorizontal: 14, paddingTop: 10, color: INK, fontSize: 14 },
  postMeta: { paddingHorizontal: 14, paddingTop: 6, color: '#999', fontSize: 12 },
});

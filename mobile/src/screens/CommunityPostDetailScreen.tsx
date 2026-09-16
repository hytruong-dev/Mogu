import { useEffect, useRef, useState } from 'react';
import {
  Image,
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
  Send,
  Share2,
  X,
} from 'lucide-react-native';
import { communityApi, type ExplorePost, type PostComment } from '../services/api/explore';
import { DetailSkeleton } from '../components/skeletons/ScreenSkeletons';
import { AvatarImage } from '../components/organisms/AvatarImage';
import { Input } from '../components/ui/input';

const C = {
  bg: '#FFF9E8',
  white: '#FFFFFF',
  ink: '#161616',
  secondary: '#626262',
  tertiary: '#929292',
  border: '#E8E0D2',
  yellow: '#FFD54F',
  yellowDark: '#E6A700',
  red: '#FF5F57',
};

type ReplyTarget = { name: string; mention: string } | null;

export function CommunityPostDetailScreen({
  postId,
  onBack,
}: {
  postId?: string | null;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(Boolean(postId));
  const [error, setError] = useState<string | null>(null);
  const [post, setPost] = useState<ExplorePost | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [saved, setSaved] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [postLiked, setPostLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [replying, setReplying] = useState<ReplyTarget>(null);
  const [value, setValue] = useState('');
  const inputRef = useRef<React.ElementRef<typeof Input>>(null);

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

  const beginReply = (name: string, mention: string) => {
    setReplying({ name, mention });
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
      const created = await communityApi.addComment(postId, message);
      setComments((prev) => [...prev, created]);
      setValue('');
      setReplying(null);
    } catch {
      // keep draft
    }
  };

  const toggleLike = async () => {
    if (!postId) return;
    const prevLiked = postLiked;
    const prevCount = likeCount;
    setPostLiked(!prevLiked);
    setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);
    try {
      const res = await communityApi.toggleLike(postId);
      setPostLiked(res.liked);
    } catch {
      setPostLiked(prevLiked);
      setLikeCount(prevCount);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
        <View style={s.header}>
          <Pressable onPress={onBack} style={s.iconButton}>
            <ArrowLeft size={27} />
          </Pressable>
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
            <ArrowLeft size={27} />
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: C.ink, fontWeight: '700', textAlign: 'center' }}>
            {error ?? 'Không có dữ liệu'}
          </Text>
          <Pressable onPress={onBack} style={{ marginTop: 16 }}>
            <Text style={{ color: C.secondary }}>Quay lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const authorName = post.author?.displayName?.trim() || 'Thành viên Mogu';
  const imageUri = post.imageUrls?.[0];

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.header}>
          <Pressable onPress={onBack} style={s.iconButton}>
            <ArrowLeft size={27} />
          </Pressable>
          <Text style={{ flex: 1, fontWeight: '700', fontSize: 16, color: C.ink }} numberOfLines={1}>
            Bài đăng
          </Text>
          <Pressable onPress={() => setSaved((v) => !v)} style={s.iconButton}>
            <Bookmark size={24} fill={saved ? C.yellow : 'transparent'} />
          </Pressable>
          <Pressable style={s.iconButton}>
            <Share2 size={24} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 16,
              marginTop: 8,
            }}
          >
            <AvatarImage uri={post.author?.avatarUrl} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: C.ink }}>{authorName}</Text>
              <Text style={{ color: C.tertiary, fontSize: 12 }}>
                {new Date(post.createdAt).toLocaleString('vi-VN')}
              </Text>
            </View>
            <Pressable
              onPress={() => setFollowed((f) => !f)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: followed ? C.border : C.yellow,
              }}
            >
              <Text style={{ fontWeight: '600', fontSize: 12 }}>
                {followed ? 'Đang follow' : 'Follow'}
              </Text>
            </Pressable>
          </View>

          <Text
            style={{
              marginHorizontal: 16,
              marginTop: 14,
              fontSize: 16,
              lineHeight: 24,
              color: C.ink,
            }}
          >
            {post.content}
          </Text>

          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={{ width: '100%', height: 280, marginTop: 14 }}
              resizeMode="cover"
            />
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              gap: 20,
              paddingHorizontal: 16,
              marginTop: 14,
              alignItems: 'center',
            }}
          >
            <Pressable
              onPress={toggleLike}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Heart
                size={22}
                color={postLiked ? C.red : C.ink}
                fill={postLiked ? C.red : 'transparent'}
              />
              <Text style={{ fontWeight: '600' }}>{likeCount}</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MessageCircle size={22} />
              <Text style={{ fontWeight: '600' }}>{comments.length}</Text>
            </View>
          </View>

          <Text style={{ marginHorizontal: 16, marginTop: 22, fontWeight: '700', fontSize: 16 }}>
            Bình luận
          </Text>
          {comments.length === 0 ? (
            <Text style={{ marginHorizontal: 16, marginTop: 8, color: C.secondary }}>
              Chưa có bình luận.
            </Text>
          ) : (
            comments.map((c) => (
              <View key={c.id} style={{ marginHorizontal: 16, marginTop: 14 }}>
                <Text style={{ fontWeight: '700', color: C.ink }}>
                  {c.author?.displayName?.trim() || 'Thành viên'}
                </Text>
                <Text style={{ marginTop: 4, color: C.ink, lineHeight: 20 }}>{c.content}</Text>
                <Pressable
                  onPress={() =>
                    beginReply(
                      c.author?.displayName || 'Thành viên',
                      (c.author?.displayName || 'user').replace(/\s+/g, ''),
                    )
                  }
                  style={{ marginTop: 6 }}
                >
                  <Text style={{ color: C.secondary, fontSize: 12 }}>Trả lời</Text>
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: C.border,
            padding: 12,
            backgroundColor: C.white,
          }}
        >
          {replying ? (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <Text style={{ color: C.secondary, fontSize: 12 }}>Trả lời @{replying.mention}</Text>
              <Pressable onPress={cancelReply}>
                <X size={16} color={C.secondary} />
              </Pressable>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Input
              ref={inputRef}
              value={value}
              onChangeText={setValue}
              placeholder="Viết bình luận..."
              className="min-h-10 flex-1 rounded-full px-3.5"
            />
            <Pressable
              onPress={sendComment}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: C.yellow,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Send size={18} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 4,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

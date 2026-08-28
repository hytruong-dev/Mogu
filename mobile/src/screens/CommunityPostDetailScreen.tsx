import { useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  Heart,
  ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Send,
  Share2,
  Smile,
  Sparkles,
  X,
} from 'lucide-react-native';

const C = {
  bg: '#FFF9E8',
  white: '#FFFFFF',
  ink: '#161616',
  secondary: '#626262',
  tertiary: '#929292',
  border: '#E8E0D2',
  connector: '#DDD6C9',
  selected: '#FFF8DC',
  yellow: '#FFD54F',
  yellowDark: '#E6A700',
  red: '#FF5F57',
};
const avatar = require('../assets/images/home/avatar.jpg');
const food = require('../assets/images/random/bun-rieu.jpg');

type ReplyTarget = { name: string; mention: string } | null;

export function CommunityPostDetailScreen({ onBack }: { onBack: () => void }) {
  const [saved, setSaved] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [postLiked, setPostLiked] = useState(true);
  const [replying, setReplying] = useState<ReplyTarget>(null);
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);

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
  const sendComment = () => {
    const message = value.trim();
    if (!message) return;
    setSubmitted((items) => [message, ...items]);
    setValue('');
    setReplying(null);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.header}>
          <Pressable onPress={onBack} style={s.iconButton}>
            <ArrowLeft size={27} />
          </Pressable>
          <Text style={s.headerTitle}>Bài viết</Text>
          <View style={s.headerRight}>
            <Pressable onPress={() => setSaved(!saved)} style={s.iconButton}>
              <Bookmark size={25} fill={saved ? C.yellow : 'transparent'} />
            </Pressable>
            <Pressable style={s.iconButton}>
              <MoreHorizontal size={25} />
            </Pressable>
          </View>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.postCard}>
            <View style={s.authorRow}>
              <Image source={avatar} style={s.authorAvatar} />
              <View style={s.flex}>
                <Text style={s.authorName}>Hương Giang</Text>
                <Text style={s.time}>15 phút</Text>
              </View>
              <Pressable
                onPress={() => setFollowed(!followed)}
                style={[s.follow, followed && s.followed]}
              >
                {!followed && <Plus size={20} />}
                <Text style={s.followText}>{followed ? 'Đang theo dõi' : 'Theo dõi'}</Text>
              </Pressable>
            </View>
            <Text style={s.postText}>Hôm nay Mogu chọn Bún bò Huế cho mình!</Text>
            <View style={s.imageWrap}>
              <Image source={food} style={s.postImage} />
              <View style={s.randomBadge}>
                <Sparkles size={15} />
                <Text style={s.randomText}>Kết quả Random</Text>
              </View>
            </View>
            <View style={s.stats}>
              <Pressable onPress={() => setPostLiked(!postLiked)} style={s.stat}>
                <Heart
                  size={25}
                  color={postLiked ? C.red : C.secondary}
                  fill={postLiked ? C.red : 'transparent'}
                />
                <Text style={[s.statText, postLiked && { color: C.red }]}>Yêu thích</Text>
                <Text style={s.statCount}>{postLiked ? '128' : '127'}</Text>
              </Pressable>
              <View style={s.stat}>
                <MessageCircle size={24} color={C.secondary} />
                <Text style={s.statCount}>24</Text>
              </View>
              <View style={s.stat}>
                <Share2 size={24} color={C.secondary} />
                <Text style={s.statText}>Chia sẻ</Text>
              </View>
            </View>
          </View>

          <View style={s.commentsCard}>
            <View style={s.commentsHeader}>
              <Text style={s.commentsTitle}>24 bình luận</Text>
              <Pressable style={s.sort}>
                <Text style={s.sortText}>Phù hợp nhất</Text>
                <ChevronDown size={17} color={C.secondary} />
              </Pressable>
            </View>
            <Comment
              name="Minh Quân"
              time="10 phút"
              text="Nhìn ngon quá! Quán này ở đâu vậy bạn?"
              likes={8}
              selected={replying?.name === 'Minh Quân'}
              onReply={() => beginReply('Minh Quân', 'MinhQuân')}
            />
            <View style={s.replyThread}>
              <View style={s.connector} />
              <Reply
                name="Hương Giang"
                time="8 phút"
                mention="@Minh Quân"
                text="Mình ăn ở quận 1 nha, mình gửi địa chỉ nhé!"
                likes={6}
                onReply={() => beginReply('Hương Giang', 'HươngGiang')}
              />
              <Text style={s.moreReplies}>Xem thêm 3 phản hồi</Text>
            </View>
            <Comment
              name="Lan Anh"
              time="12 phút"
              text="Mình cũng vừa random ra món này hôm qua 😍"
              likes={5}
              selected={replying?.name === 'Lan Anh'}
              onReply={() => beginReply('Lan Anh', 'LanAnh')}
            />
            <Comment
              name="Quang Huy"
              time="18 phút"
              text="Bún bò Huế là chân ái luôn! 😋"
              likes={3}
              selected={replying?.name === 'Quang Huy'}
              onReply={() => beginReply('Quang Huy', 'QuangHuy')}
            />
            {submitted.map((text, index) => (
              <Comment
                key={`${text}-${index}`}
                name="Bạn"
                time="Đang gửi"
                text={text}
                likes={0}
                selected={false}
                onReply={() => beginReply('Bạn', 'Bạn')}
              />
            ))}
          </View>
          <View style={{ height: 90 }} />
        </ScrollView>
        <Composer
          replying={replying}
          value={value}
          setValue={setValue}
          inputRef={inputRef}
          onCancel={cancelReply}
          onSend={sendComment}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Comment({
  name,
  time,
  text,
  likes,
  selected,
  onReply,
}: {
  name: string;
  time: string;
  text: string;
  likes: number;
  selected: boolean;
  onReply: () => void;
}) {
  const [liked, setLiked] = useState(false);
  return (
    <View style={[s.comment, selected && s.commentSelected]}>
      <Image source={avatar} style={s.commentAvatar} />
      <View style={s.commentContent}>
        <View style={s.bubble}>
          <Text style={s.commentName}>{name}</Text>
          <Text style={s.commentText}>{text}</Text>
        </View>
        <View style={s.commentActions}>
          <Text style={s.time}>{time}</Text>
          <Pressable onPress={() => setLiked(!liked)}>
            <Text style={[s.actionText, liked && { color: C.red }]}>Thích</Text>
          </Pressable>
          <Text style={s.dot}>·</Text>
          <Pressable onPress={onReply}>
            <Text style={s.actionText}>Trả lời</Text>
          </Pressable>
          <View style={s.likeCount}>
            <Heart size={18} color={C.red} fill={C.red} />
            <Text style={s.time}>{likes + (liked ? 1 : 0)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function Reply({
  name,
  time,
  mention,
  text,
  likes,
  onReply,
}: {
  name: string;
  time: string;
  mention: string;
  text: string;
  likes: number;
  onReply: () => void;
}) {
  return (
    <View style={s.reply}>
      <Image source={avatar} style={s.replyAvatar} />
      <View style={s.commentContent}>
        <View style={s.replyBubble}>
          <Text style={s.commentName}>{name}</Text>
          <Text style={s.commentText}>
            <Text style={s.mention}>{mention} </Text>
            {text}
          </Text>
        </View>
        <View style={s.commentActions}>
          <Text style={s.time}>{time}</Text>
          <Text style={s.actionText}>Thích</Text>
          <Text style={s.dot}>·</Text>
          <Pressable onPress={onReply}>
            <Text style={s.actionText}>Trả lời</Text>
          </Pressable>
          <View style={s.likeCount}>
            <Heart size={18} color={C.red} fill={C.red} />
            <Text style={s.time}>{likes}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function Composer({
  replying,
  value,
  setValue,
  inputRef,
  onCancel,
  onSend,
}: {
  replying: ReplyTarget;
  value: string;
  setValue: (v: string) => void;
  inputRef: React.RefObject<TextInput | null>;
  onCancel: () => void;
  onSend: () => void;
}) {
  return (
    <View style={s.composerWrap}>
      {replying && (
        <View style={s.replyingBar}>
          <Text style={s.replyingText}>
            Đang trả lời <Text style={{ fontWeight: '700' }}>{replying.name}</Text>
          </Text>
          <Pressable onPress={onCancel} style={s.smallButton}>
            <X size={20} />
          </Pressable>
        </View>
      )}
      <View style={s.composer}>
        <Image source={avatar} style={s.composerAvatar} />
        <View style={s.inputWrap}>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={setValue}
            onSubmitEditing={onSend}
            style={s.input}
            placeholder="Viết bình luận..."
            placeholderTextColor={C.tertiary}
          />
          <ImageIcon size={22} color={C.secondary} />
        </View>
        <Pressable style={s.smallButton}>
          <Smile size={25} color={C.secondary} />
        </Pressable>
        <Pressable
          onPress={onSend}
          disabled={!value.trim()}
          style={[s.send, !value.trim() && s.sendDisabled]}
        >
          <Send size={23} color={C.ink} fill={value.trim() ? C.ink : 'transparent'} />
        </Pressable>
      </View>
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
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  header: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: C.ink },
  headerRight: { flexDirection: 'row' },
  content: { paddingHorizontal: 14, paddingBottom: 8 },
  postCard: { backgroundColor: C.white, borderRadius: 20, padding: 14, marginTop: 10, ...shadow },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  authorAvatar: { width: 48, height: 48, borderRadius: 24 },
  authorName: { fontSize: 16, lineHeight: 21, fontWeight: '600' },
  time: { fontSize: 12, lineHeight: 17, color: C.tertiary },
  follow: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.yellowDark,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  followed: { backgroundColor: C.selected },
  followText: { fontSize: 14, fontWeight: '600' },
  postText: { fontSize: 16, lineHeight: 24, color: C.ink, marginVertical: 16 },
  imageWrap: { height: 330, borderRadius: 16, overflow: 'hidden' },
  postImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  randomBadge: {
    position: 'absolute',
    left: 12,
    top: 12,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: C.yellow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  randomText: { fontSize: 13, fontWeight: '500' },
  stats: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statText: { fontSize: 14, color: C.secondary },
  statCount: { fontSize: 14, color: C.secondary },
  commentsCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 14,
    marginTop: 16,
    ...shadow,
  },
  commentsHeader: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commentsTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  sort: { height: 40, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sortText: { fontSize: 14, color: C.secondary },
  comment: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderRadius: 16 },
  commentSelected: { backgroundColor: C.selected, paddingHorizontal: 8 },
  commentAvatar: { width: 40, height: 40, borderRadius: 20 },
  commentContent: { flex: 1 },
  bubble: { backgroundColor: '#F8F8F8', borderRadius: 16, padding: 12 },
  commentName: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  commentText: { fontSize: 15, lineHeight: 22, color: '#282828', marginTop: 4 },
  commentActions: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
  },
  actionText: { fontSize: 12, lineHeight: 17, fontWeight: '500', color: C.secondary },
  dot: { color: C.secondary },
  likeCount: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5 },
  replyThread: { marginLeft: 42, position: 'relative' },
  connector: {
    position: 'absolute',
    left: 7,
    top: -14,
    bottom: 26,
    width: 1.5,
    backgroundColor: C.connector,
  },
  reply: { flexDirection: 'row', gap: 10, paddingLeft: 18, paddingTop: 6 },
  replyAvatar: { width: 32, height: 32, borderRadius: 16 },
  replyBubble: { backgroundColor: '#F8F8F8', borderRadius: 16, padding: 12 },
  mention: { fontWeight: '600', color: C.yellowDark },
  moreReplies: { fontSize: 14, color: C.secondary, marginLeft: 24, marginVertical: 12 },
  composerWrap: { backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border },
  replyingBar: {
    height: 42,
    paddingHorizontal: 20,
    backgroundColor: C.selected,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  replyingText: { fontSize: 13, color: C.ink },
  composer: {
    minHeight: 68,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  composerAvatar: { width: 38, height: 38, borderRadius: 19 },
  inputWrap: {
    flex: 1,
    minHeight: 50,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 25,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: { flex: 1, fontSize: 15, color: C.ink },
  smallButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { backgroundColor: '#EEE9DB' },
});

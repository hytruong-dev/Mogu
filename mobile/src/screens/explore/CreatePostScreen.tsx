import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  ChevronDown,
  ChevronRight,
  Globe,
  ImagePlus,
  Camera,
  Images,
  MapPin,
  UtensilsCrossed,
  X,
} from 'lucide-react-native';
import { Button } from '../../components/ui/button';
import { Text } from '../../components/ui/text';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { AppImage } from '../../components/ui/app-image';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { AvatarImage } from '../../components/organisms/AvatarImage';
import { profileApi } from '../../services/api/profile';
import {
  communityApi,
  type ExplorePost,
  type PlaceItem,
  type PostVisibility,
} from '../../services/api/explore';
import { recordPostCreatedStore, recordPostUpdatedStore } from '../../services/app-store';
import { uploadSignedImage } from '../../services/uploads/signed-image';
import { AudienceSheet } from './AudienceSheet';
import { DishPickerSheet } from './DishPickerSheet';
import { PlacePickerSheet } from './PlacePickerSheet';

const CAPTION_MAX = 500;
const MEDIA_MAX = 5;
const SUGGESTED_TAGS = ['monngon', 'homnayangi', 'healthy', 'ankieng', 'amthuc', 'review'];

type LocalMedia = {
  localId: string;
  uri: string;
  mediaId?: string;
  webFile?: any;
  status: 'uploading' | 'ready' | 'error';
  progress: number;
  mimeType: string;
  width?: number;
  height?: number;
  sizeBytes: number;
};

type AttachedDish = { id: string; name: string; thumbnailUrl: string | null };

type Props = {
  onClose: () => void;
  onPublished: (post: ExplorePost) => void;
  /** When set, loads the post and PATCHes on submit */
  editPostId?: string | null;
};

const VIS_LABEL: Record<PostVisibility, string> = {
  PUBLIC: 'Mọi người',
  FOLLOWERS: 'Người theo dõi',
  PRIVATE: 'Chỉ mình tôi',
};

/** Always returns a UUID v4 — backend validates clientRequestId with @IsUUID(). */
function newId(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  // RFC 4122 v4 fallback (no crypto.randomUUID, e.g. older RN / some webviews)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function CreatePostScreen({ onClose, onPublished, editPostId }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.max(screenWidth - 32, 280);
  const cardHeight = Math.min(Math.round(cardWidth * 0.72), 260);
  const isEditing = Boolean(editPostId);

  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('PUBLIC');
  const [media, setMedia] = useState<LocalMedia[]>([]);
  const multiCardWidth = media.length > 1 ? Math.round(cardWidth * 0.82) : cardWidth;
  const [dish, setDish] = useState<AttachedDish | null>(null);
  const [place, setPlace] = useState<PlaceItem | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('Bạn');
  const [loadingEdit, setLoadingEdit] = useState(Boolean(editPostId));

  const [audienceOpen, setAudienceOpen] = useState(false);
  const [dishOpen, setDishOpen] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const clientRequestId = useRef(newId());
  const publishingLock = useRef(false);

  const handleToggleTag = (tag: string) => {
    const tagWithHash = `#${tag}`;
    if (caption.includes(tagWithHash)) {
      setCaption((prev) => prev.replace(tagWithHash, '').replace(/\s+/g, ' ').trim());
    } else {
      setCaption((prev) => (prev ? `${prev.trim()} ${tagWithHash}` : tagWithHash).slice(0, CAPTION_MAX));
    }
  };

  useEffect(() => {
    void profileApi
      .me<{
        displayName?: string | null;
        basic?: { displayName?: string | null };
        avatarUrl?: string | null;
        avatar?: { url?: string | null; thumbnailUrl?: string | null };
      }>()
      .then((me) => {
        setDisplayName(me.basic?.displayName ?? me.displayName ?? 'Bạn');
        setAvatarUrl(me.avatar?.url ?? me.avatar?.thumbnailUrl ?? me.avatarUrl ?? null);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!editPostId) {
      setLoadingEdit(false);
      return;
    }
    setLoadingEdit(true);
    void communityApi
      .getPost(editPostId)
      .then((post) => {
        setCaption(post.content ?? '');
        setVisibility(post.visibility ?? 'PUBLIC');
        if (post.dish) {
          setDish({
            id: post.dish.id,
            name: post.dish.name,
            thumbnailUrl: post.dish.thumbnailUrl ?? null,
          });
        }
        if (post.place) {
          setPlace({
            id: post.place.id,
            provider: post.place.provider,
            providerPlaceId: post.place.providerPlaceId,
            name: post.place.name,
            addressShort: post.place.addressShort,
            lat: post.place.lat,
            lng: post.place.lng,
            thumbnailUrl: post.place.thumbnailUrl,
          });
        }
        const existingMedia: LocalMedia[] = (post.media ?? [])
          .slice()
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          .map((m) => ({
            localId: m.id,
            uri: m.url,
            mediaId: m.id,
            status: 'ready' as const,
            progress: 1,
            mimeType: m.mimeType || 'image/jpeg',
            width: m.width ?? undefined,
            height: m.height ?? undefined,
            sizeBytes: 0,
          }));
        if (!existingMedia.length && post.imageUrls?.length) {
          for (const url of post.imageUrls) {
            existingMedia.push({
              localId: newId(),
              uri: url,
              status: 'ready',
              progress: 1,
              mimeType: 'image/jpeg',
              sizeBytes: 0,
            });
          }
        }
        setMedia(existingMedia);
      })
      .catch((e: any) => {
        setError(e?.message || 'Không tải được bài đăng');
      })
      .finally(() => setLoadingEdit(false));
  }, [editPostId]);

  const dirty = useMemo(
    () =>
      Boolean(caption.trim()) ||
      media.length > 0 ||
      Boolean(dish) ||
      Boolean(place) ||
      visibility !== 'PUBLIC',
    [caption, media, dish, place, visibility],
  );

  const canPublish = useMemo(() => {
    const hasContent = Boolean(caption.trim()) || media.some((m) => m.status === 'ready');
    const uploading = media.some((m) => m.status === 'uploading');
    const failed = media.some((m) => m.status === 'error');
    return hasContent && !uploading && !failed && !publishing;
  }, [caption, media, publishing]);

  const requestClose = () => {
    if (publishing) return;
    if (dirty) setDiscardOpen(true);
    else onClose();
  };

  const uploadOne = async (item: LocalMedia) => {
    try {
      const intent = await communityApi.createMediaIntent({
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
        width: item.width,
        height: item.height,
      });
      await uploadSignedImage(
        {
          uri: item.uri,
          name: `community-${item.localId}.jpg`,
          mimeType: (item.mimeType === 'image/png'
            ? 'image/png'
            : item.mimeType === 'image/webp'
              ? 'image/webp'
              : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp',
          sizeBytes: item.sizeBytes,
          width: item.width,
          height: item.height,
          webFile: item.webFile,
        },
        {
          method: 'PUT',
          url: intent.uploadUrl,
          headers: { 'content-type': item.mimeType },
          expiresAt: intent.expiresAt,
        },
        (percent) => {
          setMedia((prev) =>
            prev.map((m) =>
              m.localId === item.localId ? { ...m, progress: percent } : m,
            ),
          );
        },
      );
      const finalized = await communityApi.finalizeMedia(intent.mediaId);
      if (finalized.status !== 'READY') {
        throw new Error('Ảnh chưa sẵn sàng');
      }
      setMedia((prev) =>
        prev.map((m) =>
          m.localId === item.localId
            ? { ...m, mediaId: intent.mediaId, status: 'ready', progress: 100 }
            : m,
        ),
      );
    } catch (err: any) {
      console.error('Community media upload failed:', err);
      setMedia((prev) =>
        prev.map((m) =>
          m.localId === item.localId ? { ...m, status: 'error', progress: 0 } : m,
        ),
      );
    }
  };

  const enqueueAssets = (assets: ImagePicker.ImagePickerAsset[]) => {
    const remaining = MEDIA_MAX - media.length;
    if (remaining <= 0) return;
    if (assets.length > remaining) {
      setError(`Chỉ có thể thêm tối đa ${MEDIA_MAX} ảnh (đã chọn ${remaining} ảnh).`);
    }
    const next: LocalMedia[] = assets.slice(0, remaining).map((asset) => ({
      localId: newId(),
      uri: asset.uri,
      webFile: (asset as any).file ?? null,
      status: 'uploading' as const,
      progress: 0,
      mimeType: asset.mimeType || (asset as any).file?.type || 'image/jpeg',
      width: asset.width,
      height: asset.height,
      sizeBytes: asset.fileSize || (asset as any).file?.size || 500_000,
    }));
    setMedia((prev) => [...prev, ...next]);
    for (const item of next) {
      void uploadOne(item);
    }
  };

  const pickImages = async () => {
    const remaining = MEDIA_MAX - media.length;
    if (remaining <= 0) {
      setError(`Bạn đã chọn tối đa ${MEDIA_MAX} ảnh.`);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Cần quyền thư viện ảnh để thêm hình.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      orderedSelection: true,
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.length) return;
    enqueueAssets(result.assets);
  };

  const pickFromCamera = async () => {
    if (media.length >= MEDIA_MAX) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError('Cần quyền camera để chụp ảnh.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.length) return;
    enqueueAssets(result.assets);
  };

  const removeMedia = (localId: string) => {
    const found = media.find((m) => m.localId === localId);
    setMedia((prev) => prev.filter((m) => m.localId !== localId));
    if (found?.mediaId) {
      void communityApi.deleteMedia(found.mediaId).catch(() => undefined);
    }
  };

  const retryMedia = (localId: string) => {
    const found = media.find((m) => m.localId === localId);
    if (!found) return;
    setMedia((prev) =>
      prev.map((m) =>
        m.localId === localId ? { ...m, status: 'uploading', progress: 0 } : m,
      ),
    );
    void uploadOne({ ...found, status: 'uploading', progress: 0 });
  };

  const publish = async () => {
    if (!canPublish || publishingLock.current || loadingEdit) return;
    publishingLock.current = true;
    setPublishing(true);
    setError('');
    try {
      const readyIds = media
        .filter((m) => m.status === 'ready' && m.mediaId)
        .map((m) => m.mediaId!) as string[];

      if (isEditing && editPostId) {
        const post = await communityApi.updatePost(editPostId, {
          content: caption.trim(),
          mediaIds: readyIds.length ? readyIds : undefined,
          dishId: dish?.id,
          placeId: place?.id,
          visibility,
        });
        recordPostUpdatedStore(post);
        onPublished(post);
        return;
      }

      // Guard: BE @IsUUID() — regenerate if ref still holds a non-UUID (e.g. old HMR session)
      const uuidRe =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRe.test(clientRequestId.current)) {
        clientRequestId.current = newId();
      }
      const post = await communityApi.createPost({
        content: caption.trim(),
        mediaIds: readyIds.length ? readyIds : undefined,
        dishId: dish?.id,
        placeId: place?.id,
        visibility,
        commentsEnabled: true,
        status: 'ACTIVE',
        clientRequestId: clientRequestId.current,
      });
      recordPostCreatedStore(post);
      onPublished(post);
    } catch (e: any) {
      setError(e?.message || (isEditing ? 'Không thể lưu bài' : 'Không thể đăng bài'));
      publishingLock.current = false;
      setPublishing(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FFF9E8]" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="h-14 flex-row items-center justify-between px-3">
          <Pressable
            onPress={requestClose}
            className="h-10 w-10 items-center justify-center"
            accessibilityLabel="Đóng"
          >
            <X size={22} color="#161616" />
          </Pressable>
          <Text className="text-[17px] font-extrabold text-[#161616]">
            {isEditing ? 'Sửa bài viết' : 'Tạo bài viết'}
          </Text>
          <Button
            size="sm"
            className="h-9 rounded-full px-4"
            style={{
              backgroundColor: canPublish && !loadingEdit ? '#FFD54F' : '#E5E5E5',
              opacity: publishing ? 0.7 : 1,
            }}
            disabled={!canPublish || loadingEdit}
            onPress={() => void publish()}
          >
            {publishing ? (
              <ActivityIndicator color="#161616" />
            ) : (
              <Text
                className="font-extrabold"
                style={{ color: canPublish && !loadingEdit ? '#161616' : '#9A9A9A' }}
              >
                {isEditing ? 'Lưu' : 'Đăng'}
              </Text>
            )}
          </Button>
        </View>

        {loadingEdit ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#161616" />
          </View>
        ) : (
          <>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-10"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mt-2 flex-row items-center gap-3">
            <AvatarImage uri={avatarUrl} size={44} />
            <View className="flex-1">
              <Text className="text-[15px] font-bold text-[#161616]" numberOfLines={1}>
                {displayName}
              </Text>
              <Pressable
                onPress={() => setAudienceOpen(true)}
                className="mt-1 h-8 flex-row items-center self-start rounded-full bg-[#F3EFE6] px-3"
              >
                <Globe size={14} color="#161616" />
                <Text className="ml-1.5 text-[12px] font-bold text-[#161616]">
                  {VIS_LABEL[visibility]}
                </Text>
                <ChevronDown size={14} color="#161616" style={{ marginLeft: 4 }} />
              </Pressable>
            </View>
          </View>

          <Textarea
            value={caption}
            onChangeText={(t) => setCaption(t.slice(0, CAPTION_MAX))}
            placeholder="Chia sẻ món ngon hoặc khoảnh khắc của bạn..."
            className="mt-4 min-h-[120px] border-0 bg-transparent p-0 text-[16px] leading-6 shadow-none"
            editable={!publishing}
          />
          <Text className="mb-3 text-right text-[12px] text-[#8A8A8A]">
            {caption.length}/{CAPTION_MAX}
          </Text>

          <View style={{ marginBottom: 14 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {SUGGESTED_TAGS.map((tag) => {
                const active = caption.includes(`#${tag}`);
                return (
                  <Pressable
                    key={tag}
                    onPress={() => handleToggleTag(tag)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: active ? '#FFC20E' : '#F4EFE6',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: active ? '#111111' : '#6A6560',
                      }}
                    >
                      #{tag}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {media.length === 0 ? (
            <Pressable
              onPress={() => void pickImages()}
              style={{
                height: 140,
                borderRadius: 16,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: '#D6CDBE',
                backgroundColor: '#FFFDF7',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
              accessibilityLabel="Thêm ảnh"
            >
              <ImagePlus size={28} color="#8A8A8A" />
              <Text style={{ marginTop: 8, fontSize: 15, fontWeight: '700', color: '#161616' }}>
                Thêm ảnh
              </Text>
              <Text style={{ marginTop: 4, fontSize: 13, color: '#8A8A8A' }}>
                Tối đa {MEDIA_MAX} ảnh
              </Text>
            </Pressable>
          ) : (
            <View style={{ marginBottom: 16 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingRight: 4 }}
              >
                {media.map((m, idx) => (
                  <View
                    key={m.localId}
                    style={{
                      width: multiCardWidth,
                      height: cardHeight,
                      borderRadius: 16,
                      overflow: 'hidden',
                      position: 'relative',
                      backgroundColor: '#F0EBE0',
                    }}
                  >
                    <AppImage
                      uri={m.uri}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                      borderRadius={16}
                    />

                    <View
                      style={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        backgroundColor: 'rgba(0, 0, 0, 0.65)',
                        paddingHorizontal: 9,
                        paddingVertical: 4,
                        borderRadius: 999,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
                        {idx + 1}/{media.length}
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => removeMedia(m.localId)}
                      style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        backgroundColor: 'rgba(0, 0, 0, 0.65)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      accessibilityLabel="Xóa ảnh"
                    >
                      <X size={16} color="#FFFFFF" />
                    </Pressable>

                    {m.status === 'uploading' ? (
                      <View
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: 'rgba(0, 0, 0, 0.45)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                        }}
                      >
                        <ActivityIndicator color="#FFD54F" size="small" />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
                          Đang tải {Math.round(m.progress)}%
                        </Text>
                      </View>
                    ) : null}

                    {m.status === 'error' ? (
                      <Pressable
                        onPress={() => retryMedia(m.localId)}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: 'rgba(0, 0, 0, 0.55)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          padding: 12,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: '#FFFFFF',
                            textAlign: 'center',
                          }}
                        >
                          Tải ảnh thất bại
                        </Text>
                        <View
                          style={{
                            backgroundColor: '#FFD54F',
                            paddingHorizontal: 12,
                            paddingVertical: 5,
                            borderRadius: 999,
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#161616' }}>
                            Thử lại
                          </Text>
                        </View>
                      </Pressable>
                    ) : null}
                  </View>
                ))}

                {media.length < MEDIA_MAX ? (
                  <Pressable
                    onPress={() => void pickImages()}
                    style={{
                      width: 120,
                      height: cardHeight,
                      borderRadius: 16,
                      borderWidth: 1.5,
                      borderStyle: 'dashed',
                      borderColor: '#D6CDBE',
                      backgroundColor: '#FFFDF7',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                    accessibilityLabel="Thêm ảnh"
                  >
                    <ImagePlus size={26} color="#8A8A8A" />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#161616' }}>
                      Thêm ảnh
                    </Text>
                    <Text style={{ fontSize: 11, color: '#8A8A8A' }}>
                      {media.length}/{MEDIA_MAX}
                    </Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            </View>
          )}

          <Separator className="mb-1" />

          {dish ? (
            <View className="min-h-14 flex-row items-center gap-3 py-3">
              <Pressable
                onPress={() => setDishOpen(true)}
                className="flex-1 flex-row items-center gap-3"
              >
                <AppImage
                  uri={dish.thumbnailUrl}
                  className="h-11 w-11 rounded-xl"
                  contentFit="cover"
                />
                <View className="flex-1">
                  <Text className="text-[12px] text-[#8A8A8A]">Món ăn</Text>
                  <Text className="text-[15px] font-bold text-[#161616]" numberOfLines={1}>
                    {dish.name}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => setDish(null)}
                className="h-9 w-9 items-center justify-center rounded-full bg-[#F3EFE6]"
              >
                <X size={16} color="#161616" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setDishOpen(true)}
              className="min-h-14 flex-row items-center gap-3 py-3"
            >
              <UtensilsCrossed size={20} color="#161616" />
              <Text className="flex-1 text-[15px] font-semibold text-[#161616]">Gắn món ăn</Text>
              <ChevronRight size={18} color="#8A8A8A" />
            </Pressable>
          )}

          <Separator />

          {place ? (
            <View className="min-h-14 flex-row items-center gap-3 py-3">
              <Pressable
                onPress={() => setPlaceOpen(true)}
                className="flex-1 flex-row items-center gap-3"
              >
                <View className="h-11 w-11 items-center justify-center rounded-xl bg-[#FFF1B3]">
                  <MapPin size={20} color="#161616" />
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-bold text-[#161616]" numberOfLines={1}>
                    {place.name}
                  </Text>
                  {place.addressShort ? (
                    <Text className="text-[12px] text-[#8A8A8A]" numberOfLines={1}>
                      {place.addressShort}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              <Pressable
                onPress={() => setPlace(null)}
                className="h-9 w-9 items-center justify-center rounded-full bg-[#F3EFE6]"
              >
                <X size={16} color="#161616" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setPlaceOpen(true)}
              className="min-h-14 flex-row items-center gap-3 py-3"
            >
              <MapPin size={20} color="#161616" />
              <Text className="flex-1 text-[15px] font-semibold text-[#161616]">
                Thêm địa điểm
              </Text>
              <ChevronRight size={18} color="#8A8A8A" />
            </Pressable>
          )}

          <Text className="mt-6 text-center text-[12px] leading-5 text-[#8A8A8A]">
            Bài viết của bạn sẽ hiển thị trong Cộng đồng.
          </Text>

          {error ? (
            <Text className="mt-3 text-[13px] font-semibold text-[#DC2626]">{error}</Text>
          ) : null}
        </ScrollView>

        <View className="flex-row gap-3 border-t border-[#EFE8DC] px-4 py-3">
          <Pressable
            onPress={() => void pickImages()}
            className="h-12 w-12 items-center justify-center rounded-2xl bg-[#F3EFE6]"
            accessibilityLabel="Thư viện ảnh"
            disabled={media.length >= MEDIA_MAX}
            style={media.length >= MEDIA_MAX ? { opacity: 0.4 } : undefined}
          >
            <Images size={22} color="#161616" />
          </Pressable>
          <Pressable
            onPress={() => void pickFromCamera()}
            className="h-12 w-12 items-center justify-center rounded-2xl bg-[#F3EFE6]"
            accessibilityLabel="Chụp ảnh"
            disabled={media.length >= MEDIA_MAX}
            style={media.length >= MEDIA_MAX ? { opacity: 0.4 } : undefined}
          >
            <Camera size={22} color="#161616" />
          </Pressable>
        </View>
          </>
        )}
      </KeyboardAvoidingView>

      <AudienceSheet
        open={audienceOpen}
        value={visibility}
        onOpenChange={setAudienceOpen}
        onSelect={setVisibility}
        enforceEnabled
      />
      <DishPickerSheet
        open={dishOpen}
        onOpenChange={setDishOpen}
        selectedId={dish?.id}
        onConfirm={setDish}
      />
      <PlacePickerSheet
        open={placeOpen}
        onOpenChange={setPlaceOpen}
        selectedId={place?.id}
        onConfirm={setPlace}
      />

      <ConfirmDialog
        visible={discardOpen}
        title="Bỏ bản nháp?"
        description="Bạn sẽ mất caption, ảnh và các gắn kèm chưa đăng."
        confirmLabel="Bỏ"
        cancelLabel="Tiếp tục chỉnh"
        tone="warning"
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => {
          setDiscardOpen(false);
          onClose();
        }}
      />
    </SafeAreaView>
  );
}

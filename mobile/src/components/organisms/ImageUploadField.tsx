/**
 * ImageUploadField — shared upload UI theo design Mogu 100%
 * States: empty | source sheet | uploading | success | error
 * Design: docs/assets/mobile-image-upload-component-design.png
 */
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ImageSourcePropType,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import {
  Camera,
  ChevronRight,
  FileImage,
  Image as ImageIcon,
  ImagePlus,
  UserRound,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDialog } from '../ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Text as UiText } from '../ui/text';
import { AvatarCropModal } from './AvatarCropModal';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const YELLOW = '#FFC51A';
const INK = '#161616';
const MUTED = '#8A8A8A';
const BORDER = '#D4D0C8';
const CREAM = '#F5F2EC';
const WHITE = '#FFFFFF';
const ERROR = '#E53935';
const ERROR_BG = '#FFF1F0';
const ERROR_BORDER = '#F5A8A4';
const ERROR_BTN_BG = '#FCE8E6';

export type UploadImage = {
  uri: string;
  name: string;
  mimeType: (typeof ALLOWED_MIME_TYPES)[number];
  sizeBytes: number;
  width?: number;
  height?: number;
  webFile?: globalThis.File;
};

type ImageUploadFieldProps = {
  value?: string | null;
  fallback?: ImageSourcePropType;
  /** Visual density; default matches shared design card (280dp). */
  variant?: 'avatar' | 'square' | 'landscape';
  label?: string;
  hint?: string;
  maxSizeBytes?: number;
  disabled?: boolean;
  allowCamera?: boolean;
  allowFiles?: boolean;
  onUpload?: (image: UploadImage, onProgress: (percent: number) => void) => Promise<string | void>;
  onRemove?: () => Promise<void> | void;
  confirmRemove?: boolean;
};

function mimeFromName(name: string) {
  const extension = name.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return null;
}

async function makeUploadImage(
  input: {
    uri: string;
    name?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
    width?: number;
    height?: number;
    webFile?: globalThis.File;
  },
  maxSizeBytes: number,
): Promise<UploadImage> {
  const name = input.name || input.uri.split('/').pop()?.split('?')[0] || 'image.jpg';
  let mimeType = (input.mimeType || mimeFromName(name))?.toLowerCase() || null;
  if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
  if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType as UploadImage['mimeType'])) {
    throw new Error('INVALID_IMAGE');
  }
  let sizeBytes = input.sizeBytes ?? input.webFile?.size;
  if ((!Number.isFinite(sizeBytes) || !sizeBytes) && Platform.OS !== 'web') {
    try {
      sizeBytes = new File(input.uri).size;
    } catch {
      sizeBytes = undefined;
    }
  }
  if ((!Number.isFinite(sizeBytes) || !sizeBytes) && input.webFile?.size) {
    sizeBytes = input.webFile.size;
  }
  // Cropped avatar files sometimes lack File.size — fall back to blob length
  if ((!Number.isFinite(sizeBytes) || !sizeBytes) && input.uri) {
    try {
      const res = await fetch(input.uri);
      const blob = await res.blob();
      if (blob.size > 0) sizeBytes = blob.size;
    } catch {
      // ignore
    }
  }
  if (!Number.isFinite(sizeBytes) || !sizeBytes || sizeBytes <= 0) {
    throw new Error('INVALID_IMAGE');
  }
  if (sizeBytes > maxSizeBytes) {
    throw new Error('INVALID_IMAGE');
  }
  return {
    uri: input.uri,
    name,
    mimeType: mimeType as UploadImage['mimeType'],
    sizeBytes: sizeBytes as number,
    width: input.width || undefined,
    height: input.height || undefined,
    webFile: input.webFile,
  };
}

export function ImageUploadField({
  value = null,
  fallback,
  variant = 'landscape',
  label = 'hình ảnh',
  hint,
  maxSizeBytes = MAX_IMAGE_SIZE,
  disabled = false,
  allowCamera = true,
  allowFiles = true,
  onUpload,
  onRemove,
  confirmRemove = true,
}: ImageUploadFieldProps) {
  const insets = useSafeAreaInsets();
  const cancelledRef = useRef(false);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(value);
  const [pendingImage, setPendingImage] = useState<UploadImage | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [confirmRemoveVisible, setConfirmRemoveVisible] = useState(false);
  const [cropVisible, setCropVisible] = useState(false);
  const [cropSource, setCropSource] = useState<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);

  const isAvatar = variant === 'avatar';
  const boxHeight = isAvatar ? 260 : 280;
  const hintText = hint || `JPG, PNG hoặc WebP · Tối đa ${Math.round(maxSizeBytes / 1024 / 1024)} MB`;

  useEffect(() => {
    if (status !== 'uploading' && status !== 'error') setPreviewUri(value);
  }, [value, status]);

  const openCrop = (uri: string, width?: number, height?: number) => {
    if (width && height && width > 0 && height > 0) {
      setCropSource({ uri, width, height });
      setCropVisible(true);
      return;
    }
    Image.getSize(
      uri,
      (w, h) => {
        setCropSource({ uri, width: w || 1000, height: h || 1000 });
        setCropVisible(true);
      },
      () => {
        setCropSource({ uri, width: 1000, height: 1000 });
        setCropVisible(true);
      },
    );
  };

  const onCropConfirm = async (croppedUri: string) => {
    setCropVisible(false);
    setCropSource(null);
    try {
      await upload(
        await makeUploadImage(
          {
            uri: croppedUri,
            name: 'avatar.jpg',
            mimeType: 'image/jpeg',
            sizeBytes: undefined,
            width: 512,
            height: 512,
          },
          maxSizeBytes,
        ),
      );
    } catch (cause) {
      const msg = (cause as { message?: string })?.message || '';
      setError(msg === 'INVALID_IMAGE' ? 'Ảnh không hợp lệ' : msg || 'Ảnh không hợp lệ');
      setStatus('error');
    }
  };

  const upload = async (image: UploadImage) => {
    cancelledRef.current = false;
    setPendingImage(image);
    setPreviewUri(image.uri);
    setError(null);
    setProgress(0);
    setStatus('uploading');
    try {
      const savedUri = await onUpload?.(image, (percent) => {
        if (cancelledRef.current) return;
        setProgress(Math.max(0, Math.min(100, Math.round(percent))));
      });
      if (cancelledRef.current) return;
      if (savedUri) setPreviewUri(savedUri);
      setProgress(100);
      setStatus('success');
      setPendingImage(null);
    } catch (cause) {
      if (cancelledRef.current) return;
      const msg = (cause as { message?: string })?.message || '';
      setError(msg === 'INVALID_IMAGE' ? 'Ảnh không hợp lệ' : msg || 'Ảnh không hợp lệ');
      setStatus('error');
    }
  };

  const cancelUpload = () => {
    cancelledRef.current = true;
    setPendingImage(null);
    setProgress(0);
    setPreviewUri(value);
    setError(null);
    setStatus(value ? 'success' : 'idle');
  };

  const choose = async (source: 'camera' | 'library' | 'file') => {
    setSheetVisible(false);
    try {
      if (Platform.OS !== 'web') {
        await new Promise((resolve) => setTimeout(resolve, 280));
      }
      if (source === 'file') {
        const result = await DocumentPicker.getDocumentAsync({
          type: [...ALLOWED_MIME_TYPES],
          copyToCacheDirectory: true,
          multiple: false,
        });
        if (result.canceled) return;
        const asset = result.assets[0];
        if (!asset) return;
        if (isAvatar) {
          openCrop(asset.uri);
          return;
        }
        await upload(
          await makeUploadImage(
            {
              uri: asset.uri,
              name: asset.name,
              mimeType: asset.mimeType,
              sizeBytes: asset.size,
              webFile: asset.file,
            },
            maxSizeBytes,
          ),
        );
        return;
      }

      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          throw new Error('Cần cấp quyền camera trong cài đặt để chụp ảnh.');
        }
      }
      // Avatar: không dùng allowsEditing hệ thống — mở màn crop riêng kiểu FB/TikTok
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.92,
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;

      if (isAvatar) {
        openCrop(asset.uri, asset.width, asset.height);
        return;
      }

      await upload(
        await makeUploadImage(
          {
            uri: asset.uri,
            name: asset.fileName,
            mimeType: asset.mimeType,
            sizeBytes: asset.fileSize,
            width: asset.width,
            height: asset.height,
            webFile: asset.file,
          },
          maxSizeBytes,
        ),
      );
    } catch (cause) {
      const msg = (cause as { message?: string })?.message || '';
      setError(msg === 'INVALID_IMAGE' ? 'Ảnh không hợp lệ' : msg || 'Ảnh không hợp lệ');
      setStatus('error');
    }
  };

  const executeRemove = async () => {
    setRemoving(true);
    setError(null);
    try {
      await onRemove?.();
      setPendingImage(null);
      setPreviewUri(null);
      setStatus('idle');
    } catch (cause) {
      setError((cause as { message?: string })?.message || 'Không thể xoá ảnh.');
      setStatus('error');
    } finally {
      setRemoving(false);
    }
  };

  const remove = async () => {
    if (removing || status === 'uploading') return;
    if (pendingImage) {
      setPendingImage(null);
      setPreviewUri(value);
      setError(null);
      setStatus(value ? 'success' : 'idle');
      return;
    }
    if (confirmRemove) {
      if (Platform.OS === 'web') {
        if (!globalThis.confirm(`Xoá ${label.toLowerCase()}?`)) return;
        await executeRemove();
      } else {
        setConfirmRemoveVisible(true);
      }
      return;
    }
    await executeRemove();
  };

  const openSheet = () => {
    if (disabled || status === 'uploading' || removing) return;
    setSheetVisible(true);
  };

  const showSuccess = Boolean(previewUri) && status !== 'uploading' && status !== 'error';
  const showUploading = status === 'uploading';
  const showError = status === 'error';
  const showEmpty = !showSuccess && !showUploading && !showError;
  const busy = disabled || status === 'uploading' || removing;

  return (
    <View style={s.root}>
      {/* ── Avatar circle (FB / TikTok) ──────────────────────────────────── */}
      {isAvatar ? (
        <View style={s.avatarRoot}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={previewUri ? 'Đổi ảnh đại diện' : 'Thêm ảnh đại diện'}
            disabled={busy}
            onPress={openSheet}
            activeOpacity={0.88}
            style={s.avatarTap}
          >
            <View style={[s.avatarCircle, showError && s.avatarCircleError]}>
              {showUploading ? (
                <View style={s.avatarLoading}>
                  <Text style={s.avatarLoadingTxt}>{progress}%</Text>
                </View>
              ) : previewUri && !showError ? (
                <Image
                  source={{ uri: previewUri }}
                  style={s.avatarImg}
                  resizeMode="cover"
                  accessibilityLabel={label}
                />
              ) : (
                <UserRound size={36} color={showError ? ERROR : '#9A8B5C'} strokeWidth={1.6} />
              )}
            </View>
            <View style={s.avatarCamBadge}>
              <Camera size={14} color={INK} strokeWidth={2.2} />
            </View>
          </TouchableOpacity>

          {showUploading ? (
            <TouchableOpacity style={s.avatarTextBtn} onPress={cancelUpload} activeOpacity={0.85}>
              <Text style={s.avatarTextBtnMuted}>Huỷ</Text>
            </TouchableOpacity>
          ) : null}

          {showError ? (
            <TouchableOpacity
              style={s.avatarRetry}
              onPress={() => (pendingImage ? upload(pendingImage) : openSheet())}
              activeOpacity={0.88}
            >
              <Text style={s.avatarRetryTxt}>Thử lại</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* ── 1. Empty (landscape / square) ─────────────────────────────────── */}
      {!isAvatar && showEmpty ? (
        <View style={[s.cardShell, { minHeight: boxHeight }]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Chạm để tải ảnh lên"
            disabled={busy}
            onPress={openSheet}
            activeOpacity={0.88}
            style={s.dashedArea}
          >
            <View style={s.iconWrap}>
              <ImageIcon size={40} color="#A8A39A" strokeWidth={1.5} />
              <View style={s.plusBadge}>
                <Text style={s.plusBadgeTxt}>+</Text>
              </View>
            </View>
            <Text style={s.emptyTitle}>Chạm để tải ảnh lên</Text>
            <Text style={s.emptyHint}>{hintText}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Thêm hình ảnh"
            disabled={busy}
            onPress={openSheet}
            activeOpacity={0.9}
            style={s.primaryBtn}
          >
            <Text style={s.primaryBtnTxt}>Thêm hình ảnh</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── 3. Uploading (non-avatar) ─────────────────────────────────────── */}
      {!isAvatar && showUploading ? (
        <View style={s.uploadCard}>
          <View style={s.uploadRow}>
            <Image
              source={{ uri: previewUri || undefined }}
              style={s.uploadThumb}
              resizeMode="cover"
            />
            <View style={s.uploadInfo}>
              <Text style={s.uploadTitle}>Đang tải lên {progress}%</Text>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${Math.max(4, progress)}%` }]} />
              </View>
            </View>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Huỷ tải lên"
            onPress={cancelUpload}
            activeOpacity={0.88}
            style={s.cancelBtn}
          >
            <Text style={s.cancelBtnTxt}>Huỷ</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── 4. Success (non-avatar) ───────────────────────────────────────── */}
      {!isAvatar && showSuccess ? (
        <View style={s.successCard}>
          <View style={[s.successImageWrap, { height: Math.max(200, boxHeight - 72) }]}>
            <Image
              source={previewUri ? { uri: previewUri } : fallback}
              style={s.successImage}
              resizeMode="cover"
              accessibilityLabel={label}
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Đóng ảnh"
              disabled={busy}
              onPress={onRemove ? remove : openSheet}
              activeOpacity={0.85}
              style={s.closeBtn}
              hitSlop={8}
            >
              <X size={16} color={WHITE} strokeWidth={2.6} />
            </TouchableOpacity>
          </View>
          <View style={s.successActions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Thay ảnh"
              disabled={busy}
              onPress={openSheet}
              activeOpacity={0.88}
              style={s.changeBtn}
            >
              <Text style={s.changeBtnTxt}>Thay ảnh</Text>
            </TouchableOpacity>
            {onRemove ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Xoá ảnh"
                disabled={busy}
                onPress={remove}
                activeOpacity={0.88}
                style={s.deleteBtn}
              >
                <Text style={s.deleteBtnTxt}>{removing ? 'Đang xoá…' : 'Xoá'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* ── 5. Error (non-avatar) ─────────────────────────────────────────── */}
      {!isAvatar && showError ? (
        <View style={[s.cardShell, s.errorShell, { minHeight: boxHeight }]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Thử lại tải ảnh"
            disabled={busy}
            onPress={() => (pendingImage ? upload(pendingImage) : openSheet())}
            activeOpacity={0.88}
            style={[s.dashedArea, s.errorDashed]}
          >
            <View style={s.iconWrap}>
              <ImageIcon size={40} color="#C97A76" strokeWidth={1.5} />
              <View style={s.errorBadge}>
                <Text style={s.errorBadgeTxt}>!</Text>
              </View>
            </View>
            <Text style={s.errorTitle}>{error || 'Ảnh không hợp lệ'}</Text>
            <Text style={s.errorHint}>{hintText}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Thử lại"
            disabled={busy}
            onPress={() => (pendingImage ? upload(pendingImage) : openSheet())}
            activeOpacity={0.88}
            style={s.retryBtn}
          >
            <Text style={s.retryBtnTxt}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── 2. Chọn nguồn ảnh — Dialog (react-native-reusables) ───────────── */}
      <Dialog open={sheetVisible} onOpenChange={setSheetVisible}>
        <DialogContent
          showCloseButton={false}
          overlayClassName="items-stretch justify-end p-0"
          className="mb-0 w-full max-w-full gap-1 rounded-none rounded-t-[24px] border-0 px-4 pb-2 pt-3 shadow-none sm:max-w-full"
          style={{ paddingBottom: Math.max(16, insets.bottom + 8) }}
        >
          <View style={s.grabber} />
          <DialogHeader className="px-1 pb-1 pt-1">
            <DialogTitle className="text-left text-[18px] font-extrabold text-[#161616]">
              Chọn nguồn ảnh
            </DialogTitle>
          </DialogHeader>

          {allowCamera && Platform.OS !== 'web' ? (
            <SourceRow icon={Camera} title="Chụp ảnh" onPress={() => choose('camera')} />
          ) : null}
          <SourceRow
            icon={ImagePlus}
            title="Chọn từ thư viện"
            onPress={() => choose('library')}
          />
          {allowFiles ? (
            <SourceRow icon={FileImage} title="Chọn tệp" onPress={() => choose('file')} />
          ) : null}

          <DialogFooter className="mt-2 px-0">
            <Button
              variant="secondary"
              onPress={() => setSheetVisible(false)}
              className="h-12 w-full rounded-3xl bg-[#F0EDE6]"
            >
              <UiText className="font-bold text-[#161616]">Huỷ</UiText>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isAvatar && cropSource ? (
        <AvatarCropModal
          visible={cropVisible}
          uri={cropSource.uri}
          imageWidth={cropSource.width}
          imageHeight={cropSource.height}
          onCancel={() => {
            setCropVisible(false);
            setCropSource(null);
          }}
          onConfirm={(croppedUri) => {
            void onCropConfirm(croppedUri);
          }}
        />
      ) : null}

      <ConfirmDialog
        visible={confirmRemoveVisible}
        tone="danger"
        title={`Xoá ${label.toLowerCase()}?`}
        description="Bạn có thể thêm ảnh mới sau này."
        confirmLabel="Xoá"
        cancelLabel="Huỷ"
        onConfirm={() => {
          setConfirmRemoveVisible(false);
          void executeRemove();
        }}
        onCancel={() => setConfirmRemoveVisible(false)}
      />
    </View>
  );
}

function SourceRow({
  icon: Icon,
  title,
  onPress,
}: {
  icon: typeof Camera;
  title: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      activeOpacity={0.75}
      style={s.sourceRow}
    >
      <View style={s.sourceIconWrap}>
        <Icon size={22} color={INK} strokeWidth={1.8} />
      </View>
      <Text style={s.sourceTitle} numberOfLines={1}>
        {title}
      </Text>
      <ChevronRight size={20} color="#B0ADA6" strokeWidth={2} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: {
    width: '100%',
    alignSelf: 'stretch',
  },

  /* Avatar circle */
  avatarRoot: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 6,
  },
  avatarTap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: CREAM,
    borderWidth: 2,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarCircleError: {
    borderColor: ERROR_BORDER,
    backgroundColor: ERROR_BG,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarLoading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22,22,22,0.45)',
  },
  avatarLoadingTxt: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '800',
  },
  avatarCamBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: YELLOW,
    borderWidth: 2.5,
    borderColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  avatarTextBtnMuted: {
    fontSize: 14,
    fontWeight: '600',
    color: MUTED,
  },
  avatarRetry: {
    marginTop: 2,
    height: 40,
    minWidth: 120,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: ERROR_BTN_BG,
    borderWidth: 1,
    borderColor: ERROR_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRetryTxt: {
    fontSize: 14,
    fontWeight: '800',
    color: ERROR,
  },

  /* Shared card shell (empty / error) — design 328×280 */
  cardShell: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: CREAM,
    padding: 16,
    gap: 16,
  },
  dashedArea: {
    flexGrow: 1,
    minHeight: 160,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 8,
    width: '100%',
  },
  primaryBtn: {
    height: 48,
    minHeight: 48,
    width: '100%',
    borderRadius: 24,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    alignSelf: 'stretch',
  },
  primaryBtnTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: INK,
  },
  iconWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  plusBadge: {
    position: 'absolute',
    right: 6,
    bottom: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#BDB8AE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBadgeTxt: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 17,
    includeFontPadding: false,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 13,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 18,
  },

  /* Uploading */
  uploadCard: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: '#E8E4DC',
    padding: 14,
    gap: 14,
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  uploadThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: CREAM,
  },
  uploadInfo: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  uploadTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: INK,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EAE6DE',
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: YELLOW,
  },
  cancelBtn: {
    height: 48,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: '#F0EDE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: INK,
  },

  /* Success */
  successCard: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: WHITE,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8E4DC',
  },
  successImageWrap: {
    width: '100%',
    position: 'relative',
    backgroundColor: CREAM,
  },
  successImage: {
    width: '100%',
    height: '100%',
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(22,22,22,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  changeBtn: {
    flex: 1,
    height: 48,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: WHITE,
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeBtnTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: INK,
  },
  deleteBtn: {
    flex: 1,
    height: 48,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: ERROR_BTN_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: ERROR,
  },

  /* Error */
  errorShell: {
    backgroundColor: ERROR_BG,
  },
  errorDashed: {
    borderColor: ERROR_BORDER,
    backgroundColor: 'transparent',
  },
  errorBadge: {
    position: 'absolute',
    right: 4,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ERROR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBadgeTxt: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 15,
    includeFontPadding: false,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: ERROR,
    textAlign: 'center',
  },
  errorHint: {
    fontSize: 13,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    height: 48,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: ERROR_BTN_BG,
    borderWidth: 1,
    borderColor: ERROR_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  retryBtnTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: ERROR,
  },

  /* Source sheet (Dialog) */
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D8D4CC',
    marginBottom: 4,
  },
  sourceRow: {
    minHeight: 56,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 0,
    borderRadius: 12,
    flexShrink: 0,
  },
  sourceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: CREAM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: INK,
  },
});

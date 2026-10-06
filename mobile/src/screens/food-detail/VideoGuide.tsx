/**
 * Video hướng dẫn nấu — thẻ xem trước + trình phát toàn màn hình.
 *
 * - `VideoGuideCard`: thumbnail 16:9, nút play, nhãn nền tảng. Dùng ở trang tổng quan.
 * - `VideoGuideRow`: dạng gọn 1 hàng, dùng ở tab "Cách làm".
 * - `VideoPlayerModal`: phát inline bằng WebView (YouTube embed / TikTok player),
 *   luôn có nút "Mở trong YouTube/TikTok" làm phương án dự phòng.
 */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExternalLink, Play, X } from '@/components/icons';
import { StyledPressable as Pressable } from '../../components/ui/styled-pressable';
import { AppImage } from '../../components/ui/app-image';
import { BORDER, INK, MUTED, WHITE, YELLOW } from './tokens';
import { fetchTikTokThumbnail, type CookingVideo } from './video';

const PLATFORM_COLOR: Record<CookingVideo['platform'], string> = {
  youtube: '#FF0033',
  tiktok: '#111111',
  other: '#4B5563',
};

/**
 * YouTube embed từ chối phát khi thiếu Referer/origin hợp lệ (lỗi 152/153 trong WebView).
 * Nhúng iframe trong trang HTML có baseUrl https để request embed luôn mang Referer.
 */
const PLAYER_BASE_URL = 'https://mogu.app/';

function playerSource(video: CookingVideo) {
  if (video.platform !== 'youtube') return { uri: video.embedUrl! };
  const src = `${video.embedUrl}&origin=${encodeURIComponent(PLAYER_BASE_URL.replace(/\/$/, ''))}`;
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><style>html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style></head><body><iframe src="${src}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>`;
  return { html, baseUrl: PLAYER_BASE_URL };
}

function useVideoThumb(video: CookingVideo | null, fallback?: string | null) {
  const [thumb, setThumb] = useState<string | null>(video?.thumbnailUrl ?? null);
  useEffect(() => {
    setThumb(video?.thumbnailUrl ?? null);
    if (!video || video.platform !== 'tiktok') return;
    const ctrl = new AbortController();
    void fetchTikTokThumbnail(video.url, ctrl.signal).then((t) => {
      if (t) setThumb(t);
    });
    return () => ctrl.abort();
  }, [video]);
  return thumb ?? fallback ?? null;
}

export async function openVideoExternally(video: CookingVideo) {
  try {
    await Linking.openURL(video.url);
  } catch {
    // ignore — không có app/trình duyệt xử lý
  }
}

function PlatformBadge({ video }: { video: CookingVideo }) {
  return (
    <View style={[styles.badge, { backgroundColor: PLATFORM_COLOR[video.platform] }]}>
      <Play size={9} color={WHITE} fill={WHITE} strokeWidth={0} />
      <Text style={styles.badgeText}>{video.label}</Text>
    </View>
  );
}

// ─── Card (Overview) ──────────────────────────────────────────────────────────

export function VideoGuideCard({
  video,
  fallbackImage,
  onPress,
}: {
  video: CookingVideo;
  fallbackImage?: string | null;
  onPress: () => void;
}) {
  const thumb = useVideoThumb(video, fallbackImage);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Xem video hướng dẫn trên ${video.label}`}
    >
      <View style={styles.cardMedia}>
        {thumb ? (
          <AppImage uri={thumb} style={StyleSheet.absoluteFill} contentFit="cover" showLoader={false} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#2A2118' }]} />
        )}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.55)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.playBig}>
          <Play size={24} color={INK} fill={INK} strokeWidth={0} style={{ marginLeft: 3 }} />
        </View>
        <View style={styles.cardBadgeWrap}>
          <PlatformBadge video={video} />
        </View>
        <Text style={styles.cardCaption} numberOfLines={1}>
          Xem đầu bếp làm từng bước
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Compact row (Recipe steps / Cooking) ────────────────────────────────────

export function VideoGuideRow({
  video,
  fallbackImage,
  onPress,
}: {
  video: CookingVideo;
  fallbackImage?: string | null;
  onPress: () => void;
}) {
  const thumb = useVideoThumb(video, fallbackImage);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Xem video hướng dẫn"
    >
      <View style={styles.rowThumb}>
        {thumb ? (
          <AppImage uri={thumb} style={StyleSheet.absoluteFill} contentFit="cover" showLoader={false} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#2A2118' }]} />
        )}
        <View style={styles.rowPlay}>
          <Play size={12} color={INK} fill={INK} strokeWidth={0} style={{ marginLeft: 1 }} />
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          Video hướng dẫn
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          Xem trước khi nấu · {video.label}
        </Text>
      </View>
      <View style={styles.rowCta}>
        <Text style={styles.rowCtaText}>Xem</Text>
      </View>
    </Pressable>
  );
}

// ─── Player modal ────────────────────────────────────────────────────────────

export function VideoPlayerModal({
  video,
  visible,
  title,
  onClose,
}: {
  video: CookingVideo | null;
  visible: boolean;
  title?: string;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      setFailed(false);
    }
  }, [visible, video?.url]);

  if (!video) return null;

  const canEmbed = !!video.embedUrl && !failed;
  // 16:9 cho YouTube thường, 9:16 cho Shorts/TikTok nhưng không vượt quá ~70% màn hình.
  const playerW = width;
  const playerH = video.vertical
    ? Math.min(Math.round(width * (16 / 9)), Math.round(height * 0.7))
    : Math.round(width * (9 / 16));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
    >
      <SafeAreaView style={styles.modalRoot} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} style={styles.modalIconBtn} hitSlop={8} accessibilityLabel="Đóng video">
            <X size={22} color={WHITE} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {title ?? 'Video hướng dẫn'}
            </Text>
            <Text style={styles.modalSub}>Video hướng dẫn · {video.label}</Text>
          </View>
        </View>

        <View style={styles.modalBody}>
          {canEmbed ? (
            <View style={{ width: playerW, height: playerH, backgroundColor: '#000' }}>
              <WebView
                source={playerSource(video)}
                style={{ flex: 1, backgroundColor: '#000' }}
                allowsFullscreenVideo
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled
                domStorageEnabled
                originWhitelist={['*']}
                setSupportMultipleWindows={false}
                onLoadEnd={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setFailed(true);
                }}
                onHttpError={() => {
                  setLoading(false);
                  setFailed(true);
                }}
                onShouldStartLoadWithRequest={(req) => {
                  // Giữ người dùng trong trình phát; link ra ngoài (logo, "Xem trên YouTube") → app gốc.
                  const u = req.url;
                  const inPlayer =
                    req.isTopFrame === false ||
                    u.startsWith('about:') ||
                    u.startsWith(PLAYER_BASE_URL) ||
                    u.includes('/embed/') ||
                    u.includes('/player/');
                  if (inPlayer) return true;
                  void Linking.openURL(u).catch(() => {});
                  return false;
                }}
              />
              {loading ? (
                <View style={[StyleSheet.absoluteFill, styles.loader]} pointerEvents="none">
                  <ActivityIndicator color={YELLOW} />
                </View>
              ) : null}
            </View>
          ) : (
            <View style={[styles.fallback, { width: playerW, height: playerH }]}>
              <Text style={styles.fallbackTitle}>Không phát được video trong ứng dụng</Text>
              <Text style={styles.fallbackSub}>
                Mở bằng {video.label} để xem đầy đủ hướng dẫn.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.modalFooter}>
          <Pressable
            onPress={() => void openVideoExternally(video)}
            style={({ pressed }) => [styles.externalBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <ExternalLink size={18} color={INK} />
            <Text style={styles.externalText}>Mở trong {video.label}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },

  card: { borderRadius: 20, overflow: 'hidden', backgroundColor: '#2A2118' },
  cardMedia: { width: '100%', aspectRatio: 16 / 9, alignItems: 'center', justifyContent: 'center' },
  playBig: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  cardBadgeWrap: { position: 'absolute', top: 10, left: 10 },
  cardCaption: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    color: WHITE,
    fontSize: 13.5,
    fontWeight: '700',
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { color: WHITE, fontSize: 11, fontWeight: '800' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: WHITE,
  },
  rowThumb: {
    width: 76,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowPlay: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 14.5, fontWeight: '800', color: INK },
  rowSub: { marginTop: 2, fontSize: 12.5, color: MUTED },
  rowCta: { paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: YELLOW, justifyContent: 'center' },
  rowCtaText: { fontSize: 13, fontWeight: '800', color: INK },

  modalRoot: { flex: 1, backgroundColor: '#000' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  modalIconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { color: WHITE, fontSize: 16, fontWeight: '800' },
  modalSub: { color: 'rgba(255,255,255,0.65)', fontSize: 12.5, marginTop: 1 },
  modalBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loader: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  fallback: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 6 },
  fallbackTitle: { color: WHITE, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  fallbackSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13.5, textAlign: 'center' },
  modalFooter: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 8 },
  externalBtn: {
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: YELLOW,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  externalText: { fontSize: 15, fontWeight: '800', color: INK },
});

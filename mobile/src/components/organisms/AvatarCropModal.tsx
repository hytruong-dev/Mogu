/**
 * AvatarCropModal — màn chỉnh/cắt ảnh đại diện (kiểu Facebook / TikTok)
 * Pinch zoom + pan, khung tròn, xuất ảnh 1:1 qua expo-image-manipulator.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, Mask, Rect, Circle as SvgCircle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

const { width: SCREEN_W } = Dimensions.get('window');
const CROP_SIZE = Math.min(SCREEN_W * 0.82, 320);
const OUTPUT_SIZE = 512;
const MIN_SCALE = 1;
const MAX_SCALE = 4;

type Props = {
  visible: boolean;
  uri: string;
  imageWidth?: number;
  imageHeight?: number;
  onCancel: () => void;
  onConfirm: (croppedUri: string) => void;
};

export function AvatarCropModal({
  visible,
  uri,
  imageWidth = 1000,
  imageHeight = 1000,
  onCancel,
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const iw = Math.max(1, imageWidth);
  const ih = Math.max(1, imageHeight);

  /** Base cover size so image always fills the circle at scale=1 */
  const base = useMemo(() => {
    const coverScale = Math.max(CROP_SIZE / iw, CROP_SIZE / ih);
    return {
      width: iw * coverScale,
      height: ih * coverScale,
      coverScale,
    };
  }, [iw, ih]);

  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);
  const baseW = useSharedValue(base.width);
  const baseH = useSharedValue(base.height);

  useEffect(() => {
    baseW.value = base.width;
    baseH.value = base.height;
  }, [base.width, base.height, baseW, baseH]);

  useEffect(() => {
    if (!visible) return;
    scale.value = 1;
    tx.value = 0;
    ty.value = 0;
    setError(null);
    setBusy(false);
  }, [visible, uri, scale, tx, ty]);

  const clampTranslate = (s: number, x: number, y: number) => {
    'worklet';
    const maxX = Math.max(0, (baseW.value * s - CROP_SIZE) / 2);
    const maxY = Math.max(0, (baseH.value * s - CROP_SIZE) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  };

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, startScale.value * e.scale));
      scale.value = next;
      const clamped = clampTranslate(next, tx.value, ty.value);
      tx.value = clamped.x;
      ty.value = clamped.y;
    });

  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(2)
    .averageTouches(true)
    .onBegin(() => {
      startTx.value = tx.value;
      startTy.value = ty.value;
    })
    .onUpdate((e) => {
      const clamped = clampTranslate(
        scale.value,
        startTx.value + e.translationX,
        startTy.value + e.translationY,
      );
      tx.value = clamped.x;
      ty.value = clamped.y;
    });

  const composed = Gesture.Simultaneous(pinch, pan);

  const imageStyle = useAnimatedStyle(() => ({
    width: baseW.value,
    height: baseH.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const s = scale.value;
      const ox = tx.value;
      const oy = ty.value;

      // Visible crop window in "base image" coordinates (before scale)
      const visibleW = CROP_SIZE / s;
      const visibleH = CROP_SIZE / s;
      const centerBaseX = base.width / 2 - ox / s;
      const centerBaseY = base.height / 2 - oy / s;
      const leftBase = centerBaseX - visibleW / 2;
      const topBase = centerBaseY - visibleH / 2;

      // Convert base display coords → original image pixels
      const originX = Math.max(0, Math.round(leftBase / base.coverScale));
      const originY = Math.max(0, Math.round(topBase / base.coverScale));
      let cropW = Math.round(visibleW / base.coverScale);
      let cropH = Math.round(visibleH / base.coverScale);
      cropW = Math.min(cropW, iw - originX);
      cropH = Math.min(cropH, ih - originY);
      const side = Math.max(1, Math.min(cropW, cropH));

      const result = await ImageManipulator.manipulateAsync(
        uri,
        [
          {
            crop: {
              originX,
              originY,
              width: side,
              height: side,
            },
          },
          { resize: { width: OUTPUT_SIZE, height: OUTPUT_SIZE } },
        ],
        {
          compress: 0.9,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );

      onConfirm(result.uri);
    } catch {
      setError('Không thể cắt ảnh. Thử lại với ảnh khác.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
    >
      <GestureHandlerRootView style={styles.root}>
        <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onCancel}
              disabled={busy}
              hitSlop={10}
              style={styles.headerBtn}
              accessibilityLabel="Huỷ"
            >
              <X size={22} color="#FFF" strokeWidth={2.2} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Chỉnh ảnh đại diện</Text>
            <View style={{ width: 40 }} />
          </View>

          <Text style={styles.hint}>Dùng 2 ngón phóng to/thu nhỏ · kéo để chỉnh vị trí</Text>

          <GestureDetector gesture={composed}>
            <Animated.View style={styles.stage}>
              <Animated.View style={[styles.imageLayer, imageStyle]}>
                <Image
                  source={{ uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  pointerEvents="none"
                />
              </Animated.View>

              {/* Dark overlay with circular hole */}
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <Svg width="100%" height="100%">
                  <Defs>
                    <Mask id="avatarHole">
                      <Rect x="0" y="0" width="100%" height="100%" fill="#fff" />
                      <SvgCircle cx="50%" cy="50%" r={CROP_SIZE / 2} fill="#000" />
                    </Mask>
                  </Defs>
                  <Rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    fill="rgba(0,0,0,0.62)"
                    mask="url(#avatarHole)"
                  />
                  <SvgCircle
                    cx="50%"
                    cy="50%"
                    r={CROP_SIZE / 2}
                    stroke="rgba(255,255,255,0.95)"
                    strokeWidth={2}
                    fill="transparent"
                  />
                </Svg>
              </View>
            </Animated.View>
          </GestureDetector>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              disabled={busy}
              activeOpacity={0.85}
            >
              <Text style={styles.cancelTxt}>Huỷ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.doneBtn, busy && { opacity: 0.7 }]}
              onPress={() => void handleConfirm()}
              disabled={busy}
              activeOpacity={0.9}
            >
              {busy ? (
                <ActivityIndicator color="#161616" />
              ) : (
                <Text style={styles.doneTxt}>Xong</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
  },
  hint: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imageLayer: {
    position: 'absolute',
  },
  error: {
    color: '#FF8A80',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelTxt: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  doneBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFC51A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTxt: {
    color: '#161616',
    fontSize: 16,
    fontWeight: '800',
  },
});

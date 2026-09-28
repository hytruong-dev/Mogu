import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Camera, ChevronLeft, RotateCcw, X, Zap } from '@/components/icons';

const MOCKUP_BG = require('../../assets/images/noan/scan/scan-mockup-bg.jpg');

export function FoodScanSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analyzedDish, setAnalyzedDish] = useState<{
    name: string;
    kcal: number;
    confidence: number;
  } | null>(null);

  const cameraRef = useRef<CameraView | null>(null);
  const shutterScale = useSharedValue(1);
  const flashAnim = useSharedValue(0);

  // Request camera permission on opening
  useEffect(() => {
    if (visible && !permission?.granted && permission?.canAskAgain) {
      void requestPermission();
    }
  }, [visible, permission, requestPermission]);

  // Reset state on close
  useEffect(() => {
    if (!visible) {
      setCapturedPhoto(null);
      setAnalyzedDish(null);
      setIsProcessing(false);
      setFlash('off');
    }
  }, [visible]);

  const handleClose = () => {
    if (isProcessing) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onClose();
  };

  const toggleFlash = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setFlash((prev) => (prev === 'off' ? 'on' : 'off'));
  };

  const toggleFacing = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  const handlePickLibrary = async () => {
    if (isProcessing) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        allowsMultipleSelection: false,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        processPhoto(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Không thể mở ảnh', 'Vui lòng kiểm tra quyền truy cập thư viện ảnh.');
    }
  };

  const handleShutter = async () => {
    if (isProcessing) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);

    // Shutter button spring & white flash animation
    shutterScale.value = withSequence(
      withTiming(0.88, { duration: 90, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 10, stiffness: 220 }),
    );
    flashAnim.value = withSequence(
      withTiming(0.85, { duration: 60 }),
      withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) }),
    );

    try {
      if (cameraRef.current && permission?.granted) {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.88,
          shutterSound: false,
        });
        if (photo?.uri) {
          processPhoto(photo.uri);
          return;
        }
      }
      // Fallback in simulator / no camera preview: use mockup photo
      processPhoto(Image.resolveAssetSource(MOCKUP_BG).uri);
    } catch {
      // In simulator or error: fallback gracefully
      processPhoto(Image.resolveAssetSource(MOCKUP_BG).uri);
    }
  };

  const processPhoto = (uri: string) => {
    setCapturedPhoto(uri);
    setIsProcessing(true);

    // Simulate smart AI dish recognition (BA-006 Food Scan)
    setTimeout(() => {
      setIsProcessing(false);
      setAnalyzedDish({
        name: 'Cơm tấm sườn bì chả',
        kcal: 685,
        confidence: 96,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }, 1200);
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    setAnalyzedDish(null);
    setIsProcessing(false);
  };

  const shutterAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shutterScale.value }],
  }));

  const flashOverlayStyle = useAnimatedStyle(() => ({
    opacity: flashAnim.value,
  }));

  // Dimensions of scan box
  const boxSize = Math.min(315, Math.floor(windowWidth * 0.77));
  const boxTop = Math.max(insets.top + 70, Math.floor(windowHeight * 0.22));

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.container}>
        {/* Camera stream or mockup background */}
        {permission?.granted && !capturedPhoto ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash={flash}
            mode="picture"
          />
        ) : (
          <Image
            source={capturedPhoto ? { uri: capturedPhoto } : MOCKUP_BG}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        )}

        {/* Shutter flash effect */}
        <Animated.View style={[styles.shutterFlash, flashOverlayStyle]} pointerEvents="none" />

        {/* Darkened vignette surround outside the viewfinder box */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* Top dark area */}
          <View style={{ height: boxTop, backgroundColor: 'rgba(15, 10, 8, 0.42)' }} />
          {/* Middle row */}
          <View style={{ height: boxSize, flexDirection: 'row' }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(15, 10, 8, 0.42)' }} />
            <View style={{ width: boxSize }} />
            <View style={{ flex: 1, backgroundColor: 'rgba(15, 10, 8, 0.42)' }} />
          </View>
          {/* Bottom dark area */}
          <View style={{ flex: 1, backgroundColor: 'rgba(15, 10, 8, 0.42)' }} />
        </View>

        {/* Top Header Bar */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
          <Pressable
            onPress={handleClose}
            style={styles.backBtn}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
            <ChevronLeft size={28} color="#FFFFFF" strokeWidth={2.6} />
          </Pressable>

          <View style={styles.headerTitleWrap} pointerEvents="none">
            <Text style={styles.headerTitle}>Quét món ăn</Text>
            <Text style={styles.headerSub}>Đưa món ăn vào khung hình</Text>
          </View>

          <Pressable
            onPress={toggleFlash}
            style={[styles.flashBtn, flash === 'on' && styles.flashBtnActive]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={flash === 'on' ? 'Tắt đèn flash' : 'Bật đèn flash'}
          >
            <Zap size={20} color={flash === 'on' ? '#2A1A10' : '#FFFFFF'} strokeWidth={2.4} fill={flash === 'on' ? '#2A1A10' : 'transparent'} />
          </Pressable>
        </View>

        {/* Viewfinder Scanner Target Box */}
        <View
          style={[
            styles.viewfinder,
            {
              top: boxTop,
              width: boxSize,
              height: boxSize,
              left: (windowWidth - boxSize) / 2,
            },
          ]}
          pointerEvents="none"
        >
          {/* 4 Golden Corner Brackets */}
          <CornerBracket position="tl" />
          <CornerBracket position="tr" />
          <CornerBracket position="bl" />
          <CornerBracket position="br" />

          {/* Animated Horizontal Laser Scan Beam */}
          {!capturedPhoto ? <LaserScanLine boxSize={boxSize} /> : null}
        </View>

        {/* Instruction pill below the viewfinder */}
        <View
          style={[
            styles.guidePillWrap,
            { top: boxTop + boxSize + 16 },
          ]}
          pointerEvents="none"
        >
          <View style={styles.guidePill}>
            <Text style={styles.guidePillTxt}>Giữ máy ổn định, chụp rõ món ăn</Text>
          </View>
        </View>

        {/* Bottom Controls Area */}
        <View style={[styles.bottomControls, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}>
          <View style={styles.controlsRow}>
            {/* Left: Thư viện */}
            <Pressable
              onPress={handlePickLibrary}
              style={styles.sideBtn}
              accessibilityRole="button"
              accessibilityLabel="Chọn ảnh từ thư viện"
            >
              <GalleryIcon size={28} color="#FFFFFF" />
              <Text style={styles.sideBtnTxt}>Thư viện</Text>
            </Pressable>

            {/* Center: Hero Shutter Button */}
            <Animated.View style={shutterAnimatedStyle}>
              <Pressable
                onPress={handleShutter}
                style={styles.shutterOuter}
                accessibilityRole="button"
                accessibilityLabel="Chụp ảnh món ăn"
              >
                <View style={styles.shutterInner}>
                  <Camera size={28} color="#FFFFFF" strokeWidth={2.4} />
                </View>
              </Pressable>
            </Animated.View>

            {/* Right: Đổi camera */}
            <Pressable
              onPress={toggleFacing}
              style={styles.sideBtn}
              accessibilityRole="button"
              accessibilityLabel="Đổi camera trước hoặc sau"
            >
              <FlipCameraIcon size={28} color="#FFFFFF" />
              <Text style={styles.sideBtnTxt}>Đổi camera</Text>
            </Pressable>
          </View>

          {/* Tagline at bottom */}
          <Text style={styles.taglineTxt}>Chụp ảnh để NOAN nhận diện món ăn</Text>
        </View>

        {/* Recognition Result Modal / Overlay */}
        {capturedPhoto && (isProcessing || analyzedDish) ? (
          <View style={styles.resultModalOverlay}>
            <View style={[styles.resultCard, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
              {isProcessing ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="large" color="#FFC928" />
                  <Text style={styles.loadingTxt}>NOAN đang nhận diện món ăn...</Text>
                  <Text style={styles.loadingSub}>Đang phân tích thành phần & lượng calo</Text>
                </View>
              ) : analyzedDish ? (
                <>
                  <View style={styles.resultHeader}>
                    <View style={styles.resultBadge}>
                      <Text style={styles.resultBadgeTxt}>✨ ĐÃ NHẬN DIỆN THÀNH CÔNG</Text>
                    </View>
                    <Pressable onPress={retakePhoto} hitSlop={12} style={styles.closeResultBtn}>
                      <X size={20} color="#6B4A32" />
                    </Pressable>
                  </View>

                  <Text style={styles.dishResultTitle}>{analyzedDish.name}</Text>
                  <View style={styles.dishMetaRow}>
                    <Text style={styles.dishKcalTxt}>🔥 ~{analyzedDish.kcal} kcal</Text>
                    <Text style={styles.dishConfidenceTxt}>Độ chính xác: {analyzedDish.confidence}%</Text>
                  </View>

                  <View style={styles.dishActionRow}>
                    <Pressable
                      style={styles.retakeBtn}
                      onPress={retakePhoto}
                      accessibilityRole="button"
                    >
                      <RotateCcw size={18} color="#2A1A10" />
                      <Text style={styles.retakeTxt}>Chụp lại</Text>
                    </Pressable>

                    <Pressable
                      style={styles.confirmBtn}
                      onPress={() => {
                        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
                        Alert.alert(
                          'Món ăn đã được lưu',
                          `Đã ghi nhận "${analyzedDish.name}" (~${analyzedDish.kcal} kcal) vào nhật ký ăn uống của bạn.`,
                          [{ text: 'Đồng ý', onPress: handleClose }],
                        );
                      }}
                      accessibilityRole="button"
                    >
                      <Text style={styles.confirmTxt}>Thêm vào nhật ký</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/** 4 Golden Corner Brackets */
function CornerBracket({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const size = 44;
  const stroke = '#FFB800';
  const sw = 5;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      style={{
        position: 'absolute',
        top: position.startsWith('t') ? 0 : undefined,
        bottom: position.startsWith('b') ? 0 : undefined,
        left: position.endsWith('l') ? 0 : undefined,
        right: position.endsWith('r') ? 0 : undefined,
      }}
    >
      {position === 'tl' && (
        <Path
          d="M 42 3 H 18 A 15 15 0 0 0 3 18 V 42"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
      {position === 'tr' && (
        <Path
          d="M 2 3 H 26 A 15 15 0 0 1 41 18 V 42"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
      {position === 'bl' && (
        <Path
          d="M 42 41 H 18 A 15 15 0 0 1 3 26 V 2"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
      {position === 'br' && (
        <Path
          d="M 2 41 H 26 A 15 15 0 0 0 41 26 V 2"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
    </Svg>
  );
}

/** Animated horizontal golden laser scanning beam */
function LaserScanLine({ boxSize }: { boxSize: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [progress]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: progress.value * (boxSize - 18) }],
  }));

  return (
    <Animated.View
      style={[styles.laserWrap, animStyle]}
      pointerEvents="none"
    >
      {/* Soft halo glow behind laser */}
      <View style={styles.laserGlow} />

      {/* Main golden laser line with bright glowing center */}
      <LinearGradient
        colors={[
          'rgba(255, 184, 0, 0)',
          'rgba(255, 184, 0, 0.4)',
          'rgba(255, 230, 90, 0.9)',
          '#FFFFFF',
          'rgba(255, 230, 90, 0.9)',
          'rgba(255, 184, 0, 0.4)',
          'rgba(255, 184, 0, 0)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.laserLine}
      />
    </Animated.View>
  );
}

/** Gallery / Thư viện icon (rounded photo frame with mountain peaks & sun) */
function GalleryIcon({ size = 28, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="18" height="18" rx="4" stroke={color} strokeWidth="2" />
      <Circle cx="8" cy="8" r="1.6" fill={color} />
      <Path
        d="M21 16L16 11L11.5 15.5L8.5 12.5L3 18"
        stroke={color}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Flip Camera / Đổi camera icon (camera with circular arrows) */
function FlipCameraIcon({ size = 28, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 7H16.5L15 4.5H9L7.5 7H4C2.9 7 2 7.9 2 9V19C2 20.1 2.9 21 4 21H20C21.1 21 22 20.1 22 19V9C22 7.9 21.1 7 20 7Z"
        stroke={color}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Curved flip arrows in center */}
      <Path
        d="M9.5 13.2C9.5 11.8 10.6 10.7 12 10.7C13.1 10.7 14 11.4 14.3 12.3M14.5 12.3H16M14.5 14.8C14.5 16.2 13.4 17.3 12 17.3C10.9 17.3 10 16.6 9.7 15.7M9.5 15.7H8"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0A08',
  },
  shutterFlash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    zIndex: 40,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 98,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 20,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  headerSub: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E8E1D9',
    marginTop: 3,
    textAlign: 'center',
  },
  flashBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(30, 20, 15, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashBtnActive: {
    backgroundColor: '#FFC928',
    borderColor: '#FFC928',
  },
  viewfinder: {
    position: 'absolute',
    borderRadius: 16,
    overflow: 'hidden',
    zIndex: 15,
  },
  laserWrap: {
    position: 'absolute',
    left: 2,
    right: 2,
    top: 8,
    height: 24,
    justifyContent: 'center',
  },
  laserGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 18,
    backgroundColor: 'rgba(255, 184, 0, 0.22)',
    borderRadius: 9,
  },
  laserLine: {
    height: 2.5,
    width: '100%',
  },
  guidePillWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 18,
  },
  guidePill: {
    paddingHorizontal: 22,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(24, 16, 12, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 230, 160, 0.16)',
  },
  guidePillTxt: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    alignItems: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 36,
  },
  sideBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
    gap: 6,
  },
  sideBtnTxt: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  shutterOuter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  shutterInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFC928',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taglineTxt: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 22,
  },

  /* Recognition result modal */
  resultModalOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(20, 12, 8, 0.65)',
    justifyContent: 'flex-end',
    zIndex: 35,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 24,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  loadingTxt: {
    fontSize: 17,
    fontWeight: '800',
    color: '#2A1A10',
    marginTop: 14,
  },
  loadingSub: {
    fontSize: 13.5,
    color: '#7E6E65',
    marginTop: 4,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  resultBadge: {
    backgroundColor: '#FFF2C9',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  resultBadgeTxt: {
    color: '#8A5800',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  closeResultBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5ECE3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dishResultTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: '#2A1A10',
    letterSpacing: -0.3,
  },
  dishMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
    marginBottom: 22,
  },
  dishKcalTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E0621B',
  },
  dishConfidenceTxt: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#7E6E65',
  },
  dishActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  retakeBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#2A1A10',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  retakeTxt: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#2A1A10',
  },
  confirmBtn: {
    flex: 1.6,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFC928',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E6AC00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 3,
  },
  confirmTxt: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#2A1A10',
  },
});

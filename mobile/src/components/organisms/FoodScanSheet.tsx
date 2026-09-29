import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Linking,
  ScrollView,
  Pressable,
  PanResponder,
  StatusBar,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ZoomIn,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Camera, Check, ChevronLeft, Minus, Plus, Search, X, Zap } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';

import {
  reportMissingDish,
  scanFoodImage,
  sendFoodScanFeedback,
  type FoodScanCandidate,
  type FoodScanResponse,
} from '@/services/api/food-scan';
import { dishesApi } from '@/services/api/dishes';
import { healthApi } from '@/services/api/health';
import { recordMealLoggedStore } from '@/services/app-store';
import { getDeviceTimeZone } from '@/lib/dates';

/** 'unknown' = dish recognised as food but not (yet) in the Mogu catalogue. */
type ScanState = 'idle' | 'analyzing' | 'success' | 'review' | 'unknown';

export function FoodScanSheet({
  visible,
  onClose,
  onViewDish,
}: {
  visible: boolean;
  onClose: () => void;
  onViewDish: (dishId: string, title: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // 3 States of Food Scan:
  // 'idle' = 01 · Sẵn sàng quét
  // 'analyzing' = 02 · Đang phân tích
  // 'success' = 03 · Nhận diện thành công
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [portions, setPortions] = useState(1);
  const [analyzedDish, setAnalyzedDish] = useState<FoodScanCandidate | null>(null);
  const [result, setResult] = useState<FoodScanResponse | null>(null);
  const [message, setMessage] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [choices, setChoices] = useState<FoodScanCandidate[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mealSlot, setMealSlot] = useState<'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK'>('LUNCH');
  const [pickOtherVisible, setPickOtherVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodScanCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [reportingMissing, setReportingMissing] = useState(false);
  /** True when the user explicitly said "not in Mogu" (vs. the backend auto-detecting it). */
  const [userReported, setUserReported] = useState(false);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const captureLock = useRef(false);
  const saveLock = useRef(false);
  const saveAttempt = useRef<{
    key: string;
    body: Parameters<typeof healthApi.createMealLog>[0];
  } | null>(null);

  const cameraRef = useRef<CameraView | null>(null);
  const shutterScale = useSharedValue(1);
  const flashAnim = useSharedValue(0);

  // Bottom sheet slide animation
  const sheetTranslateY = useSharedValue(500);

  // Permissions are requested only from an explicit user action.
  useEffect(
    () => () => {
      generation.current += 1;
      request.current?.abort();
    },
    [],
  );

  // Reset state on close
  useEffect(() => {
    if (!visible) {
      generation.current += 1;
      request.current?.abort();
      captureLock.current = false;
      setCameraReady(false);
      setResult(null);
      setChoices([]);
      setMessage('');
      setSaved(false);
      setUserReported(false);
      setReportingMissing(false);
      setPickOtherVisible(false);
      if (!saveLock.current) saveAttempt.current = null;
      setCapturedPhoto(null);
      setAnalyzedDish(null);
      setScanState('idle');
      setPortions(1);
      setFlash('off');
      sheetTranslateY.value = 500;
    }
  }, [visible, sheetTranslateY]);

  // Animate sheet when entering analyzing or success
  useEffect(() => {
    if (scanState !== 'idle') {
      sheetTranslateY.value = withSpring(0, {
        damping: 24,
        stiffness: 220,
        mass: 0.8,
      });
    } else {
      sheetTranslateY.value = withTiming(500, {
        duration: 250,
        easing: Easing.in(Easing.quad),
      });
    }
  }, [scanState, sheetTranslateY]);

  const handleClose = () => {
    if (saveLock.current) return;
    generation.current += 1;
    request.current?.abort();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onClose();
  };

  // Keep dragging on the sheet handle separate from content scrolling/buttons.
  const sheetDragResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !saveLock.current,
    onMoveShouldSetPanResponder: (_, gesture) =>
      !saveLock.current && gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_, gesture) => {
      if (!saveLock.current) sheetTranslateY.value = Math.max(0, gesture.dy);
    },
    onPanResponderRelease: (_, gesture) => {
      if (!saveLock.current && (gesture.dy > 80 || (gesture.dy > 25 && gesture.vy > 0.8))) {
        handleClose();
      } else {
        sheetTranslateY.value = withSpring(0, { damping: 24, stiffness: 220 });
      }
    },
    onPanResponderTerminate: () => {
      sheetTranslateY.value = withSpring(0, { damping: 24, stiffness: 220 });
    },
  });

  const toggleFlash = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setFlash((prev) => (prev === 'off' ? 'on' : 'off'));
  };

  const toggleFacing = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    if (captureLock.current) return;
    setCameraReady(false);
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  const handlePickLibrary = async () => {
    if (scanState !== 'idle' && scanState !== 'review' && scanState !== 'unknown') return;
    if (captureLock.current) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    captureLock.current = true;
    const id = generation.current;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        allowsMultipleSelection: false,
      });
      if (id === generation.current && !result.canceled && result.assets[0]?.uri) {
        void startAnalysis(result.assets[0].uri);
      }
    } catch {
      if (id === generation.current)
        Alert.alert('Không thể mở ảnh', 'Vui lòng kiểm tra quyền truy cập thư viện ảnh.');
    } finally {
      if (id === generation.current) captureLock.current = false;
    }
  };

  const handleShutter = async () => {
    if (scanState !== 'idle' || captureLock.current) return;
    if (!cameraReady || !permission?.granted || !cameraRef.current) return;
    captureLock.current = true;
    const id = generation.current;
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
        if (id !== generation.current) return;
        if (photo?.uri) {
          void startAnalysis(photo.uri);
          return;
        }
      }
      throw new Error('Camera chưa sẵn sàng.');
    } catch {
      if (id === generation.current)
        Alert.alert('Không thể chụp ảnh', 'Vui lòng thử lại hoặc chọn ảnh từ thư viện.');
    } finally {
      if (id === generation.current) captureLock.current = false;
    }
  };

  const startAnalysis = async (uri: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const id = ++generation.current;
    setCapturedPhoto(uri);
    setScanState('analyzing');
    setPortions(1);
    setAnalyzedDish(null);
    setMessage('');
    setSaved(false);
    setUserReported(false);
    saveAttempt.current = null;
    try {
      const response = await scanFoodImage(uri, controller.signal);
      if (id !== generation.current || controller.signal.aborted) return;
      setResult(response);
      setChoices(response.candidates);

      // Branch on the backend decision, not on candidates.length: an unknown dish still
      // returns a few weak "maybe" candidates which must not be shown as a match.
      if (response.status === 'UNKNOWN_DISH' || response.status === 'NO_MATCH') {
        setAnalyzedDish(null);
        setScanState('unknown');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
          () => undefined,
        );
      } else if (response.status !== 'NOT_FOOD' && response.candidates.length > 0) {
        // Automatically display the recognized food (State 03: "Đã tìm thấy món")
        setAnalyzedDish(response.candidates[0]);
        setScanState('success');
        setMessage('');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => undefined,
        );
      } else {
        setAnalyzedDish(null);
        setMessage('Ảnh chưa nhận diện được món ăn. Hãy chụp rõ nét món ăn nhé!');
        setScanState('review');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
          () => undefined,
        );
      }
    } catch (error) {
      if (id !== generation.current || controller.signal.aborted) return;
      setChoices([]);
      setResult(null);
      setAnalyzedDish(null);
      const rawMsg = error instanceof Error ? error.message : '';
      let friendlyMsg = 'Không thể phân tích ảnh lúc này. Vui lòng thử lại.';
      if (rawMsg.includes('FOOD_SCAN_VISION_FAILED') || rawMsg.includes('502')) {
        friendlyMsg = 'Dịch vụ AI đang bận hoặc không thể phân tích ảnh này. Hãy thử chụp lại nhé!';
      } else if (rawMsg.includes('FOOD_SCAN_PROVIDER_NOT_CONFIGURED') || rawMsg.includes('503')) {
        friendlyMsg = 'Dịch vụ AI đang bảo trì. Vui lòng thử lại sau.';
      } else if (rawMsg.includes('Ảnh vượt quá')) {
        friendlyMsg = rawMsg;
      }
      setMessage(friendlyMsg);
      setScanState('review');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => undefined,
      );
    }
  };

  const handleCancelAnalysis = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (saveLock.current) return;
    generation.current += 1;
    request.current?.abort();
    captureLock.current = false;
    setCameraReady(false);
    setScanState('idle');
    setCapturedPhoto(null);
    setAnalyzedDish(null);
    setChoices([]);
    setMessage('');
    setResult(null);
  };

  const handleRetake = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (saveLock.current) return;
    generation.current += 1;
    request.current?.abort();
    captureLock.current = false;
    setCameraReady(false);
    setScanState('idle');
    setCapturedPhoto(null);
    setAnalyzedDish(null);
    setChoices([]);
    setMessage('');
    setResult(null);
  };

  const handleConfirmSave = async () => {
    if (!analyzedDish || saveLock.current || saved) return;
    saveLock.current = true;
    setSaving(true);
    setMessage('');
    const id = generation.current;
    if (!saveAttempt.current)
      saveAttempt.current = {
        key: `scan-meal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        body: {
          mealSlot,
          timezone: getDeviceTimeZone(),
          occurredAt: new Date().toISOString(),
          source: { type: 'CAMERA' },
          items: [
            {
              referenceType: 'DISH',
              referenceId: analyzedDish.dishId,
              quantity: portions,
              unitCode: 'SERVING',
            },
          ],
        },
      };
    try {
      await healthApi.createMealLog(saveAttempt.current.body, saveAttempt.current.key);
      recordMealLoggedStore();
      if (id !== generation.current) return;
      setSaved(true);
      setMessage('Đã thêm món vào nhật ký.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );

      // Feedback loop: confirm current dish selection
      if (result?.scanId && analyzedDish?.dishId) {
        void sendFoodScanFeedback(result.scanId, {
          dishId: analyzedDish.dishId,
          correct: true,
        });
      }
    } catch (error) {
      if (id === generation.current)
        setMessage(
          `${error instanceof Error ? error.message : 'Không thể lưu nhật ký.'} Thử lại sẽ không tạo bản ghi trùng.`,
        );
    } finally {
      saveLock.current = false;
      if (id === generation.current) setSaving(false);
    }
  };

  const handleViewDish = () => {
    if (!analyzedDish || saving) return;
    handleClose();
    onViewDish(analyzedDish.dishId, analyzedDish.name);
  };

  const handleOpenPickOther = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (result?.scanId) {
      void sendFoodScanFeedback(result.scanId, {
        dishId: null,
        correct: false,
      });
    }
    setSearchQuery('');
    setSearchResults([]);
    setPickOtherVisible(true);
  };

  /** "Món này chưa có trong Mogu": queue the photo for admins and show the unknown screen. */
  const handleReportMissing = async () => {
    if (reportingMissing || !result?.scanId) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    setReportingMissing(true);
    const id = generation.current;
    const res = await reportMissingDish(result.scanId, capturedPhoto);
    if (id !== generation.current) return;
    setReportingMissing(false);
    setPickOtherVisible(false);
    setAnalyzedDish(null);
    setSaved(false);
    saveAttempt.current = null;
    setUserReported(res.success);
    if (res.reportId) setResult((previous) => previous ? { ...previous, reportId: res.reportId! } : previous);
    setMessage(
      res.success
        ? ''
        : 'Chưa gửi được ảnh cho Mogu lúc này. Bạn có thể thử lại sau.',
    );
    setScanState('unknown');
    void Haptics.notificationAsync(
      res.success ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
    ).catch(() => undefined);
  };

  const handleSelectAlternative = (candidate: FoodScanCandidate) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setAnalyzedDish(candidate);
    setPortions(1);
    setSaved(false);
    saveAttempt.current = null;
    setPickOtherVisible(false);
    setMessage('');
    setScanState('success');

    if (result?.scanId) {
      void sendFoodScanFeedback(result.scanId, {
        dishId: candidate.dishId,
        correct: true,
      });
    }
  };

  const handleSearchDishes = async (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await dishesApi.search({ q: text.trim(), limit: 8 });
      const mapped: FoodScanCandidate[] = (res.data || []).map((d) => ({
        dishId: d.id,
        name: d.name,
        imageUrl: d.thumbnailUrl ?? null,
        score: 1.0,
        confidenceLabel: 'HIGH',
        nutrition: {
          calories: d.calories ?? null,
          proteinG: d.proteinG ?? null,
          carbsG: d.carbG ?? null,
          fatG: d.fatG ?? null,
          servingName: '1 phần',
          servingG: null,
          basis: 'PER_SERVING',
        },
      }));
      setSearchResults(mapped);
    } catch {
      // Non-blocking
    } finally {
      setSearching(false);
    }
  };

  const shutterAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shutterScale.value }],
  }));

  const flashOverlayStyle = useAnimatedStyle(() => ({
    opacity: flashAnim.value,
  }));

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
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
        {/* Never present a placeholder as a captured camera image. */}
        {visible && permission?.granted && !capturedPhoto ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash={flash}
            mode="picture"
            onCameraReady={() => setCameraReady(true)}
            onMountError={() => {
              setCameraReady(false);
              setMessage('Không thể mở camera. Bạn vẫn có thể chọn ảnh từ thư viện.');
            }}
          />
        ) : capturedPhoto ? (
          <Image
            source={{ uri: capturedPhoto }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#2A1A10' }]} />
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
            {scanState === 'idle' || scanState === 'unknown' ? (
              <Text style={styles.headerSub}>Đưa món ăn vào khung hình</Text>
            ) : null}
          </View>

          <Pressable
            onPress={toggleFlash}
            style={[styles.flashBtn, flash === 'on' && styles.flashBtnActive]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={flash === 'on' ? 'Tắt đèn flash' : 'Bật đèn flash'}
          >
            <Zap
              size={20}
              color={flash === 'on' ? '#2A1A10' : '#FFFFFF'}
              strokeWidth={2.4}
              fill={flash === 'on' ? '#2A1A10' : 'transparent'}
            />
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
          {scanState === 'idle' ? <LaserScanLine boxSize={boxSize} /> : null}
        </View>

        {/* Instruction pill below the viewfinder in State 01 */}
        {scanState === 'idle' ? (
          <View style={[styles.guidePillWrap, { top: boxTop + boxSize + 16 }]}>
            <View style={styles.guidePill}>
              <Text style={styles.guidePillTxt}>
                {permission?.granted
                  ? 'Giữ máy ổn định, chụp rõ món ăn'
                  : 'Chưa có quyền camera. Bạn vẫn có thể chọn ảnh từ thư viện.'}
              </Text>
            </View>
            {!permission?.granted ? (
              <Button
                variant="secondary"
                onPress={() => {
                  if (permission?.canAskAgain !== false) void requestPermission();
                  else void Linking.openSettings();
                }}
              >
                <Text>
                  {permission?.canAskAgain === false ? 'Mở cài đặt camera' : 'Cho phép camera'}
                </Text>
              </Button>
            ) : null}
            {message ? (
              <Text style={{ color: '#FFFFFF', textAlign: 'center', marginTop: 8 }}>{message}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Bottom Controls Area in State 01 · Sẵn sàng quét */}
        {scanState === 'idle' ? (
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
                  disabled={!cameraReady || !permission?.granted}
                  accessibilityState={{
                    disabled: !cameraReady || !permission?.granted,
                  }}
                  style={[
                    styles.shutterOuter,
                    (!cameraReady || !permission?.granted) && { opacity: 0.45 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Chụp ảnh món ăn"
                >
                  <View style={styles.shutterInner} />
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
          </View>
        ) : null}

        {/* Backdrop overlay behind bottom sheet in States 02 & 03 */}
        {scanState !== 'idle' ? (
          <Pressable
            style={[styles.sheetBackdrop, scanState === 'unknown' && { backgroundColor: 'transparent' }]}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Đóng màn quét món ăn"
            disabled={saving}
          />
        ) : null}

        {/* Bottom Sheet for State 02 (Đang phân tích) and State 03 (Nhận diện thành công) */}
        {scanState !== 'idle' ? (
          <Animated.View
            style={[
              styles.bottomSheetCard,
              scanState === 'unknown' && styles.bottomSheetCream,
              { paddingBottom: Math.max(insets.bottom + 12, 24) },
              sheetAnimatedStyle,
            ]}
          >
            {/* Sheet top drag indicator / grip */}
            <View
              {...sheetDragResponder.panHandlers}
              style={styles.sheetDragHandle}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Đóng bảng kết quả quét"
              accessibilityHint="Kéo xuống để đóng"
              accessibilityActions={[{ name: 'activate', label: 'Đóng' }]}
              onAccessibilityAction={handleClose}
            >
              <View style={styles.sheetGrip} />
            </View>

            {/* STATE 02 · Đang phân tích */}
            {scanState === 'analyzing' ? (
              <AnalyzingPanel photoUri={capturedPhoto} onCancel={handleCancelAnalysis} />
            ) : null}

            {scanState === 'review' ? (
              <ScrollView
                style={{ maxHeight: windowHeight * 0.55 }}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ gap: 14, paddingBottom: 16 }}
              >
                <View style={{ alignItems: 'center', gap: 8, paddingVertical: 12 }}>
                  <Badge variant="outline" className="bg-[#FFF8E7] border-transparent px-3 py-1 rounded-full">
                    <Text className="text-[#8B5E00] font-bold text-xs">
                      {result?.status === 'NOT_FOOD' ? 'Không phải món ăn' : 'Chưa nhận diện được'}
                    </Text>
                  </Badge>
                  <Text
                    style={[styles.analyzingSub, { textAlign: 'center', paddingHorizontal: 16 }]}
                    accessibilityLiveRegion="polite"
                  >
                    {message}
                  </Text>
                </View>

                {capturedPhoto ? (
                  <Button
                    className="w-full h-12 rounded-full bg-[#FFC928] active:bg-[#F0BB20] shadow-none"
                    onPress={() => void startAnalysis(capturedPhoto)}
                  >
                    <Text className="text-[#2A1A10] font-black text-sm">Thử phân tích lại</Text>
                  </Button>
                ) : null}

                <Button
                  variant="outline"
                  className="w-full h-12 rounded-full border-[#E8DFD5] bg-white active:bg-[#FAF6F0] shadow-none"
                  onPress={handleRetake}
                >
                  <Text className="text-[#5C4533] font-bold text-sm">Chụp lại ảnh</Text>
                </Button>

                <Button
                  variant="ghost"
                  className="w-full h-10 rounded-full active:bg-[#FAF6F0] shadow-none"
                  onPress={handlePickLibrary}
                >
                  <Text className="text-[#887569] font-semibold text-sm">Chọn ảnh từ thư viện</Text>
                </Button>
              </ScrollView>
            ) : null}

            {/* STATE 03b · Món chưa có trong NOAN */}
            {scanState === 'unknown' ? (
              <ScrollView
                style={{ maxHeight: windowHeight * 0.66 }}
                contentContainerStyle={styles.unknownContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Animated.View entering={FadeInDown.duration(320)} style={styles.unknownPill}>
                  <Search size={14} color="#8B5E00" strokeWidth={2.6} />
                  <Text style={styles.unknownPillTxt}>Chưa có trong danh sách món</Text>
                </Animated.View>

                <Animated.View entering={ZoomIn.delay(80).springify().damping(12)}>
                  <UnknownDishIllustration />
                </Animated.View>

                <Animated.View
                  entering={FadeInDown.delay(160).duration(360)}
                  style={{ alignItems: 'center' }}
                >
                  <Text style={styles.unknownTitle}>Món này chưa có{'\n'}trong NOAN</Text>
                  <Text style={styles.unknownDesc}>
                    NOAN đã nhận ra món ăn, nhưng chưa tìm thấy trong danh sách hiện tại.
                  </Text>
                  {message ? (
                    <Pressable
                      onPress={() => void handleReportMissing()}
                      disabled={reportingMissing}
                      accessibilityRole="button"
                      accessibilityLabel="Thử gửi lại báo cáo món thiếu"
                    >
                      <Text accessibilityLiveRegion="polite" style={styles.unknownDesc}>
                        {reportingMissing ? 'Đang gửi lại...' : `${message} Nhấn để gửi lại.`}
                      </Text>
                    </Pressable>
                  ) : null}
                </Animated.View>

                <Animated.View
                  entering={FadeInDown.delay(240).duration(360)}
                  style={styles.unknownCard}
                >
                  {capturedPhoto ? (
                    <Image
                      source={{ uri: capturedPhoto }}
                      style={styles.unknownCardThumb}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.unknownCardThumb, styles.heroImageFallback]}>
                      <Camera size={22} color="#B2A398" />
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.unknownCardTitle} numberOfLines={2}>
                      {result?.recognizedName?.trim() || 'Món chưa rõ tên'}
                    </Text>
                    <Text style={styles.unknownCardSub}>Tên gợi ý từ ảnh</Text>
                  </View>
                </Animated.View>

                <Animated.View
                  entering={FadeInDown.delay(320).duration(360)}
                  style={styles.unknownActions}
                >
                  <PressableScale
                    onPress={handleOpenPickOther}
                    accessibilityRole="button"
                    accessibilityLabel="Tìm món tương tự"
                    style={styles.unknownPrimaryBtn}
                  >
                    <Search size={20} color="#2A1A10" strokeWidth={2.6} />
                    <Text style={styles.unknownPrimaryTxt}>Tìm món tương tự</Text>
                  </PressableScale>

                  <PressableScale
                    onPress={handleRetake}
                    accessibilityRole="button"
                    accessibilityLabel="Quét món khác"
                    style={styles.unknownSecondaryBtn}
                  >
                    <Camera size={20} color="#2A1A10" strokeWidth={2.4} />
                    <Text style={styles.unknownSecondaryTxt}>Quét món khác</Text>
                  </PressableScale>

                  <Pressable
                    onPress={() => void handlePickLibrary()}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Chọn ảnh khác"
                    style={{ alignSelf: 'center', paddingVertical: 6 }}
                  >
                    <Text style={styles.unknownLinkTxt}>Chọn ảnh khác</Text>
                  </Pressable>
                </Animated.View>
              </ScrollView>
            ) : null}

            {/* STATE 03 · Nhận diện thành công */}
            {scanState === 'success' && analyzedDish ? (
              <ScrollView
                style={{ maxHeight: windowHeight * 0.72 }}
                contentContainerStyle={styles.successContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {(() => {
                  const score = analyzedDish.score ?? result?.confidence ?? 0;
                  const label =
                    analyzedDish.confidenceLabel ??
                    (score >= 0.75 ? 'HIGH' : score >= 0.5 ? 'MEDIUM' : 'LOW');
                  const tone = CONFIDENCE_TONES[label];
                  const heroUri = analyzedDish.imageUrl ?? capturedPhoto;
                  const kcal = analyzedDish.nutrition.calories;
                  const macros = [
                    { key: 'kcal', label: 'Calo', value: kcal, unit: 'kcal', color: '#F97316', bg: '#FFF4EC' },
                    { key: 'p', label: 'Đạm', value: analyzedDish.nutrition.proteinG, unit: 'g', color: '#E11D48', bg: '#FFF1F3' },
                    { key: 'c', label: 'Carb', value: analyzedDish.nutrition.carbsG, unit: 'g', color: '#D97706', bg: '#FFF8E7' },
                    { key: 'f', label: 'Béo', value: analyzedDish.nutrition.fatG, unit: 'g', color: '#0EA5E9', bg: '#EEF8FF' },
                  ];
                  return (
                    <>
                      {/* Hero: ảnh món + tên + độ tin cậy */}
                      <Animated.View
                        key={`hero-${analyzedDish.dishId}`}
                        entering={FadeInDown.duration(380).springify().damping(16)}
                        style={styles.heroRow}
                      >
                        <View style={styles.heroImageWrap}>
                          {heroUri ? (
                            <Image source={{ uri: heroUri }} style={styles.heroImage} resizeMode="cover" />
                          ) : (
                            <View style={[styles.heroImage, styles.heroImageFallback]}>
                              <Camera size={26} color="#B2A398" />
                            </View>
                          )}
                          <Animated.View
                            entering={ZoomIn.delay(220).springify().damping(10)}
                            style={[styles.heroCheck, { backgroundColor: tone.dot }]}
                          >
                            <Check size={13} color="#FFFFFF" strokeWidth={3.2} />
                          </Animated.View>
                        </View>

                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={[styles.confPill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                            <View style={[styles.confDot, { backgroundColor: tone.dot }]} />
                            <Text style={[styles.confPillTxt, { color: tone.text }]}>{tone.label}</Text>
                          </View>
                          <Text style={styles.heroTitle} numberOfLines={2}>
                            {analyzedDish.name}
                          </Text>
                          {analyzedDish.nutrition.servingName ? (
                            <Text style={styles.heroServing} numberOfLines={1}>
                              1 phần · {analyzedDish.nutrition.servingName}
                            </Text>
                          ) : null}
                          <ConfidenceBar value={score} color={tone.dot} />
                        </View>
                      </Animated.View>

                      {/* Macro tiles */}
                      <View style={styles.macroRow}>
                        {macros.map((m, i) => (
                          <Animated.View
                            key={`${analyzedDish.dishId}-${m.key}`}
                            entering={FadeInDown.delay(120 + i * 70).duration(360)}
                            style={[styles.macroTile, { backgroundColor: m.bg }]}
                          >
                            <View style={[styles.macroDot, { backgroundColor: m.color }]} />
                            <Text style={styles.macroValue} numberOfLines={1}>
                              {m.value == null ? '—' : Math.round(m.value * portions)}
                              <Text style={styles.macroUnit}> {m.unit}</Text>
                            </Text>
                            <Text style={styles.macroLabel}>{m.label}</Text>
                          </Animated.View>
                        ))}
                      </View>
                      <Text style={styles.nutritionNote}>
                        Dinh dưỡng cho {portions} phần, lấy từ dữ liệu món (không đo từ ảnh).
                      </Text>

                      {/* Gợi ý món khác */}
                      {choices.length > 1 ? (
                        <Animated.View entering={FadeIn.delay(300)} style={styles.sectionBlock}>
                          <Text style={styles.sectionTitle}>Có thể là</Text>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={{ flexGrow: 0 }}
                            contentContainerStyle={{ gap: 8, alignItems: 'center', paddingRight: 4 }}
                          >
                            {choices.map((candidate) => {
                              const isSelected = analyzedDish.dishId === candidate.dishId;
                              return (
                                <Pressable
                                  key={candidate.dishId}
                                  onPress={() => {
                                    if (isSelected) return;
                                    void Haptics.selectionAsync().catch(() => undefined);
                                    setAnalyzedDish(candidate);
                                    setPortions(1);
                                    setSaved(false);
                                    saveAttempt.current = null;
                                    if (result?.scanId) {
                                      void sendFoodScanFeedback(result.scanId, {
                                        dishId: candidate.dishId,
                                        correct: true,
                                      });
                                    }
                                  }}
                                  style={[styles.choiceChip, isSelected && styles.choiceChipActive]}
                                  accessibilityRole="button"
                                  accessibilityState={{ selected: isSelected }}
                                >
                                  {candidate.imageUrl ? (
                                    <Image source={{ uri: candidate.imageUrl }} style={styles.choiceThumb} />
                                  ) : (
                                    <View style={[styles.choiceThumb, styles.heroImageFallback]} />
                                  )}
                                  <Text
                                    numberOfLines={1}
                                    style={[styles.choiceTxt, isSelected && styles.choiceTxtActive]}
                                  >
                                    {candidate.name}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        </Animated.View>
                      ) : null}

                      <Pressable
                        onPress={() => handleOpenPickOther()}
                        style={styles.wrongDishBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Không đúng món, chọn món khác"
                      >
                        <Search size={15} color="#B45309" strokeWidth={2.4} />
                        <Text style={styles.wrongDishTxt}>Không đúng món? Tìm món khác</Text>
                      </Pressable>

                      {/* Khẩu phần + bữa */}
                      <Animated.View entering={FadeInDown.delay(360).duration(360)} style={styles.logCard}>
                        <View style={styles.portionRow}>
                          <Text style={styles.portionLabel}>Khẩu phần</Text>
                          <View style={styles.stepperWrap}>
                            <Pressable
                              disabled={saving || saved || !!saveAttempt.current || portions <= 1}
                              onPress={() => {
                                void Haptics.selectionAsync().catch(() => undefined);
                                setPortions((p) => Math.max(1, p - 1));
                              }}
                              style={[styles.stepperMinusBtn, portions <= 1 && styles.stepperBtnDisabled]}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel="Giảm khẩu phần"
                            >
                              <Minus size={16} color="#2A1A10" strokeWidth={2.6} />
                            </Pressable>
                            <Text style={styles.portionCountTxt}>{portions} phần</Text>
                            <Pressable
                              disabled={saving || saved || !!saveAttempt.current || portions >= 10}
                              onPress={() => {
                                void Haptics.selectionAsync().catch(() => undefined);
                                setPortions((p) => Math.min(10, p + 1));
                              }}
                              style={styles.stepperPlusBtn}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel="Tăng khẩu phần"
                            >
                              <Plus size={16} color="#2A1A10" strokeWidth={2.6} />
                            </Pressable>
                          </View>
                        </View>

                        <View style={styles.segment}>
                          {(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const).map((slot, index) => {
                            const active = mealSlot === slot;
                            return (
                              <Pressable
                                key={slot}
                                disabled={saving || saved || !!saveAttempt.current}
                                onPress={() => {
                                  void Haptics.selectionAsync().catch(() => undefined);
                                  setMealSlot(slot);
                                }}
                                style={[styles.segmentItem, active && styles.segmentItemActive]}
                                accessibilityRole="button"
                                accessibilityState={{ selected: active }}
                              >
                                <Text style={[styles.segmentTxt, active && styles.segmentTxtActive]}>
                                  {['Sáng', 'Trưa', 'Tối', 'Bữa phụ'][index]}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </Animated.View>

                      {message ? (
                        <Text accessibilityLiveRegion="polite" style={styles.nutritionNote}>
                          {message}
                        </Text>
                      ) : null}

                      {/* Actions */}
                      <View style={styles.actionButtonsWrap}>
                        <PressableScale
                          disabled={saving || saved}
                          onPress={() => void handleConfirmSave()}
                          accessibilityRole="button"
                          accessibilityLabel="Thêm vào nhật ký"
                          style={[styles.primaryCta, (saving || saved) && { opacity: 0.85 }]}
                        >
                          <LinearGradient
                            colors={saved ? ['#34D399', '#10B981'] : ['#FFD84D', '#FFB800']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                          />
                          {saving ? (
                            <ActivityIndicator color="#2A1A10" />
                          ) : saved ? (
                            <Check size={18} color="#FFFFFF" strokeWidth={3} />
                          ) : null}
                          <Text style={[styles.primaryCtaTxt, saved && { color: '#FFFFFF' }]}>
                            {saving
                              ? 'Đang lưu...'
                              : saved
                                ? 'Đã lưu vào nhật ký'
                                : saveAttempt.current
                                  ? 'Thử lưu lại'
                                  : kcal != null
                                    ? `Thêm vào nhật ký · ${Math.round(kcal * portions)} kcal`
                                    : 'Thêm vào nhật ký'}
                          </Text>
                        </PressableScale>

                        <View style={styles.secondaryRow}>
                          <PressableScale
                            onPress={handleViewDish}
                            containerStyle={styles.secondaryBtnSlot}
                            style={styles.secondaryBtn}
                            accessibilityRole="button"
                            accessibilityLabel="Xem chi tiết món ăn"
                          >
                            <Text style={styles.secondaryBtnTxt}>Xem món ăn</Text>
                          </PressableScale>
                          <PressableScale
                            onPress={handleRetake}
                            containerStyle={styles.secondaryBtnSlot}
                            style={styles.secondaryBtn}
                            accessibilityRole="button"
                            accessibilityLabel="Quét lại món ăn khác"
                          >
                            <Camera size={16} color="#2A1A10" strokeWidth={2.4} />
                            <Text style={styles.secondaryBtnTxt}>Quét lại</Text>
                          </PressableScale>
                        </View>
                      </View>
                    </>
                  );
                })()}
              </ScrollView>
            ) : null}
          </Animated.View>
        ) : null}

        {/* Candidate Selection & Search Modal for "Không đúng món" */}
        <Modal
          visible={pickOtherVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPickOtherVisible(false)}
        >
          <View style={styles.pickOtherBackdrop}>
            <View style={[styles.pickOtherCard, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              {/* Header */}
              <View style={styles.pickOtherHeader}>
                <Text style={styles.pickOtherTitle}>Chọn món chính xác</Text>
                <Pressable
                  onPress={() => setPickOtherVisible(false)}
                  hitSlop={12}
                  style={styles.pickOtherCloseBtn}
                >
                  <X size={20} color="#5C4533" />
                </Pressable>
              </View>

              {/* Search input */}
              <View style={styles.pickOtherSearchRow}>
                <Search size={18} color="#887569" />
                <TextInput
                  style={styles.pickOtherSearchInput}
                  placeholder="Tìm tên món trong thực đơn..."
                  placeholderTextColor="#A89689"
                  value={searchQuery}
                  onChangeText={(t) => void handleSearchDishes(t)}
                  autoCorrect={false}
                />
                {searching ? <ActivityIndicator size="small" color="#FFC928" /> : null}
              </View>

              <ScrollView
                style={{ maxHeight: 340 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Report: the dish simply isn't in Mogu yet (only from the match screen) */}
                {scanState === 'success' && result?.scanId ? (
                  <Pressable
                    style={styles.reportMissingRow}
                    disabled={reportingMissing}
                    onPress={() => void handleReportMissing()}
                    accessibilityRole="button"
                    accessibilityLabel="Món này chưa có trong Mogu"
                  >
                    <View style={styles.reportMissingIcon}>
                      <Text style={styles.unknownBadgeTxt}>?</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickOtherItemTitle}>Món này chưa có trong Mogu</Text>
                      <Text style={styles.pickOtherItemSub}>Gửi ảnh để Mogu bổ sung món mới</Text>
                    </View>
                    {reportingMissing ? (
                      <ActivityIndicator size="small" color="#B45309" />
                    ) : (
                      <View style={styles.pickOtherChooseBadge}>
                        <Text style={styles.pickOtherChooseTxt}>Báo</Text>
                      </View>
                    )}
                  </Pressable>
                ) : null}

                {/* Search Results */}
                {searchQuery.trim().length > 0 ? (
                  <View>
                    <Text style={styles.pickOtherSectionTitle}>
                      Kết quả tìm kiếm ({searchResults.length})
                    </Text>
                    {searchResults.length === 0 && !searching ? (
                      <Text style={styles.pickOtherEmptyTxt}>Không tìm thấy món phù hợp</Text>
                    ) : (
                      searchResults.map((item) => (
                        <Pressable
                          key={item.dishId}
                          style={styles.pickOtherItem}
                          onPress={() => handleSelectAlternative(item)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.pickOtherItemTitle}>{item.name}</Text>
                            <Text style={styles.pickOtherItemSub}>
                              {item.nutrition.calories ? `${item.nutrition.calories} kcal · ` : ''}1 phần
                            </Text>
                          </View>
                          <View style={styles.pickOtherChooseBadge}>
                            <Text style={styles.pickOtherChooseTxt}>Chọn</Text>
                          </View>
                        </Pressable>
                      ))
                    )}
                  </View>
                ) : (
                  /* Gợi ý món khác từ ảnh */
                  <View>
                    <Text style={styles.pickOtherSectionTitle}>Gợi ý từ ảnh đã chụp</Text>
                    {choices.map((candidate) => {
                      const isCurrent = analyzedDish?.dishId === candidate.dishId;
                      return (
                        <Pressable
                          key={candidate.dishId}
                          style={[
                            styles.pickOtherItem,
                            isCurrent && { backgroundColor: '#FFF8E7', borderColor: '#FFE4A0' },
                          ]}
                          onPress={() => handleSelectAlternative(candidate)}
                        >
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={styles.pickOtherItemTitle}>{candidate.name}</Text>
                              {candidate.confidenceLabel === 'HIGH' ? (
                                <View
                                  style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: 4,
                                    backgroundColor: '#10B981',
                                  }}
                                />
                              ) : null}
                            </View>
                            <Text style={styles.pickOtherItemSub}>
                              {candidate.nutrition.calories ? `${candidate.nutrition.calories} kcal · ` : ''}
                              {candidate.nutrition.servingName || '1 phần'}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.pickOtherChooseBadge,
                              isCurrent && { backgroundColor: '#FFC928' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.pickOtherChooseTxt,
                                isCurrent && { color: '#2A1A10', fontWeight: '800' },
                              ]}
                            >
                              {isCurrent ? 'Đang chọn' : 'Chọn'}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

/**
 * Pressable with a spring "press-in" scale. Styles are applied to an inner plain
 * View: NativeWind's css-interop drops function-form `style={({ pressed }) => …}`
 * on Pressable (Android), which rendered these buttons completely unstyled.
 */
function PressableScale({
  style,
  containerStyle,
  children,
  disabled,
  ...rest
}: Omit<React.ComponentProps<typeof Pressable>, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      {...rest}
      style={containerStyle}
      disabled={disabled}
      onPressIn={(e) => {
        scale.value = withSpring(0.97, { damping: 18, stiffness: 400 });
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 14, stiffness: 300 });
        rest.onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, animStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

const CONFIDENCE_TONES = {
  HIGH: { label: 'Rất chắc chắn', dot: '#10B981', bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46' },
  MEDIUM: { label: 'Có thể là món này', dot: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', text: '#92400E' },
  LOW: { label: 'Gợi ý tham khảo', dot: '#E5A000', bg: '#FFF8E7', border: '#FFE4A0', text: '#8B5E00' },
} as const;

/** Animated confidence meter under the dish title */
function ConfidenceBar({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(1, value));
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(pct, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [pct, progress]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return (
    <View style={styles.confBarRow}>
      <View style={styles.confBarTrack}>
        <Animated.View style={[styles.confBarFill, { backgroundColor: color }, fillStyle]} />
      </View>
      <Text style={styles.confBarTxt}>{Math.round(pct * 100)}%</Text>
    </View>
  );
}

const ANALYZING_STEPS = ['Đang đọc ảnh món ăn', 'So khớp với thư viện món', 'Chọn món phù hợp nhất'];

/** State 02 · modern analyzing panel: photo preview with scan beam, pulse rings, step list */
function AnalyzingPanel({ photoUri, onCancel }: { photoUri: string | null; onCancel: () => void }) {
  const [step, setStep] = useState(0);
  const pulse = useSharedValue(0);
  const beam = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false);
    beam.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, ANALYZING_STEPS.length - 1)), 1800);
    return () => {
      clearInterval(timer);
      cancelAnimation(pulse);
      cancelAnimation(beam);
    };
  }, [pulse, beam]);

  const ringA = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.55, 0]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.45]) }],
  }));
  const ringB = useAnimatedStyle(() => {
    const v = (pulse.value + 0.5) % 1;
    return {
      opacity: interpolate(v, [0, 1], [0.45, 0]),
      transform: [{ scale: interpolate(v, [0, 1], [1, 1.45]) }],
    };
  });
  const beamStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(beam.value, [0, 1], [-6, ANALYZE_THUMB - 10]) }],
  }));

  return (
    <View style={styles.analyzingContent}>
      <View style={styles.analyzeThumbWrap}>
        <Animated.View style={[styles.analyzeRing, ringA]} />
        <Animated.View style={[styles.analyzeRing, ringB]} />
        <View style={styles.analyzeThumb}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.heroImageFallback]}>
              <Camera size={30} color="#B2A398" />
            </View>
          )}
          <View style={styles.analyzeTint} />
          <Animated.View style={[styles.analyzeBeam, beamStyle]}>
            <LinearGradient
              colors={['rgba(255,200,40,0)', 'rgba(255,200,40,0.55)', 'rgba(255,255,255,0.95)']}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </View>

      <Text style={styles.analyzingTitle}>NOAN đang xem món...</Text>
      <Text style={styles.analyzingSub}>Thường mất vài giây, bạn chờ chút nhé</Text>

      <View style={styles.stepList}>
        {ANALYZING_STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <Animated.View
              key={label}
              entering={FadeInDown.delay(i * 120).duration(320)}
              style={styles.stepRow}
            >
              <View
                style={[
                  styles.stepIcon,
                  done && styles.stepIconDone,
                  active && styles.stepIconActive,
                ]}
              >
                {done ? (
                  <Check size={12} color="#FFFFFF" strokeWidth={3.2} />
                ) : active ? (
                  <ActivityIndicator size="small" color="#B45309" style={{ transform: [{ scale: 0.7 }] }} />
                ) : null}
              </View>
              <Text
                style={[
                  styles.stepTxt,
                  (done || active) && { color: '#2A1A10' },
                  active && { fontWeight: '700' },
                ]}
              >
                {label}
              </Text>
            </Animated.View>
          );
        })}
      </View>

      <PressableScale
        onPress={onCancel}
        style={styles.cancelBtn}
        accessibilityRole="button"
        accessibilityLabel="Hủy quét món"
      >
        <Text style={styles.secondaryBtnTxt}>Hủy</Text>
      </PressableScale>
    </View>
  );
}

const ANALYZE_THUMB = 112;

/** 3D-style yellow camera + magnifier inside a soft halo ("Món này chưa có trong NOAN"). */
function UnknownDishIllustration() {
  const float = useSharedValue(0);
  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(float);
  }, [float]);
  const floatStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(float.value, [0, 1], [0, -5]) },
      { rotate: `${interpolate(float.value, [0, 1], [-1.5, 1.5])}deg` },
    ],
  }));

  return (
    <View style={styles.illoWrap}>
      <View style={styles.illoHalo} />
      <Animated.View style={floatStyle}>
        <Svg width={150} height={120} viewBox="0 0 150 120">
          {/* sparkle strokes */}
          <Path d="M128 14 L121 27" stroke="#FFC928" strokeWidth={4} strokeLinecap="round" />
          <Path d="M141 32 L129 36" stroke="#FFC928" strokeWidth={4} strokeLinecap="round" />
          {/* camera body shadow */}
          <Rect x={14} y={34} width={98} height={70} rx={16} fill="#E0A21A" />
          {/* camera body */}
          <Rect x={12} y={30} width={98} height={68} rx={16} fill="#FFCB3D" />
          <Rect x={12} y={30} width={98} height={22} rx={16} fill="#FFD865" />
          {/* top bump + button */}
          <Rect x={34} y={20} width={34} height={16} rx={6} fill="#FFC21F" />
          <Rect x={80} y={23} width={16} height={9} rx={4} fill="#F4A916" />
          {/* lens */}
          <Circle cx={60} cy={66} r={25} fill="#E8A417" />
          <Circle cx={60} cy={66} r={21} fill="#F7F0E4" />
          <Circle cx={60} cy={66} r={15} fill="#5A3217" />
          <Circle cx={55} cy={61} r={4} fill="#8C5A35" />
          {/* magnifier handle */}
          <Path d="M118 94 L134 110" stroke="#6B3E1E" strokeWidth={10} strokeLinecap="round" />
          <Path d="M118 94 L134 110" stroke="#8C5A35" strokeWidth={5} strokeLinecap="round" />
          {/* magnifier ring + glass */}
          <Circle cx={104} cy={79} r={20} fill="#FFF6DD" fillOpacity={0.85} />
          <Circle cx={104} cy={79} r={20} stroke="#7A4622" strokeWidth={6} fill="none" />
          <Path
            d="M95 72 A10 10 0 0 1 104 68"
            stroke="#FFFFFF"
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Center circular badge for State 02 with spinning golden progress ring */
function ScanningCameraAvatar() {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1500, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(rotation);
  }, [rotation]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const radius = 34;
  const strokeWidth = 4.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * 0.35;

  return (
    <View style={styles.scanAvatarContainer}>
      <Animated.View style={[StyleSheet.absoluteFill, spinStyle]}>
        <Svg width={78} height={78} viewBox="0 0 78 78">
          {/* Base soft ring */}
          <Circle
            cx={39}
            cy={39}
            r={radius}
            stroke="#FFF0BE"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Active gold progress arc */}
          <Circle
            cx={39}
            cy={39}
            r={radius}
            stroke="#FFB800"
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference * 0.65} ${strokeDashoffset}`}
            strokeLinecap="round"
            fill="transparent"
          />
        </Svg>
      </Animated.View>
      <View style={styles.scanAvatarInner}>
        <Camera size={28} color="#2A1A10" strokeWidth={2.4} />
      </View>
    </View>
  );
}

/** 3 Animated Loading Dots in State 02 */
function LoadingDots() {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(withTiming(3, { duration: 1200, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [t]);

  return (
    <View style={styles.dotsRow}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} index={i} t={t} />
      ))}
    </View>
  );
}

function Dot({ index, t }: { index: number; t: SharedValue<number> }) {
  const dotStyle = useAnimatedStyle(() => {
    const cur = (t.value + index) % 3;
    const active = cur < 1.6;
    return {
      backgroundColor: active ? '#FFB800' : '#E8DFD5',
      transform: [{ scale: active ? 1.15 : 0.9 }],
      opacity: active ? 1 : 0.55,
    };
  });

  return <Animated.View style={[styles.dot, dotStyle]} />;
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
    <Animated.View style={[styles.laserWrap, animStyle]} pointerEvents="none">
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
    width: 84,
    height: 84,
    borderRadius: 42,
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
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFC928',
  },

  /* Backdrop behind bottom sheet */
  sheetBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 10, 8, 0.35)',
    zIndex: 25,
  },

  /* Bottom sheet container for States 02 & 03 */
  bottomSheetCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    zIndex: 30,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 12,
  },
  sheetDragHandle: {
    height: 44,
    marginTop: -12,
    marginHorizontal: -24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetGrip: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2D9CF',
    alignSelf: 'center',
  },

  /* STATE 02 · Đang phân tích */
  analyzingContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  scanAvatarContainer: {
    width: 78,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  scanAvatarInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFF8ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#2A1A10',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  analyzingSub: {
    fontSize: 14,
    color: '#6B5B52',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  /* STATE 03 · Nhận diện thành công */
  successContent: {
    alignItems: 'stretch',
    paddingBottom: 4,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  heroImageWrap: {
    width: 92,
    height: 92,
  },
  heroImage: {
    width: 92,
    height: 92,
    borderRadius: 24,
    backgroundColor: '#F4EEE6',
  },
  heroImageFallback: {
    backgroundColor: '#F4EEE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCheck: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 6,
  },
  confDot: { width: 7, height: 7, borderRadius: 4 },
  confPillTxt: { fontSize: 12, fontWeight: '700' },
  heroTitle: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
    color: '#2A1A10',
    letterSpacing: -0.4,
  },
  heroServing: {
    fontSize: 12.5,
    color: '#8C7C73',
    marginTop: 2,
  },
  confBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  confBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1EBE3',
    overflow: 'hidden',
  },
  confBarFill: { height: '100%', borderRadius: 3 },
  confBarTxt: { fontSize: 12, fontWeight: '800', color: '#5C4533', minWidth: 34, textAlign: 'right' },
  macroRow: {
    flexDirection: 'row',
    gap: 8,
  },
  macroTile: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  macroDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 6 },
  macroValue: { fontSize: 16, fontWeight: '900', color: '#2A1A10' },
  macroUnit: { fontSize: 11, fontWeight: '600', color: '#8C7C73' },
  macroLabel: { fontSize: 11.5, fontWeight: '600', color: '#8C7C73', marginTop: 2 },
  nutritionNote: {
    fontSize: 11.5,
    color: '#A3948A',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  sectionBlock: { marginBottom: 6 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#887569',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  choiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 200,
    paddingLeft: 4,
    paddingRight: 14,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FAF6F0',
    borderWidth: 1.5,
    borderColor: '#EFE7DC',
  },
  choiceChipActive: {
    backgroundColor: '#FFF4CC',
    borderColor: '#FFC928',
  },
  choiceThumb: { width: 30, height: 30, borderRadius: 15 },
  choiceTxt: { fontSize: 13, fontWeight: '600', color: '#6A5445', flexShrink: 1 },
  choiceTxtActive: { color: '#2A1A10', fontWeight: '800' },
  wrongDishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 4,
    marginBottom: 12,
    borderRadius: 999,
    backgroundColor: '#FFF7EB',
  },
  wrongDishTxt: { fontSize: 13, fontWeight: '700', color: '#B45309' },
  logCard: {
    borderRadius: 22,
    backgroundColor: '#FBF8F4',
    borderWidth: 1,
    borderColor: '#F1EAE0',
    padding: 14,
    gap: 12,
    marginBottom: 14,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#F1EBE3',
    borderRadius: 14,
    padding: 3,
  },
  segmentItem: {
    flex: 1,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#2A1A10',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentTxt: { fontSize: 13, fontWeight: '600', color: '#8C7C73' },
  segmentTxtActive: { color: '#2A1A10', fontWeight: '800' },
  primaryCta: {
    height: 54,
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FFB800',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  primaryCtaTxt: { fontSize: 15.5, fontWeight: '900', color: '#2A1A10' },
  secondaryRow: { flexDirection: 'row', gap: 10, width: '100%' },
  secondaryBtnSlot: { flex: 1 },
  secondaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E8DFD5',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryBtnPressed: { backgroundColor: '#F7F2EB' },
  secondaryBtnTxt: { fontSize: 14.5, fontWeight: '800', color: '#2A1A10' },
  analyzeThumbWrap: {
    width: ANALYZE_THUMB + 40,
    height: ANALYZE_THUMB + 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  analyzeRing: {
    position: 'absolute',
    width: ANALYZE_THUMB + 8,
    height: ANALYZE_THUMB + 8,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#FFC928',
  },
  analyzeThumb: {
    width: ANALYZE_THUMB,
    height: ANALYZE_THUMB,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#F4EEE6',
    shadowColor: '#B45309',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  analyzeTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(42, 26, 16, 0.18)',
  },
  analyzeBeam: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 16,
  },
  stepList: {
    alignSelf: 'stretch',
    gap: 10,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#E8DFD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconActive: { borderColor: '#FFC928', backgroundColor: '#FFF8E1' },
  stepIconDone: { borderColor: '#10B981', backgroundColor: '#10B981' },
  stepTxt: { fontSize: 14, fontWeight: '500', color: '#A3948A' },
  cancelBtn: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 999,
    backgroundColor: '#F7F2EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBadgeWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  successCheckIconCircle: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#FFB800',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dishSuccessTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: '#2A1A10',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  dishSuccessSub: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#6B5B52',
    textAlign: 'center',
    marginTop: 5,
  },
  dishSuccessNote: {
    fontSize: 12.5,
    color: '#8C7C73',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  portionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  portionLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2A1A10',
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperMinusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFE9E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperPlusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFC928',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.5,
  },
  portionCountTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2A1A10',
    minWidth: 48,
    textAlign: 'center',
  },
  actionButtonsWrap: {
    width: '100%',
    gap: 10,
  },
  retakeLinkPressable: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retakeLinkTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2A1A10',
    textAlign: 'center',
  },
  pickOtherBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickOtherCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  pickOtherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pickOtherTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2A1A10',
  },
  pickOtherCloseBtn: {
    padding: 6,
  },
  pickOtherSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F3EE',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16,
    gap: 8,
  },
  pickOtherSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#2A1A10',
    paddingVertical: 0,
  },
  pickOtherSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#887569',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickOtherEmptyTxt: {
    fontSize: 14,
    color: '#887569',
    textAlign: 'center',
    marginVertical: 20,
  },
  pickOtherItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFE9E1',
    backgroundColor: '#FAF7F2',
    marginBottom: 8,
  },
  pickOtherItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2A1A10',
  },
  pickOtherItemSub: {
    fontSize: 12,
    color: '#887569',
    marginTop: 2,
  },
  pickOtherChooseBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#ECE5DB',
  },
  pickOtherChooseTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5C4533',
  },
  reportMissingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    marginBottom: 12,
  },
  reportMissingIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unknownBadgeTxt: { fontSize: 14, fontWeight: '900', color: '#FFFFFF', lineHeight: 17 },
  /* STATE 03b · Món chưa có trong NOAN */
  bottomSheetCream: { backgroundColor: '#FFFBF3' },
  illoWrap: {
    width: 170,
    height: 150,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  illoHalo: {
    position: 'absolute',
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: '#FFF1C7',
  },
  unknownContent: { alignItems: 'stretch', paddingBottom: 4 },
  unknownPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFEFC2',
  },
  unknownPillTxt: { fontSize: 13, fontWeight: '700', color: '#5C3B12' },
  unknownTitle: {
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '900',
    color: '#4A1F0F',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  unknownDesc: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6B5B52',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
  },
  unknownCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1EAE0',
  },
  unknownCardThumb: { width: 96, height: 70, borderRadius: 14, backgroundColor: '#F4EEE6' },
  unknownCardTitle: { fontSize: 17, fontWeight: '900', color: '#3B1A0C' },
  unknownCardSub: { fontSize: 13, color: '#9A8A80', marginTop: 4 },
  unknownActions: { gap: 12, marginTop: 16 },
  unknownPrimaryBtn: {
    height: 50,
    borderRadius: 16,
    backgroundColor: '#FFC928',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#FFB800',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  unknownPrimaryTxt: { fontSize: 16, fontWeight: '800', color: '#2A1A10' },
  unknownSecondaryBtn: {
    height: 50,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9CFC4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  unknownSecondaryTxt: { fontSize: 16, fontWeight: '800', color: '#3B1A0C' },
  unknownLinkTxt: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A1F0F',
    textDecorationLine: 'underline',
  },
});

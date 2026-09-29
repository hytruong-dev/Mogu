import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  List,
  MoreVertical,
  X,
} from '@/components/icons';
import { AppImage } from '../../components/ui/app-image';
import { BORDER, CREAM, INK, MUTED, WHITE, YELLOW, cardShadow } from './tokens';
import type { DishIngredient, DishRecipeStep } from './types';
import { formatMmSs, ingredientDisplayName, normalizeSteps, totalStepsDurationMin } from './utils';
import { StepsSheet } from './StepsSheet';
import { useKeepAwake } from 'expo-keep-awake';
import { createAudioPlayer } from 'expo-audio';
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text as UIText } from '@/components/ui/text';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { healthApi } from '@/services/api/health';
import { recordMealLoggedStore } from '@/services/app-store';
import { getDeviceTimeZone } from '@/lib/dates';
import { useCookingVoice } from './voice/useCookingVoice';
import type { CookingAction } from './voice/cooking-intents';
import { VoiceOrb } from './voice/VoiceOrb';
import { expireCookingTimers, timerRemaining, type CookingTimer } from './cooking-timers';

type Notifications = typeof import('expo-notifications');
function notificationsModule(): Notifications | null {
  if (Platform.OS === 'android' && isRunningInExpoGo()) return null;
  try {
    return require('expo-notifications') as Notifications;
  } catch {
    return null;
  }
}

type Props = {
  dishId?: string;
  servings?: number | null;
  dishName: string;
  image?: ImageSourcePropType;
  ingredients?: DishIngredient[];
  recipeSteps?: DishRecipeStep[];
  onBack: () => void;
  onFinish: () => void;
};

type TimerState = CookingTimer;

export function CookingPage({
  dishId,
  servings,
  dishName,
  image,
  ingredients = [],
  recipeSteps = [],
  onBack,
  onFinish,
}: Props) {
  useKeepAwake('noan-cooking');
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [showOptions, setShowOptions] = useState(false);
  const [voiceStarted, setVoiceStarted] = useState(false);
  const [autoTimer, setAutoTimer] = useState(false);
  const [finished, setFinished] = useState(false);
  const [savedMeal, setSavedMeal] = useState(false);
  const [savingMeal, setSavingMeal] = useState(false);
  const saveLock = useRef(false);
  const saveAttempt = useRef<{
    key: string;
    body: Parameters<typeof healthApi.createMealLog>[0];
  } | null>(null);
  const confirmationGeneration = useRef(0);
  const pendingConfirm = useRef<{
    step: number;
    target: number;
    expires: number;
    generation: number;
  } | null>(null);
  const chimePlayer = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const finishChime = useRef<(() => void) | null>(null);
  const pendingExpiries = useRef(new Set<number>());
  const timerDeliveryGeneration = useRef(0);
  const timerDeliveryInFlight = useRef(false);
  const [expiryBanner, setExpiryBanner] = useState<{
    text: string;
    steps: number[];
    generation: number;
  } | null>(null);
  const [pendingTarget, setPendingTarget] = useState<number | null>(null);
  const notificationIds = useRef<Record<number, string>>({});
  const notificationVersions = useRef<Record<number, number>>({});
  const alive = useRef(true);
  const onVoiceAction = useRef<(action: CookingAction) => void>(() => {});
  const steps = useMemo(() => normalizeSteps(recipeSteps), [recipeSteps]);
  const [stepIdx, setStepIdx] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(() => new Set());
  const [showSteps, setShowSteps] = useState(false);
  const [instrExpanded, setInstrExpanded] = useState(false);
  const [tick, setTick] = useState(0);
  const timers = useRef<Record<number, TimerState>>({});

  const current = steps[stepIdx];
  const total = steps.length;
  const isLast = stepIdx >= total - 1;

  const durationSec =
    current?.durationMin != null && current.durationMin > 0 ? current.durationMin * 60 : null;

  const getTimer = useCallback(
    (idx: number): TimerState => {
      const t = timers.current[idx];
      if (t) return t;
      const dur = steps[idx]?.durationMin;
      const remaining = dur != null && dur > 0 ? dur * 60 : 0;
      const init: TimerState = { endsAt: null, remainingSec: remaining, running: false };
      return init;
    },
    [steps],
  );

  const displayRemaining = useCallback(
    (idx: number) => {
      return timerRemaining(getTimer(idx));
    },
    [getTimer],
  );

  const voice = useCookingVoice({
    dishId,
    dishName,
    stepIdx,
    steps,
    ingredients,
    servings: servings ?? undefined,
    timerRemainingSec:
      durationSec != null || timers.current[stepIdx] ? displayRemaining(stepIdx) : undefined,
    onAction: (action) => onVoiceAction.current(action),
  });
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const cancelNotification = (idx: number) => {
    notificationVersions.current[idx] = (notificationVersions.current[idx] ?? 0) + 1;
    const id = notificationIds.current[idx];
    delete notificationIds.current[idx];
    if (id)
      void notificationsModule()
        ?.cancelScheduledNotificationAsync(id)
        .catch(() => {});
  };
  const scheduleNotification = async (idx: number, seconds: number) => {
    cancelNotification(idx);
    const version = notificationVersions.current[idx];
    const notifications = notificationsModule();
    if (!notifications) return;
    try {
      notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          const visible =
            notification.request.content.data?.type !== 'cooking_timer' ||
            AppState.currentState !== 'active';
          return {
            shouldShowBanner: visible,
            shouldShowList: visible,
            shouldPlaySound: visible,
            shouldSetBadge: false,
          };
        },
      });
      const permission = await notifications.getPermissionsAsync();
      if (!permission.granted) return;
      if (Platform.OS === 'android')
        await notifications.setNotificationChannelAsync('noan-cooking', {
          name: 'Hẹn giờ nấu ăn',
          importance: notifications.AndroidImportance.HIGH,
          sound: 'default',
        });
      const id = await notifications.scheduleNotificationAsync({
        content: {
          title: 'NOAN · Hết giờ nấu',
          body: `${dishName} — bước ${idx + 1}`,
          sound: 'default',
          data: { type: 'cooking_timer' },
        },
        trigger: {
          type: notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, seconds),
          channelId: 'noan-cooking',
        },
      });
      if (
        !alive.current ||
        notificationVersions.current[idx] !== version ||
        !timers.current[idx]?.running
      )
        await notifications.cancelScheduledNotificationAsync(id);
      else notificationIds.current[idx] = id;
    } catch {
      /* Foreground timers still work without notification permission. */
    }
  };
  const startTimer = (idx: number, customSeconds?: number) => {
    const timer = getTimer(idx);
    if (timer.running && customSeconds == null) return false;
    const seconds =
      customSeconds ??
      (timer.remainingSec > 0 ? timer.remainingSec : (steps[idx]?.durationMin ?? 0) * 60);
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 86400) return false;
    timers.current[idx] = {
      endsAt: Date.now() + seconds * 1000,
      remainingSec: seconds,
      running: true,
    };
    void scheduleNotification(idx, seconds);
    setTick((n) => n + 1);
    return true;
  };
  const pauseTimer = (idx: number) => {
    const timer = getTimer(idx);
    if (!timer.running) return false;
    timers.current[idx] = { endsAt: null, remainingSec: displayRemaining(idx), running: false };
    cancelNotification(idx);
    setTick((n) => n + 1);
    return true;
  };
  const toggleTimer = () => {
    if (getTimer(stepIdx).running) pauseTimer(stepIdx);
    else startTimer(stepIdx);
  };
  const stopChime = () => {
    finishChime.current?.();
    finishChime.current = null;
    try {
      chimePlayer.current?.pause();
      chimePlayer.current?.remove();
    } catch {
      /* released */
    }
    chimePlayer.current = null;
  };
  const playChime = async () => {
    stopChime();
    try {
      const player = createAudioPlayer(require('../../assets/audio/food-reel/success.wav'));
      chimePlayer.current = player;
      await new Promise<void>((resolve) => {
        let done = false;
        let timeout: ReturnType<typeof setTimeout>;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(timeout);
          subscription.remove();
          if (finishChime.current === finish) finishChime.current = null;
          resolve();
        };
        const subscription = player.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish) finish();
        });
        finishChime.current = finish;
        timeout = setTimeout(finish, 4000);
        player.play();
      });
      if (chimePlayer.current === player) stopChime();
    } catch {
      stopChime();
    }
  };
  useEffect(() => {
    let activation: ReturnType<typeof setTimeout> | null = null;
    const check = () => {
      // Leave deadlines intact in the background so foreground consumes every event once.
      if (AppState.currentState !== 'active' || !alive.current) return;
      const expired = expireCookingTimers(
        timers.current,
        Date.now(),
        AppState.currentState === 'active',
      );
      expired.forEach((idx) => pendingExpiries.current.add(idx));
      if (pendingExpiries.current.size && !timerDeliveryInFlight.current) {
        const batch = [...pendingExpiries.current];
        const generation = timerDeliveryGeneration.current;
        const text = `Hết giờ bước ${batch.map((idx) => idx + 1).join(', ')}. Kiểm tra món trước khi chuyển bước nhé.`;
        timerDeliveryInFlight.current = true;
        confirmationGeneration.current++;
        pendingConfirm.current = null;
        setPendingTarget(null);
        if (voiceRef.current.enabled) voiceRef.current.stopSpeaking();
        void playChime()
          .then(() => {
            if (
              !alive.current ||
              AppState.currentState !== 'active' ||
              generation !== timerDeliveryGeneration.current
            )
              return;
            // The banner is authoritative even if speech is interrupted or fails.
            // Queue removal happens only after React commits this foreground text.
            setExpiryBanner((previous) => {
              const steps = [...new Set([...(previous?.steps ?? []), ...batch])];
              return {
                text: `Hết giờ bước ${steps.map((idx) => idx + 1).join(', ')}. Kiểm tra món trước khi chuyển bước nhé.`,
                steps,
                generation,
              };
            });
            if (voiceRef.current.enabled)
              void voiceRef.current.speak(text, undefined, false, false);
            else Alert.alert('Hết giờ nấu', text);
          })
          .finally(() => {
            timerDeliveryInFlight.current = false;
          });
      }
      setTick((n) => n + 1);
    };
    const id = setInterval(check, 500);
    const sub = AppState.addEventListener('change', (state) => {
      if (activation) clearTimeout(activation);
      if (state === 'active') activation = setTimeout(check, 0);
      else {
        timerDeliveryGeneration.current++;
        confirmationGeneration.current++;
        pendingConfirm.current = null;
        setPendingTarget(null);
        stopChime();
      }
    });
    return () => {
      clearInterval(id);
      if (activation) clearTimeout(activation);
      sub.remove();
      stopChime();
    };
  }, []);
  useEffect(() => {
    if (
      !expiryBanner ||
      AppState.currentState !== 'active' ||
      expiryBanner.generation !== timerDeliveryGeneration.current
    )
      return;
    expiryBanner.steps.forEach((idx) => {
      pendingExpiries.current.delete(idx);
      cancelNotification(idx);
    });
    // Keep the committed text visible until the user explicitly dismisses it.
  }, [expiryBanner]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      timerDeliveryGeneration.current++;
      confirmationGeneration.current++;
      stopChime();
      Object.keys(notificationIds.current).forEach((idx) => cancelNotification(Number(idx)));
    };
  }, []);
  void tick;

  const goToStep = (idx: number, skipConfirm = false) => {
    if (idx < 0 || idx >= total) return;
    clearConfirmation();
    const jumpingAhead = idx > stepIdx + 1 || (idx > stepIdx && !completed.has(stepIdx));
    if (jumpingAhead && !skipConfirm && idx > stepIdx) {
      Alert.alert('Bỏ qua bước?', 'Bạn chưa hoàn thành bước hiện tại.', [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Chuyển bước',
          onPress: () => {
            setStepIdx(idx);
            setInstrExpanded(false);
            setShowSteps(false);
          },
        },
      ]);
      return;
    }
    // Pause current running timer when leaving? keep endsAt so it continues in background
    setStepIdx(idx);
    setInstrExpanded(false);
    setShowSteps(false);
  };

  const completeStep = () => {
    const next = new Set(completed);
    next.add(stepIdx);
    setCompleted(next);
    if (isLast) {
      requestVoiceStep(total);
      return;
    }
    setStepIdx(stepIdx + 1);
    setInstrExpanded(false);
  };

  const clearConfirmation = () => {
    confirmationGeneration.current++;
    pendingConfirm.current = null;
    setPendingTarget(null);
  };
  const muteVoice = () => {
    clearConfirmation();
    setVoiceStarted(false);
    voice.mute();
  };
  const finishCooking = () => {
    clearConfirmation();
    setFinished(true);
    Object.keys(timers.current).forEach((idx) => pauseTimer(Number(idx)));
    stopChime();
    if (voice.enabled) {
      const generation = confirmationGeneration.current;
      void voice
        .speak(
          `Chúc mừng bạn đã nấu xong ${dishName}! Bạn có thể ghi bữa ăn bằng nút trên màn hình nhé.`,
          undefined,
          false,
          false,
        )
        .finally(() => {
          if (alive.current && generation === confirmationGeneration.current)
            voiceRef.current.mute();
        });
    }
  };
  const requestVoiceStep = (target: number) => {
    if (target < 0 || target > total || target === stepIdx) return;
    const finishing = target === total;
    if (finishing || (target > stepIdx && !completed.has(stepIdx))) {
      clearConfirmation();
      const pending = {
        step: stepIdx,
        target,
        expires: Date.now() + 8000,
        generation: confirmationGeneration.current,
      };
      pendingConfirm.current = pending;
      setPendingTarget(target);
      if (!voice.enabled) return;
      void voice
        .speak(
          finishing
            ? 'Bạn muốn hoàn tất nấu món này phải không?'
            : 'Bạn chưa hoàn thành bước này. Vẫn chuyển bước nhé?',
        )
        .then(() => {
          if (
            alive.current &&
            AppState.currentState === 'active' &&
            voiceRef.current.enabled &&
            pendingConfirm.current === pending &&
            pending.generation === confirmationGeneration.current
          ) {
            pending.expires = Date.now() + 8000;
            voiceRef.current.openReplyWindow();
          }
        });
    } else goToStep(target, true);
  };
  onVoiceAction.current = (action) => {
    if (finished) return;
    if (action.type === 'YES' || action.type === 'NO') {
      const pending = pendingConfirm.current;
      const valid =
        pending &&
        pending.step === stepIdx &&
        pending.expires > Date.now() &&
        pending.generation === confirmationGeneration.current &&
        AppState.currentState === 'active';
      clearConfirmation();
      if (action.type === 'YES' && valid) {
        if (pending.target === total) finishCooking();
        else goToStep(pending.target, true);
      }
      return;
    }
    clearConfirmation();
    switch (action.type) {
      case 'START':
        setVoiceStarted(true);
        break;
      case 'NEXT':
        requestVoiceStep(isLast ? total : stepIdx + 1);
        break;
      case 'PREV':
        requestVoiceStep(stepIdx - 1);
        break;
      case 'GOTO':
        requestVoiceStep(action.stepIndex);
        break;
      case 'FINISH':
        requestVoiceStep(total);
        break;
      case 'START_TIMER': {
        const changed = startTimer(stepIdx);
        void voice.speak(
          changed
            ? `Đã bắt đầu hẹn giờ ${displayRemaining(stepIdx)} giây.`
            : getTimer(stepIdx).running
              ? 'Hẹn giờ đang chạy.'
              : 'Bước này chưa có thời gian. Bạn có thể nói hẹn giờ 5 phút.',
        );
        break;
      }
      case 'SET_TIMER':
        if (startTimer(stepIdx, action.seconds))
          void voice.speak(`Đã hẹn giờ ${action.seconds} giây.`);
        break;
      case 'PAUSE_TIMER': {
        const changed = pauseTimer(stepIdx);
        void voice.speak(
          changed
            ? `Đã tạm dừng, còn ${displayRemaining(stepIdx)} giây.`
            : 'Hẹn giờ hiện không chạy.',
        );
        break;
      }
      case 'PAUSE':
        pauseTimer(stepIdx);
        break;
    }
  };
  useEffect(() => {
    clearConfirmation();
  }, [stepIdx, voice.enabled, voice.rate, dishId]);
  useEffect(() => {
    if (voice.state === 'paused' && pendingConfirm.current) clearConfirmation();
  }, [voice.state]);
  useEffect(() => {
    if (!voice.enabled || !voiceStarted || finished) return;
    let cancelled = false;
    const idx = stepIdx;
    const generation = confirmationGeneration.current;
    const shouldStart = autoTimer && !timers.current[idx] && (steps[idx]?.durationMin ?? 0) > 0;
    if (shouldStart) startTimer(idx);
    void voice.speakStep(idx).then(() => {
      if (
        !cancelled &&
        alive.current &&
        AppState.currentState === 'active' &&
        generation === confirmationGeneration.current &&
        shouldStart &&
        timers.current[idx]?.running &&
        voiceRef.current.enabled
      )
        void voiceRef.current.speak(
          `Đã bắt đầu hẹn giờ ${displayRemaining(idx)} giây cho bước ${idx + 1}.`,
        );
    });
    return () => {
      cancelled = true;
    };
  }, [stepIdx, voiceStarted, voice.enabled, finished]);
  const beginCooking = () => {
    setVoiceStarted(true);
    void voice.beginCooking();
  };
  const saveMeal = () => {
    if (!dishId || savedMeal || saveLock.current) return;
    const now = new Date();
    const hour = now.getHours();
    const mealSlot = hour < 10 ? 'BREAKFAST' : hour < 14 ? 'LUNCH' : hour < 17 ? 'SNACK' : 'DINNER';
    const slotLabel = {
      BREAKFAST: 'bữa sáng',
      LUNCH: 'bữa trưa',
      SNACK: 'bữa phụ',
      DINNER: 'bữa tối',
    }[mealSlot];
    Alert.alert('Ghi bữa ăn?', `Ghi 1 khẩu phần ${dishName} vào ${slotLabel} hôm nay?`, [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Ghi bữa ăn',
        onPress: async () => {
          if (saveLock.current) return;
          saveLock.current = true;
          setSavingMeal(true);
          saveAttempt.current ??= {
            key: `cooking-${dishId}-${now.getTime()}`,
            body: {
              mealSlot,
              timezone: getDeviceTimeZone(),
              occurredAt: now.toISOString(),
              items: [
                { referenceType: 'DISH', referenceId: dishId, quantity: 1, unitCode: 'SERVING' },
              ],
            },
          };
          try {
            await healthApi.createMealLog(saveAttempt.current.body, saveAttempt.current.key);
            recordMealLoggedStore();
            void queryClient.invalidateQueries({ queryKey: ['health'] });
            if (alive.current) setSavedMeal(true);
          } catch (error) {
            if (alive.current)
              Alert.alert(
                'Chưa lưu được',
                error instanceof Error ? error.message : 'Vui lòng thử lại.',
              );
          } finally {
            saveLock.current = false;
            if (alive.current) setSavingMeal(false);
          }
        },
      },
    ]);
  };

  const timerExpiryNotice = expiryBanner ? (
    <Card
      className="my-3 gap-3 rounded-2xl border-primary bg-card p-4"
      accessibilityLiveRegion="assertive"
    >
      <UIText className="font-bold">Hết giờ nấu</UIText>
      <UIText>{expiryBanner.text}</UIText>
      <Button
        variant="secondary"
        onPress={() => setExpiryBanner(null)}
        className="min-h-12 active:opacity-80"
        accessibilityLabel="Đã xem thông báo hết giờ nấu"
      >
        <UIText>Đã kiểm tra</UIText>
      </Button>
    </Card>
  ) : null;

  if (finished)
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View className="flex-1 justify-center gap-4 px-6">
          {timerExpiryNotice}
          <Card className="gap-4 rounded-3xl p-6">
            <UIText className="text-2xl font-bold">Món ăn đã sẵn sàng</UIText>
            <UIText>
              Chúc mừng bạn đã hoàn tất {dishName}. Kiểm tra độ chín trước khi thưởng thức nhé.
            </UIText>
            {dishId && (
              <Button
                onPress={saveMeal}
                disabled={savingMeal || savedMeal}
                className="min-h-12 active:opacity-80"
              >
                <UIText>
                  {savedMeal ? 'Đã ghi bữa ăn' : savingMeal ? 'Đang lưu…' : 'Ghi bữa ăn'}
                </UIText>
              </Button>
            )}
            {voice.enabled && (
              <Button
                variant="secondary"
                onPress={voice.stopSpeaking}
                className="min-h-12 active:opacity-80"
              >
                <UIText>Dừng NOAN</UIText>
              </Button>
            )}
            <Button variant="secondary" onPress={onFinish} className="min-h-12 active:opacity-80">
              <UIText>Hoàn tất</UIText>
            </Button>
          </Card>
        </View>
      </SafeAreaView>
    );

  if (!current || total === 0) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.iconBtn}>
            <X size={22} color={INK} />
          </Pressable>
          <Text style={styles.headerTitle}>Đang nấu</Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={{ padding: 24 }}>
          <Text style={{ color: MUTED }}>Chưa có bước nấu nào.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const body = current.body || current.instruction;
  const bodyLong = body.length > 160;
  const stepMedia = current.imageUrl ? { uri: current.imageUrl } : image;
  // Design always shows hero media; use step image or dish image
  const showMedia = !!stepMedia;

  const hasIngredientMapping = !!current.ingredientIds?.length;
  const stepIngs = hasIngredientMapping
    ? ingredients.filter((ing) => ing.id && current.ingredientIds?.includes(ing.id))
    : ingredients;
  const remaining =
    durationSec != null || timers.current[stepIdx] ? displayRemaining(stepIdx) : null;
  const timerRunning = getTimer(stepIdx).running;

  const doneCount = completed.size;
  const remainingMin = (() => {
    const totalDur = totalStepsDurationMin(recipeSteps);
    if (totalDur == null) return null;
    let doneDur = 0;
    steps.forEach((s, i) => {
      if (completed.has(i) && s.durationMin != null) doneDur += s.durationMin;
    });
    return Math.max(0, totalDur - doneDur);
  })();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.iconBtn} accessibilityLabel="Đóng">
          <X size={22} color={INK} />
        </Pressable>
        <Text style={styles.headerTitle}>
          Bước {stepIdx + 1}/{total}
        </Text>
        <Pressable
          onPress={() => setShowOptions(true)}
          style={styles.iconBtn}
          accessibilityLabel="Tuỳ chọn giọng nói"
        >
          <MoreVertical size={20} color={INK} />
        </Pressable>
      </View>
      <View style={styles.progressRow}>
        {steps.map((_, i) => (
          <View
            key={`pg-${i}`}
            style={[
              styles.progressSeg,
              i <= stepIdx && styles.progressSegOn,
              i < total - 1 && { marginRight: 3 },
            ]}
          />
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 + insets.bottom }}
      >
        {timerExpiryNotice}
        <VoiceOrb
          voice={voice}
          started={voiceStarted}
          onStartCooking={beginCooking}
          onMute={muteVoice}
          onInterrupt={clearConfirmation}
        />
        {pendingTarget != null && (
          <Card className="mt-3 gap-3 rounded-2xl p-4">
            <UIText>
              {pendingTarget === total
                ? 'Hoàn tất nấu món này?'
                : `Chuyển sang bước ${pendingTarget + 1} khi chưa hoàn thành bước này?`}
            </UIText>
            <View className="flex-row gap-3">
              <Button
                onPress={() => onVoiceAction.current({ type: 'YES' })}
                className="min-h-12 flex-1 active:opacity-80"
              >
                <UIText>{pendingTarget === total ? 'Hoàn tất món ăn' : 'Chuyển bước'}</UIText>
              </Button>
              <Button
                variant="secondary"
                onPress={() => onVoiceAction.current({ type: 'NO' })}
                className="min-h-12 flex-1 active:opacity-80"
              >
                <UIText>Ở lại</UIText>
              </Button>
            </View>
          </Card>
        )}
        <View style={styles.media}>
          {showMedia ? (
            <AppImage source={stepMedia} style={styles.mediaImg} contentFit="cover" />
          ) : (
            <View style={[styles.mediaImg, { backgroundColor: '#EDE6D8' }]} />
          )}
        </View>

        <View style={styles.titleRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{stepIdx + 1}</Text>
          </View>
          <Text style={styles.stepTitle}>{current.title}</Text>
        </View>

        <Text style={styles.instr} numberOfLines={instrExpanded ? undefined : 4}>
          {body}
        </Text>
        {bodyLong ? (
          <Pressable onPress={() => setInstrExpanded((v) => !v)} style={styles.moreRow}>
            <Text style={styles.moreText}>{instrExpanded ? 'Thu gọn' : 'Xem thêm'}</Text>
            <ChevronDown size={16} color={INK} />
          </Pressable>
        ) : null}

        {stepIngs.length > 0 ? (
          <View style={{ marginTop: 20 }}>
            <Text style={styles.sectionLabel}>
              {hasIngredientMapping ? 'Dùng trong bước này' : 'Nguyên liệu của món'}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 10 }}
              contentContainerStyle={{ paddingVertical: 2 }}
            >
              {stepIngs.map((ing, i) => (
                <View key={`si-${i}`} style={styles.ingChip}>
                  {ing.imageUrl ? (
                    <AppImage uri={ing.imageUrl} style={styles.ingChipImg} contentFit="cover" />
                  ) : (
                    <View style={[styles.ingChipImg, { backgroundColor: '#F0EBE0' }]} />
                  )}
                  <Text style={styles.ingChipName} numberOfLines={2}>
                    {ingredientDisplayName(ing)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {remaining != null ? (
          <View style={styles.timerCard}>
            <Clock3 size={18} color={INK} />
            <Text style={styles.timerVal}>{formatMmSs(remaining)}</Text>
            <Pressable onPress={toggleTimer} style={styles.timerBtn}>
              <Text style={styles.timerBtnText}>{timerRunning ? 'Tạm dừng' : 'Bắt đầu'}</Text>
            </Pressable>
          </View>
        ) : null}
        <View className="mt-3 flex-row flex-wrap gap-2">
          {[60, 300, 600].map((seconds) => (
            <Button
              key={seconds}
              variant="secondary"
              onPress={() => startTimer(stepIdx, seconds)}
              className="min-h-12 rounded-2xl active:opacity-80"
              accessibilityLabel={`Đặt hẹn giờ ${seconds / 60} phút cho bước hiện tại`}
            >
              <UIText>{seconds / 60} phút</UIText>
            </Button>
          ))}
          {voice.enabled && (
            <Button
              variant="ghost"
              onPress={() => void voice.repeat()}
              className="min-h-12 active:opacity-80"
            >
              <UIText>Đọc lại bước</UIText>
            </Button>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(12, insets.bottom) }]}>
        <Pressable
          onPress={() => setShowSteps(true)}
          style={styles.secondary}
          accessibilityLabel="Xem các bước"
        >
          <List size={18} color={INK} />
          <Text style={styles.secondaryText}>Xem các bước</Text>
        </Pressable>
        <Pressable
          onPress={completeStep}
          style={styles.primary}
          accessibilityLabel="Hoàn thành bước"
        >
          <Text style={styles.primaryText}>{isLast ? 'Hoàn tất món ăn' : 'Hoàn thành bước'}</Text>
          {!isLast ? <ChevronRight size={18} color={INK} /> : <Check size={18} color={INK} />}
        </Pressable>
      </View>

      <Drawer open={showOptions} onOpenChange={setShowOptions}>
        <DrawerHeader>
          <DrawerTitle>Tuỳ chọn khi nấu</DrawerTitle>
        </DrawerHeader>
        <DrawerContent className="gap-3 px-5 pb-6">
          <UIText>
            Tự hẹn giờ chỉ bắt đầu sau khi bạn chọn Bắt đầu nấu. Không đặt lại hẹn giờ đã có khi
            quay lại bước.
          </UIText>
          <Button
            variant="secondary"
            onPress={() => setAutoTimer((value) => !value)}
            className="min-h-12 active:opacity-80"
            accessibilityRole="switch"
            accessibilityState={{ checked: autoTimer }}
          >
            <UIText>Tự hẹn giờ: {autoTimer ? 'Bật' : 'Tắt'}</UIText>
          </Button>
          <UIText>Tốc độ đọc</UIText>
          <View className="flex-row gap-2">
            {[0.85, 1, 1.15].map((rate) => (
              <Button
                key={rate}
                variant={voice.rate === rate ? 'default' : 'secondary'}
                onPress={() => {
                  clearConfirmation();
                  voice.setRate(rate);
                }}
                className="min-h-12 flex-1 active:opacity-80"
              >
                <UIText>{rate === 0.85 ? 'Chậm' : rate === 1 ? 'Vừa' : 'Nhanh'}</UIText>
              </Button>
            ))}
          </View>
          <Button
            variant="secondary"
            onPress={async () => {
              const notifications = notificationsModule();
              if (!notifications) {
                Alert.alert(
                  'Thông báo chưa hỗ trợ',
                  'Hãy dùng Development Build. Hẹn giờ trên màn hình vẫn hoạt động.',
                );
                return;
              }
              const permission = await notifications.requestPermissionsAsync().catch(() => null);
              Alert.alert(
                permission?.granted ? 'Đã bật thông báo' : 'Chưa bật thông báo',
                permission?.granted
                  ? 'NOAN có thể nhắc hẹn giờ khi ứng dụng ở nền.'
                  : 'Bạn có thể cấp quyền trong cài đặt thiết bị.',
              );
              if (permission?.granted)
                Object.entries(timers.current).forEach(([idx, timer]) => {
                  if (timer.running)
                    void scheduleNotification(Number(idx), displayRemaining(Number(idx)));
                });
            }}
            className="min-h-12 active:opacity-80"
          >
            <UIText>Cho phép nhắc hẹn giờ khi ở nền</UIText>
          </Button>
          {voice.enabled && (
            <Button
              variant="secondary"
              onPress={() => {
                muteVoice();
                setShowOptions(false);
              }}
              className="min-h-12 active:opacity-80"
            >
              <UIText>Tắt giọng NOAN</UIText>
            </Button>
          )}
          <Button onPress={() => setShowOptions(false)} className="min-h-12 active:opacity-80">
            <UIText>Xong</UIText>
          </Button>
        </DrawerContent>
      </Drawer>
      <StepsSheet
        open={showSteps}
        onOpenChange={setShowSteps}
        steps={steps}
        currentIndex={stepIdx}
        completed={completed}
        doneCount={doneCount}
        remainingMin={remainingMin}
        onSelectStep={(idx) => goToStep(idx)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: INK },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  progressRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    height: 4,
  },
  progressSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
  },
  progressSegOn: { backgroundColor: YELLOW },
  media: {
    marginTop: 14,
    height: 200,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: BORDER,
  },
  mediaImg: { width: '100%', height: '100%' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 16, fontWeight: '800', color: INK },
  stepTitle: { flex: 1, fontSize: 22, fontWeight: '800', color: INK, letterSpacing: -0.4 },
  instr: { marginTop: 12, fontSize: 16, lineHeight: 24, color: MUTED },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  moreText: { fontSize: 14, fontWeight: '700', color: INK },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: INK },
  ingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 8,
    marginRight: 8,
    maxWidth: 160,
    borderWidth: 1,
    borderColor: BORDER,
  },
  ingChipImg: { width: 36, height: 36, borderRadius: 8 },
  ingChipName: { flexShrink: 1, fontSize: 13, fontWeight: '600', color: INK },
  timerCard: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: WHITE,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...cardShadow,
  },
  timerVal: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: INK,
    fontVariant: ['tabular-nums'],
  },
  timerBtn: {
    backgroundColor: YELLOW,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  timerBtnText: { fontSize: 14, fontWeight: '800', color: INK },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: CREAM,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: WHITE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  secondaryText: { fontSize: 13, fontWeight: '700', color: INK },
  primary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: YELLOW,
  },
  primaryText: { fontSize: 15, fontWeight: '800', color: INK },
});

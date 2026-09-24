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
} from 'lucide-react-native';
import { AppImage } from '../../components/ui/app-image';
import {
  BORDER,
  CREAM,
  INK,
  MUTED,
  WHITE,
  YELLOW,
  cardShadow,
} from './tokens';
import type { DishIngredient, DishRecipeStep } from './types';
import {
  formatMmSs,
  ingredientDisplayName,
  normalizeSteps,
  totalStepsDurationMin,
} from './utils';
import { StepsSheet } from './StepsSheet';

type Props = {
  dishName: string;
  image?: ImageSourcePropType;
  ingredients?: DishIngredient[];
  recipeSteps?: DishRecipeStep[];
  onBack: () => void;
  onFinish: () => void;
};

type TimerState = {
  endsAt: number | null;
  remainingSec: number;
  running: boolean;
};

export function CookingPage({
  dishName,
  image,
  ingredients = [],
  recipeSteps = [],
  onBack,
  onFinish,
}: Props) {
  const insets = useSafeAreaInsets();
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
    current?.durationMin != null && current.durationMin > 0
      ? current.durationMin * 60
      : null;

  const getTimer = useCallback(
    (idx: number): TimerState => {
      const t = timers.current[idx];
      if (t) return t;
      const dur = steps[idx]?.durationMin;
      const remaining = dur != null && dur > 0 ? dur * 60 : 0;
      const init: TimerState = { endsAt: null, remainingSec: remaining, running: false };
      timers.current[idx] = init;
      return init;
    },
    [steps],
  );

  const displayRemaining = useCallback(
    (idx: number) => {
      const t = getTimer(idx);
      if (t.running && t.endsAt) {
        return Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
      }
      return t.remainingSec;
    },
    [getTimer],
  );

  // Tick while any timer running
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);

  // Restore on foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setTick((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  void tick; // force re-render

  const toggleTimer = () => {
    if (durationSec == null) return;
    const t = getTimer(stepIdx);
    if (t.running && t.endsAt) {
      const left = Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
      timers.current[stepIdx] = { endsAt: null, remainingSec: left, running: false };
    } else {
      const left = t.remainingSec > 0 ? t.remainingSec : durationSec;
      timers.current[stepIdx] = {
        endsAt: Date.now() + left * 1000,
        remainingSec: left,
        running: true,
      };
    }
    setTick((n) => n + 1);
  };

  const goToStep = (idx: number, skipConfirm = false) => {
    if (idx < 0 || idx >= total) return;
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
      onFinish();
      return;
    }
    setStepIdx(stepIdx + 1);
    setInstrExpanded(false);
  };

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
  const stepMedia = current.imageUrl
    ? { uri: current.imageUrl }
    : image;
  // Design always shows hero media; use step image or dish image
  const showMedia = !!stepMedia;

  const stepIngs = ingredients.slice(0, 3);
  const moreIngs = Math.max(0, ingredients.length - 3);
  const remaining = durationSec != null ? displayRemaining(stepIdx) : null;
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
        <Pressable style={styles.iconBtn} accessibilityLabel="Tuỳ chọn">
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
            <Text style={styles.sectionLabel}>Dùng trong bước này</Text>
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
              {moreIngs > 0 ? (
                <View style={[styles.ingChip, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={styles.ingChipName}>+{moreIngs}</Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        ) : null}

        {durationSec != null && remaining != null ? (
          <View style={styles.timerCard}>
            <Clock3 size={18} color={INK} />
            <Text style={styles.timerVal}>{formatMmSs(remaining)}</Text>
            <Pressable onPress={toggleTimer} style={styles.timerBtn}>
              <Text style={styles.timerBtnText}>{timerRunning ? 'Tạm dừng' : 'Bắt đầu'}</Text>
            </Pressable>
          </View>
        ) : null}
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
        <Pressable onPress={completeStep} style={styles.primary} accessibilityLabel="Hoàn thành bước">
          <Text style={styles.primaryText}>
            {isLast ? 'Hoàn tất món ăn' : 'Hoàn thành bước'}
          </Text>
          {!isLast ? <ChevronRight size={18} color={INK} /> : <Check size={18} color={INK} />}
        </Pressable>
      </View>

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
    minHeight: 40,
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

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CloudOff } from '@/components/icons';
import { Footer, OnboardingHeader, PrimaryButton } from './components';
import { AboutStep, BodyStep, GoalStep, PrefsStep, SummaryStep, WelcomeStep } from './steps';
import { ob } from './theme';
import { QUESTION_STEPS, UI_STEP, type UiStep, useOnboarding } from './useOnboarding';

type Props = { onFinish: () => void };

/** Bước nào backend cho phép skip (onboarding.service STEPS.skippable) */
const SKIPPABLE: Partial<Record<UiStep, true>> = { [UI_STEP.body]: true, [UI_STEP.prefs]: true };

export function OnboardingScreen({ onFinish }: Props) {
  const ctl = useOnboarding(onFinish);
  const [step, setStep] = useState<UiStep>(UI_STEP.welcome);
  /** Khi sửa từ màn tổng kết → lưu xong quay lại tổng kết */
  const [returnToSummary, setReturnToSummary] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const opacity = useSharedValue(1);
  const shift = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateX: shift.value }] }));

  const goTo = useCallback(
    (next: UiStep) => {
      const dir = next > step ? 1 : -1;
      ctl.clearError();
      setStep(next);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      opacity.value = 0;
      shift.value = dir * 28;
      opacity.value = withTiming(1, { duration: 260 });
      shift.value = withTiming(0, { duration: 320, easing: Easing.bezier(0.22, 1, 0.36, 1) });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step],
  );

  // Resume từ bước dang dở (GET /onboarding.currentStep)
  useEffect(() => {
    if (ctl.resumeStep != null && step === UI_STEP.welcome) {
      goTo(ctl.resumeStep);
      ctl.clearResume();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctl.resumeStep]);

  const back = useCallback(() => {
    if (returnToSummary) {
      setReturnToSummary(false);
      goTo(UI_STEP.summary);
      return true;
    }
    if (step > UI_STEP.welcome) {
      goTo((step - 1) as UiStep);
      return true;
    }
    return false;
  }, [goTo, returnToSummary, step]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => sub.remove();
  }, [back]);

  const advance = () => {
    if (returnToSummary) {
      setReturnToSummary(false);
      goTo(UI_STEP.summary);
    } else {
      goTo((step + 1) as UiStep);
    }
  };

  const onPrimary = async () => {
    let ok = true;
    if (step === UI_STEP.about) ok = await ctl.saveAbout();
    else if (step === UI_STEP.body) ok = await ctl.saveBody();
    else if (step === UI_STEP.goal) ok = await ctl.saveGoal();
    else if (step === UI_STEP.prefs) ok = await ctl.savePrefs();
    else if (step === UI_STEP.summary) {
      await ctl.complete();
      return;
    }
    if (ok) advance();
  };

  const onSkip = async () => {
    const ok = step === UI_STEP.body ? await ctl.saveBody(true) : await ctl.savePrefs(true);
    if (ok) advance();
  };

  const onEdit = (target: UiStep) => {
    setReturnToSummary(true);
    goTo(target);
  };

  const catalogBlocked = ctl.catalogState !== 'ready';
  const ctaLabel =
    step === UI_STEP.welcome
      ? 'Bắt đầu'
      : step === UI_STEP.summary
        ? 'Khám phá món đầu tiên'
        : returnToSummary
          ? 'Lưu thay đổi'
          : 'Tiếp tục';
  const ctaDisabled =
    (step === UI_STEP.goal && !ctl.form.primaryGoalId) || (step !== UI_STEP.welcome && catalogBlocked);

  const questionIndex = step >= UI_STEP.about && step <= UI_STEP.prefs ? step : 0;

  return (
    <View style={{ flex: 1, backgroundColor: ob.bg }}>
      {/* Warm glow */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -160,
          right: -120,
          width: 360,
          height: 360,
          borderRadius: 180,
          backgroundColor: 'rgba(255,201,40,0.14)',
        }}
      />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <OnboardingHeader
          current={questionIndex}
          total={QUESTION_STEPS}
          onBack={step > UI_STEP.welcome ? back : undefined}
          onSkip={SKIPPABLE[step] && !returnToSummary ? onSkip : undefined}
        />

        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <Animated.View style={[{ flex: 1 }, anim]}>
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {step !== UI_STEP.welcome && ctl.catalogState === 'error' ? (
                <CatalogError onRetry={ctl.reloadCatalog} />
              ) : (
                <>
                  {step === UI_STEP.welcome && <WelcomeStep />}
                  {step === UI_STEP.about && <AboutStep ctl={ctl} />}
                  {step === UI_STEP.body && <BodyStep ctl={ctl} />}
                  {step === UI_STEP.goal && <GoalStep ctl={ctl} />}
                  {step === UI_STEP.prefs && <PrefsStep ctl={ctl} />}
                  {step === UI_STEP.summary && <SummaryStep ctl={ctl} onEdit={onEdit} />}
                </>
              )}
            </ScrollView>
          </Animated.View>

          <Footer error={ctl.error}>
            <PrimaryButton label={ctaLabel} onPress={onPrimary} loading={ctl.saving} disabled={ctaDisabled} />
            {step === UI_STEP.welcome && ctl.catalogState === 'loading' ? (
              <Animated.View entering={FadeIn} style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 10 }}>
                <ActivityIndicator size="small" color={ob.muted} />
                <Text style={{ fontSize: 12.5, color: ob.muted }}>Đang chuẩn bị…</Text>
              </Animated.View>
            ) : null}
          </Footer>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function CatalogError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 60, gap: 10 }}>
      <CloudOff size={40} color={ob.muted} />
      <Text style={{ fontSize: 17, fontWeight: '700', color: ob.ink }}>Không tải được dữ liệu</Text>
      <Text style={{ fontSize: 14, color: ob.sub, textAlign: 'center' }}>Kiểm tra kết nối mạng rồi thử lại nhé.</Text>
      <Pressable onPress={onRetry} style={{ marginTop: 8, height: 44, paddingHorizontal: 22, borderRadius: 22, backgroundColor: ob.ink, justifyContent: 'center' }}>
        <Text style={{ color: '#FFF', fontWeight: '700' }}>Thử lại</Text>
      </Pressable>
    </View>
  );
}

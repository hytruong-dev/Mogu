import { useEffect, useState } from 'react';
import { AccessibilityInfo, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { HelpCircle, Mic, MicOff, Square, VolumeX } from '@/components/icons';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { INK, MUTED, WHITE, YELLOW, YELLOW_SOFT, cardShadow } from '../tokens';
import type { useCookingVoice } from './useCookingVoice';

type Voice = ReturnType<typeof useCookingVoice>;
type Props = {
  voice: Voice;
  started: boolean;
  onStartCooking: () => void;
  onMute: () => void;
  onInterrupt: () => void;
};
const labels: Record<Voice['state'], string> = {
  idle: 'Nấu cùng NOAN',
  greeting: 'NOAN đang chào bạn',
  waiting: 'Sẵn sàng nghe bạn',
  speaking: 'NOAN đang nói',
  listening: 'Đang nghe…',
  thinking: 'NOAN đang suy nghĩ…',
  paused: 'Micro đang tạm dừng',
  ended: 'Đã kết thúc',
};

const DOT: Record<Voice['state'], string> = {
  idle: '#C9BFAE',
  greeting: '#F5B900',
  waiting: '#2F9E44',
  speaking: '#F5B900',
  listening: '#E5484D',
  thinking: '#7C83D8',
  paused: '#C9BFAE',
  ended: '#C9BFAE',
};

const mascot = require('../../../assets/images/noan/noan-mascot-master-v1.png');

export function VoiceOrb({ voice, started, onStartCooking, onMute, onInterrupt }: Props) {
  const [help, setHelp] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const level = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => sub.remove();
  }, []);
  useEffect(() => {
    level.value = reducedMotion
      ? 0
      : withTiming(Math.min(1, Math.max(0, voice.volume)), { duration: 180 });
  }, [voice.volume, reducedMotion, level]);

  const active = voice.enabled && voice.state !== 'paused' && voice.state !== 'ended';
  useEffect(() => {
    if (active && !reducedMotion) {
      breathe.value = withRepeat(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(breathe);
      breathe.value = withTiming(0, { duration: 200 });
    }
  }, [active, reducedMotion, breathe]);

  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + level.value * 0.25 + breathe.value * 0.08 }],
    opacity: 0.45 + level.value * 0.4 - breathe.value * 0.15,
  }));

  const speaking = voice.state === 'speaking' || voice.state === 'greeting';
  const listening = voice.state === 'listening';
  const busy = voice.state === 'greeting' || voice.state === 'thinking' || voice.state === 'speaking';

  return (
    <Animated.View layout={LinearTransition.duration(220)} style={s.card}>
      <View style={s.head}>
        <View style={s.orb} accessible={false} importantForAccessibility="no-hide-descendants">
          <Animated.View style={[s.ring, ring]} />
          <View style={s.orbInner}>
            <Image source={mascot} style={s.mascot} resizeMode="contain" />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.titleRow}>
            {voice.enabled ? <View style={[s.dot, { backgroundColor: DOT[voice.state] }]} /> : null}
            <Text style={s.title} accessibilityLiveRegion="polite">
              {labels[voice.state]}
            </Text>
          </View>
          <Text style={s.sub}>
            {voice.enabled
              ? 'Micro tắt khi NOAN nói. Chạm Dừng để ngắt.'
              : 'Bật giọng nói để NOAN đọc bước và nghe lệnh của bạn.'}
          </Text>
        </View>
        <Pressable
          onPress={() => setHelp(true)}
          hitSlop={8}
          style={s.helpBtn}
          accessibilityRole="button"
          accessibilityLabel="Mở hướng dẫn lệnh giọng nói"
        >
          <HelpCircle size={20} color={MUTED} />
        </Pressable>
      </View>

      {!voice.enabled ? (
        <Pressable
          onPress={() => void voice.start()}
          style={s.primary}
          className="active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel="Nấu cùng NOAN, bật phiên giọng nói"
        >
          <Mic size={18} color={INK} />
          <Text style={s.primaryText}>Bật giọng NOAN</Text>
        </Pressable>
      ) : (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(150)} style={{ gap: 10 }}>
          {!started && (
            <Pressable
              onPress={onStartCooking}
              disabled={busy}
              style={[s.primary, busy && { opacity: 0.5 }]}
              accessibilityRole="button"
              accessibilityLabel="Bắt đầu nấu"
            >
              <Text style={s.primaryText}>Bắt đầu nấu</Text>
            </Pressable>
          )}

          {voice.transcript || voice.interimTranscript || voice.reply ? (
            <View style={s.chat}>
              {!!voice.transcript && (
                <View style={[s.bubble, s.bubbleMe]}>
                  <Text style={s.bubbleText}>{voice.transcript}</Text>
                </View>
              )}
              {!!voice.interimTranscript && (
                <View style={[s.bubble, s.bubbleMe, { opacity: 0.6 }]}>
                  <Text style={s.bubbleText}>{voice.interimTranscript}…</Text>
                </View>
              )}
              {!!voice.reply && (
                <View style={[s.bubble, s.bubbleNoan]}>
                  <Text style={s.bubbleText} accessibilityLiveRegion="polite">
                    {voice.reply}
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          <View style={s.controls}>
            <Pressable
              onPress={() => {
                onInterrupt();
                if (speaking) voice.stopSpeaking();
                else void voice.toggleMic();
              }}
              style={[s.ctrl, listening && s.ctrlLive]}
              className="active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel={
                speaking ? 'Dừng NOAN đang nói' : listening ? 'Tạm dừng micro' : 'Bật micro để nói'
              }
            >
              {speaking ? (
                <Square size={16} color={INK} fill={INK} />
              ) : listening ? (
                <MicOff size={18} color={WHITE} />
              ) : (
                <Mic size={18} color={INK} />
              )}
              <Text style={[s.ctrlText, listening && { color: WHITE }]}>
                {speaking ? 'Dừng' : listening ? 'Tắt micro' : 'Bật micro'}
              </Text>
            </Pressable>
            <Pressable
              onPress={onMute}
              style={[s.ctrl, s.ctrlGhost]}
              className="active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel="Tắt giọng NOAN"
            >
              <VolumeX size={18} color={MUTED} />
              <Text style={[s.ctrlText, { color: MUTED }]}>Tắt giọng</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {!!voice.error && (
        <Text style={s.error} accessibilityLiveRegion="polite">
          {voice.error}
        </Text>
      )}
      {voice.mode === 'model-required' && voice.enabled && (
        <Pressable onPress={() => void voice.downloadModel()} style={[s.ctrl, s.ctrlWide]}>
          <Text style={s.ctrlText}>Tải mô hình tiếng Việt</Text>
        </Pressable>
      )}
      {voice.mode === 'permission-denied' && voice.enabled && (
        <Pressable onPress={() => void Linking.openSettings()} style={[s.ctrl, s.ctrlWide]}>
          <Text style={s.ctrlText}>Mở cài đặt quyền micro</Text>
        </Pressable>
      )}
      {voice.enabled && voice.mode === 'unavailable' && (
        <Text style={s.note}>
          Bản này chưa hỗ trợ micro. Bạn vẫn nghe NOAN và dùng các nút; cần Development Build để ra lệnh.
        </Text>
      )}

      <Drawer open={help} onOpenChange={setHelp} snapHeight={520}>
        <DrawerHeader>
          <DrawerTitle>Nhờ NOAN giúp nấu</DrawerTitle>
        </DrawerHeader>
        <DrawerContent className="gap-3 px-5 pb-6">
          <Text style={s.helpText}>
            Nói “NOAN” trước lệnh khi micro đang nghe. Khi NOAN hỏi, bạn có thể trả lời ngay.
          </Text>
          <View style={s.cmdWrap}>
            {['Bắt đầu', 'Bước tiếp', 'Quay lại', 'Đọc lại', 'Nguyên liệu', 'Hẹn giờ 5 phút', 'Tạm dừng hẹn giờ', 'Còn bao lâu'].map(
              (c) => (
                <View key={c} style={s.cmd}>
                  <Text style={s.cmdText}>{c}</Text>
                </View>
              ),
            )}
          </View>
          <Text style={s.helpText}>
            Chuyển bước chưa xong cần xác nhận “có” hoặc “không”. Micro không nghe lúc NOAN đang nói.
          </Text>
          <Text style={s.helpText}>
            Mất mạng: lệnh điều khiển và giọng đã lưu vẫn dùng được.
          </Text>
          <Pressable onPress={() => setHelp(false)} style={[s.primary, { marginTop: 6 }]}>
            <Text style={s.primaryText}>Đã hiểu</Text>
          </Pressable>
        </DrawerContent>
      </Drawer>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    marginTop: 14,
    backgroundColor: WHITE,
    borderRadius: 22,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#F3E7C9',
    ...cardShadow,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orb: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFE58A',
  },
  orbInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: YELLOW_SOFT,
    borderWidth: 2,
    borderColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mascot: { width: 46, height: 46 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 16, fontWeight: '800', color: INK },
  sub: { fontSize: 13, lineHeight: 18, color: MUTED, marginTop: 3 },
  helpBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  primary: {
    minHeight: 50,
    borderRadius: 999,
    backgroundColor: YELLOW,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { fontSize: 15, fontWeight: '800', color: INK },
  chat: { gap: 6 },
  bubble: { maxWidth: '88%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: '#F3EFE6', borderBottomRightRadius: 4 },
  bubbleNoan: { alignSelf: 'flex-start', backgroundColor: YELLOW_SOFT, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20, color: INK },
  controls: { flexDirection: 'row', gap: 10 },
  ctrl: {
    flex: 1,
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: '#FFF2B8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ctrlLive: { backgroundColor: '#E5484D' },
  ctrlGhost: { backgroundColor: '#F6F2EA' },
  ctrlWide: { flex: 0, alignSelf: 'stretch' },
  ctrlText: { fontSize: 14, fontWeight: '700', color: INK },
  error: { fontSize: 13, color: '#C0392B' },
  note: { fontSize: 13, color: MUTED, lineHeight: 18 },
  helpText: { fontSize: 14, lineHeight: 21, color: INK },
  cmdWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cmd: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#FFF2B8' },
  cmdText: { fontSize: 13, fontWeight: '700', color: INK },
});

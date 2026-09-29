import { useEffect, useState } from 'react';
import { AccessibilityInfo, Image, Linking, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
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
  thinking: 'NOAN đang suy nghĩ',
  paused: 'Micro đang tạm dừng',
  ended: 'Đã kết thúc',
};

export function VoiceOrb({ voice, started, onStartCooking, onMute, onInterrupt }: Props) {
  const [help, setHelp] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const level = useSharedValue(0);
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
  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + level.value * 0.22 }],
    opacity: 0.35 + level.value * 0.4,
  }));
  const speaking = voice.state === 'speaking' || voice.state === 'greeting';
  return (
    <Card className="mt-4 gap-3 rounded-3xl border-border bg-card p-4 shadow-none">
      <View className="flex-row items-center gap-3">
        <View style={s.orb} accessible={false} importantForAccessibility="no-hide-descendants">
          <Animated.View style={[s.ring, ring]} />
          <Image
            source={require('../../../assets/images/noan/noan-mascot-master-v1.png')}
            style={s.mascot}
            resizeMode="contain"
          />
        </View>
        <View className="flex-1">
          <Text className="font-bold text-foreground" accessibilityLiveRegion="polite">
            {labels[voice.state]}
          </Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            {voice.enabled
              ? 'Micro tắt khi NOAN nói. Chạm Dừng để ngắt.'
              : 'Chỉ bật giọng nói khi bạn chọn. Các nút nấu luôn dùng được.'}
          </Text>
        </View>
      </View>
      {!voice.enabled ? (
        <Button
          onPress={() => void voice.start()}
          className="min-h-12 rounded-2xl active:opacity-80"
          accessibilityLabel="Nấu cùng NOAN, bật phiên giọng nói"
        >
          <Text>Nấu cùng NOAN</Text>
        </Button>
      ) : (
        <>
          {!started && (
            <Button
              onPress={onStartCooking}
              disabled={
                voice.state === 'greeting' ||
                voice.state === 'thinking' ||
                voice.state === 'speaking'
              }
              className="min-h-12 rounded-2xl active:opacity-80"
            >
              <Text>Bắt đầu nấu</Text>
            </Button>
          )}
          {!!voice.transcript && (
            <Text className="text-sm font-semibold text-foreground">Bạn: {voice.transcript}</Text>
          )}
          {!!voice.interimTranscript && (
            <Text className="text-sm text-muted-foreground">
              Đang nghe: {voice.interimTranscript}
            </Text>
          )}
          {!!voice.reply && (
            <Text className="text-sm text-foreground" accessibilityLiveRegion="polite">
              NOAN: {voice.reply}
            </Text>
          )}
          <View className="flex-row flex-wrap gap-2">
            <Button
              variant="secondary"
              onPress={() => {
                onInterrupt();
                if (speaking) voice.stopSpeaking();
                else void voice.toggleMic();
              }}
              className="min-h-12 rounded-2xl active:opacity-80"
              accessibilityLabel={
                speaking
                  ? 'Dừng NOAN đang nói'
                  : voice.state === 'listening'
                    ? 'Tạm dừng micro'
                    : 'Bật micro để nói'
              }
            >
              <Text>
                {speaking ? 'Dừng' : voice.state === 'listening' ? 'Tắt micro' : 'Bật micro'}
              </Text>
            </Button>
            <Button
              variant="ghost"
              onPress={onMute}
              className="min-h-12 rounded-2xl active:opacity-80"
            >
              <Text>Tắt giọng NOAN</Text>
            </Button>
          </View>
        </>
      )}
      {!!voice.error && (
        <Text className="text-sm text-destructive" accessibilityLiveRegion="polite">
          {voice.error}
        </Text>
      )}
      {voice.mode === 'model-required' && voice.enabled && (
        <Button
          variant="secondary"
          onPress={() => void voice.downloadModel()}
          className="min-h-12 active:opacity-80"
        >
          <Text>Tải mô hình tiếng Việt</Text>
        </Button>
      )}
      {voice.mode === 'permission-denied' && voice.enabled && (
        <Button
          variant="secondary"
          onPress={() => void Linking.openSettings()}
          className="min-h-12 active:opacity-80"
        >
          <Text>Mở cài đặt quyền micro</Text>
        </Button>
      )}
      {voice.enabled && voice.mode === 'unavailable' && (
        <Text className="text-sm text-muted-foreground">
          Bản này chưa hỗ trợ micro. Bạn vẫn nghe NOAN và dùng các nút; cần Development Build để ra
          lệnh.
        </Text>
      )}
      <Button
        variant="ghost"
        onPress={() => setHelp(true)}
        className="min-h-12 self-start active:opacity-80"
        accessibilityLabel="Mở hướng dẫn lệnh giọng nói"
      >
        <Text>Nhắc lệnh</Text>
      </Button>
      <Drawer open={help} onOpenChange={setHelp}>
        <DrawerHeader>
          <DrawerTitle>Nhờ NOAN giúp nấu</DrawerTitle>
        </DrawerHeader>
        <DrawerContent className="gap-3 px-5 pb-6">
          <Text>
            Nói “NOAN” trước lệnh khi micro đang nghe. Khi NOAN hỏi, bạn có thể trả lời ngay.
          </Text>
          <Text>Bắt đầu · Bước tiếp · Quay lại · Đọc lại · Nguyên liệu</Text>
          <Text>Hẹn giờ 5 phút · Bắt đầu hẹn giờ · Tạm dừng hẹn giờ · Còn bao lâu</Text>
          <Text>
            Chuyển bước chưa xong cần xác nhận “có” hoặc “không”. Chạm Dừng khi NOAN đang nói —
            micro không nghe lúc phát giọng.
          </Text>
          <Text>
            Mất mạng: lệnh điều khiển và giọng đã lưu vẫn dùng được. Khi cần, NOAN dùng giọng tiếng
            Việt trên thiết bị nếu đã cài và thông báo rõ cho bạn.
          </Text>
          <Button onPress={() => setHelp(false)} className="min-h-12 active:opacity-80">
            <Text>Đã hiểu</Text>
          </Button>
        </DrawerContent>
      </Drawer>
    </Card>
  );
}
const s = StyleSheet.create({
  orb: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#D7A900',
    backgroundColor: '#FFF1B8',
  },
  mascot: { width: 60, height: 60 },
});

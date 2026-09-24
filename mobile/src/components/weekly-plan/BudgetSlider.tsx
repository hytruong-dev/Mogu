/**
 * BudgetSlider — Thanh trượt ngân sách theo mockup mogu-week-plan-config-v2
 * −/+ + kéo thanh; nhãn 0đ … max; nhập từ bàn phím trực tiếp
 */
import React, { useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Minus, Plus } from 'lucide-react-native';

type Props = {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
  /** Phụ đề dưới thanh, ví dụ "Khoảng 14.000đ / bữa" */
  helperText?: string;
  disabled?: boolean;
};

export function BudgetSlider({
  value,
  min = 0,
  max = 1000000,
  step = 50000,
  onChange,
  helperText,
  disabled = false,
}: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [editingText, setEditingText] = useState<string | null>(null);

  const timerRef = useRef<{ timeout?: ReturnType<typeof setTimeout>; interval?: ReturnType<typeof setInterval> }>({});
  const valueRef = useRef(value);
  valueRef.current = value;

  const clamp = (val: number) => Math.min(max, Math.max(min, val));
  const formatVi = (n: number) => n.toLocaleString('vi-VN');

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Ignored
    }
  };

  const applyStep = (delta: number) => {
    triggerHaptic();
    const next = clamp(valueRef.current + delta);
    onChange(next);
  };

  const stopRepeat = () => {
    if (timerRef.current.timeout) clearTimeout(timerRef.current.timeout);
    if (timerRef.current.interval) clearInterval(timerRef.current.interval);
    timerRef.current = {};
  };

  const handlePressIn = (delta: number) => {
    stopRepeat();
    timerRef.current.timeout = setTimeout(() => {
      timerRef.current.interval = setInterval(() => {
        applyStep(delta);
      }, 100);
    }, 350);
  };

  const handlePress = (delta: number) => {
    applyStep(delta);
  };

  const ratio = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0;

  const startXRef = useRef(0);

  const handlePanTouchRatio = (x: number) => {
    if (trackWidth <= 0) return;
    const newRatio = Math.max(0, Math.min(1, x / trackWidth));
    const raw = min + newRatio * (max - min);
    const stepped = Math.round(raw / step) * step;
    onChange(clamp(stepped));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        startXRef.current = x;
        triggerHaptic();
        handlePanTouchRatio(x);
      },
      onPanResponderMove: (_evt, gestureState) => {
        const x = startXRef.current + gestureState.dx;
        handlePanTouchRatio(x);
      },
    }),
  ).current;

  const displayValue = editingText !== null ? editingText : formatVi(value);

  const handleTextChange = (t: string) => {
    const digits = t.replace(/\D/g, '');
    setEditingText(digits);
    const num = parseInt(digits, 10);
    if (Number.isFinite(num)) {
      onChange(clamp(num));
    }
  };

  const handleBlur = () => {
    if (editingText !== null) {
      const num = parseInt(editingText, 10);
      if (!Number.isFinite(num) || num < min) {
        onChange(min);
      } else if (num > max) {
        onChange(max);
      }
      setEditingText(null);
    }
  };

  return (
    <View style={s.container}>
      {/* −   value   + */}
      <View style={s.stepperRow}>
        <Pressable
          onPress={() => !disabled && handlePress(-step)}
          onPressIn={() => !disabled && handlePressIn(-step)}
          onPressOut={stopRepeat}
          style={({ pressed }) => [
            s.circleBtn,
            pressed && s.circleBtnPressed,
            (disabled || value <= min) && s.circleBtnDisabled,
          ]}
          disabled={disabled || value <= min}
          hitSlop={8}
        >
          <Minus size={20} color={disabled || value <= min ? '#C8C3B8' : '#111'} strokeWidth={2.5} />
        </Pressable>

        <View style={s.inputContainer}>
          <TextInput
            style={s.valueInput}
            value={displayValue}
            onChangeText={handleTextChange}
            onBlur={handleBlur}
            keyboardType="number-pad"
            editable={!disabled}
            selectTextOnFocus
          />
          <Text style={s.currencyUnit}>đ</Text>
        </View>

        <Pressable
          onPress={() => !disabled && handlePress(step)}
          onPressIn={() => !disabled && handlePressIn(step)}
          onPressOut={stopRepeat}
          style={({ pressed }) => [
            s.circleBtn,
            pressed && s.circleBtnPressed,
            (disabled || value >= max) && s.circleBtnDisabled,
          ]}
          disabled={disabled || value >= max}
          hitSlop={8}
        >
          <Plus size={20} color={disabled || value >= max ? '#C8C3B8' : '#111'} strokeWidth={2.5} />
        </Pressable>
      </View>

      {/* Track */}
      <View
        style={s.trackWrap}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        <View style={s.bgTrack} pointerEvents="none" />
        <View style={[s.activeTrack, { width: `${ratio * 100}%` }]} pointerEvents="none" />
        <View
          pointerEvents="none"
          style={[
            s.thumb,
            {
              left: Math.max(
                0,
                Math.min(Math.max(trackWidth - 20, 0), ratio * trackWidth - 10),
              ),
            },
          ]}
        />
      </View>

      {/* Range labels */}
      <View style={s.rangeRow}>
        <Text style={s.rangeLabel}>{formatVi(min)} đ</Text>
        <Text style={s.rangeLabel}>{formatVi(max)} đ</Text>
      </View>

      {!!helperText && <Text style={s.helper}>{helperText}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    gap: 10,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E5E0D6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtnPressed: {
    backgroundColor: '#F5F2EB',
  },
  circleBtnDisabled: {
    borderColor: '#EEEAE3',
    backgroundColor: '#FAF8F5',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  valueInput: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -0.4,
    padding: 0,
    margin: 0,
    textAlign: 'center',
  },
  currencyUnit: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    marginLeft: 4,
  },
  trackWrap: {
    height: 40,
    justifyContent: 'center',
    position: 'relative',
    marginTop: 2,
  },
  bgTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EDE9E0',
    width: '100%',
  },
  activeTrack: {
    position: 'absolute',
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFC20E',
    left: 0,
  },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#FFC20E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -2,
  },
  rangeLabel: {
    fontSize: 12,
    color: '#9A958C',
    fontWeight: '500',
  },
  helper: {
    textAlign: 'center',
    fontSize: 13,
    color: '#8A8580',
    marginTop: 2,
  },
});

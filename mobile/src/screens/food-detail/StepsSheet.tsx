import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '../../components/ui/drawer';
import {
  BORDER,
  GREEN_OK,
  INK,
  MUTED,
  TERTIARY,
  WHITE,
  YELLOW,
  YELLOW_SOFT,
} from './tokens';

type StepItem = {
  stepOrder: number;
  title: string;
  durationMin: number | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  steps: StepItem[];
  currentIndex: number;
  completed: Set<number>;
  doneCount: number;
  remainingMin: number | null;
  onSelectStep: (index: number) => void;
};

export function StepsSheet({
  open,
  onOpenChange,
  steps,
  currentIndex,
  completed,
  doneCount,
  remainingMin,
  onSelectStep,
}: Props) {
  const summary =
    remainingMin != null
      ? `${doneCount}/${steps.length} hoàn thành • ${remainingMin} phút còn lại`
      : `${doneCount}/${steps.length} hoàn thành`;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} snapHeight={560}>
      <DrawerHeader className="px-5 pt-2 pb-1">
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <DrawerTitle className="text-[18px] font-bold text-[#161616]">Các bước</DrawerTitle>
            <Text style={styles.sub}>{summary}</Text>
          </View>
          <Pressable
            onPress={() => onOpenChange(false)}
            style={styles.close}
            accessibilityLabel="Đóng"
          >
            <X size={18} color={MUTED} />
          </Pressable>
        </View>
      </DrawerHeader>
      <DrawerContent className="px-0 pb-4">
        <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {steps.map((st, idx) => {
            const done = completed.has(idx);
            const current = idx === currentIndex;
            return (
              <Pressable
                key={`ss-${st.stepOrder}`}
                onPress={() => onSelectStep(idx)}
                style={[styles.row, current && styles.rowCurrent]}
                accessibilityLabel={
                  current ? `Bước hiện tại: ${st.title}` : st.title
                }
              >
                <View
                  style={[
                    styles.dot,
                    done && styles.dotDone,
                    current && styles.dotCurrent,
                  ]}
                >
                  {done ? (
                    <Check size={14} color={WHITE} strokeWidth={3} />
                  ) : (
                    <Text
                      style={[
                        styles.dotText,
                        current && styles.dotTextCurrent,
                        !current && !done && styles.dotTextUpcoming,
                      ]}
                    >
                      {st.stepOrder}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, done && styles.titleDone]} numberOfLines={2}>
                    {st.title}
                  </Text>
                  {st.durationMin != null ? (
                    <Text style={[styles.dur, current && styles.durCurrent]}>
                      {st.durationMin} phút
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={() => {
              onOpenChange(false);
            }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>Tiếp tục bước {currentIndex + 1}</Text>
          </Pressable>
        </View>
      </DrawerContent>
    </Drawer>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'flex-start' },
  sub: { fontSize: 13, color: MUTED, marginTop: 4 },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F0EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 4,
  },
  rowCurrent: { backgroundColor: YELLOW_SOFT },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: GREEN_OK, borderColor: GREEN_OK },
  dotCurrent: { backgroundColor: YELLOW, borderColor: YELLOW },
  dotText: { fontSize: 13, fontWeight: '700', color: INK },
  dotTextCurrent: { color: INK },
  dotTextUpcoming: { color: TERTIARY },
  title: { fontSize: 15, fontWeight: '700', color: INK },
  titleDone: { color: MUTED },
  dur: { fontSize: 13, color: MUTED, marginTop: 2 },
  durCurrent: { color: '#C97A00', fontWeight: '600' },
  footer: { paddingHorizontal: 16, paddingTop: 8 },
  cta: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 15, fontWeight: '800', color: INK },
});

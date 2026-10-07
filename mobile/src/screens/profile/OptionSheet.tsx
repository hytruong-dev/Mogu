import { Modal, StyleSheet, Text, View } from 'react-native';
import { StyledPressable as Pressable } from '../../components/ui/styled-pressable';
import { Check } from '@/components/icons';
import { P } from './ProfileUI';

export type SheetOption<T extends string> = { value: T; label: string; sub?: string };

/** Minimal bottom sheet used for single-choice settings (theme, language...). */
export function OptionSheet<T extends string>({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: Array<SheetOption<T>>;
  value: T | null | undefined;
  onSelect: (v: T) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={st.backdrop} onPress={onClose}>
        <Pressable style={st.sheet} onPress={() => undefined}>
          <View style={st.handle} />
          <Text style={st.title}>{title}</Text>
          {options.map((o) => {
            const active = o.value === value;
            return (
              <Pressable
                key={o.value}
                onPress={() => onSelect(o.value)}
                style={({ pressed }) => [st.row, active && st.rowActive, pressed && { opacity: 0.8 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[st.label, active && { color: P.accentDeep }]}>{o.label}</Text>
                  {o.sub ? <Text style={st.sub}>{o.sub}</Text> : null}
                </View>
                {active ? <Check size={18} color={P.accentDeep} strokeWidth={3} /> : null}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30,20,10,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFDF7',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 30,
    gap: 8,
  },
  handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#E5D9BE', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '800', color: P.ink, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#FBF6EC',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  rowActive: { backgroundColor: '#FFF8E1', borderColor: P.accent },
  label: { fontSize: 15.5, fontWeight: '700', color: P.ink },
  sub: { fontSize: 12.5, color: P.muted, marginTop: 2 },
});

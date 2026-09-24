import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Info, X } from 'lucide-react-native';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
} from '../../components/ui/drawer';
import {
  BORDER,
  INK,
  KCAL_ACCENT,
  MUTED,
  YELLOW,
  YELLOW_SOFT,
} from './tokens';
import type { DishNutrition } from './types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nutrition?: DishNutrition | null;
  servings: number;
};

export function NutritionSheet({ open, onOpenChange, nutrition, servings }: Props) {
  const kcal = nutrition?.calories != null ? Math.round(Number(nutrition.calories)) : null;
  const macros = [
    { key: 'p', label: 'Protein', value: nutrition?.proteinG, color: '#E85D4C' },
    { key: 'c', label: 'Tinh bột', value: nutrition?.carbsG, color: '#3CB371' },
    { key: 'f', label: 'Chất béo', value: nutrition?.fatG, color: '#E8A317' },
    { key: 'fi', label: 'Chất xơ', value: nutrition?.fiberG, color: '#2E7D32' },
  ].filter((m) => m.value != null);

  const details = [
    { label: 'Đường', value: nutrition?.sugarG, unit: 'g' },
    { label: 'Natri', value: nutrition?.sodiumMg, unit: 'mg' },
    { label: 'Cholesterol', value: nutrition?.cholesterolMg, unit: 'mg' },
    { label: 'Chất béo bão hòa', value: nutrition?.saturatedFatG, unit: 'g' },
  ].filter((d) => d.value != null);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} snapHeight={580}>
      <DrawerHeader className="px-5 pt-1 pb-1">
        <View style={styles.headRow}>
          <View style={{ width: 36 }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.title}>Dinh dưỡng tham khảo</Text>
            <Text style={styles.sub}>1 khẩu phần • {servings} người</Text>
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
      <DrawerContent className="px-5 pb-6">
        {kcal != null ? (
          <View style={styles.kcalCard}>
            <Text style={styles.kcalLine}>
              <Text style={styles.kcalNum}>{kcal}</Text>
              <Text style={styles.kcalUnitInline}> kcal</Text>
            </Text>
            <Text style={styles.kcalCaption}>mỗi khẩu phần</Text>
          </View>
        ) : (
          <Text style={styles.empty}>Chưa có dữ liệu năng lượng.</Text>
        )}

        {macros.length > 0 ? (
          <View style={styles.macroRow}>
            {macros.map((m, i) => (
              <View key={m.key} style={styles.macroItem}>
                {i > 0 ? <View style={styles.macroDiv} /> : null}
                <View style={styles.macroInner}>
                  <Text style={[styles.macroVal, { color: m.color }]}>
                    {Math.round(Number(m.value))}g
                  </Text>
                  <Text style={styles.macroLabel}>{m.label}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {details.length > 0 ? (
          <View style={{ marginTop: 18 }}>
            <Text style={styles.detailTitle}>Chi tiết</Text>
            {details.map((d) => (
              <View key={d.label} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{d.label}</Text>
                <Text style={styles.detailVal}>
                  {Math.round(Number(d.value))}
                  {d.unit}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.disclaimer}>
          <Info size={14} color={MUTED} />
          <Text style={styles.disclaimerText}>
            Giá trị ước tính, có thể thay đổi theo nguyên liệu và khẩu phần.
          </Text>
        </View>

        <Pressable
          onPress={() => onOpenChange(false)}
          style={styles.cta}
          accessibilityLabel="Đã hiểu"
        >
          <Text style={styles.ctaText}>Đã hiểu</Text>
        </Pressable>
      </DrawerContent>
    </Drawer>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontSize: 18, fontWeight: '800', color: INK, textAlign: 'center' },
  sub: { fontSize: 13, color: MUTED, marginTop: 4, textAlign: 'center' },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F0EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kcalCard: {
    backgroundColor: YELLOW_SOFT,
    borderRadius: 18,
    paddingVertical: 22,
    alignItems: 'center',
    marginTop: 8,
  },
  kcalLine: { textAlign: 'center' },
  kcalNum: { fontSize: 36, fontWeight: '800', color: KCAL_ACCENT },
  kcalUnitInline: { fontSize: 28, fontWeight: '800', color: INK },
  kcalCaption: { fontSize: 13, color: MUTED, marginTop: 4 },
  empty: { fontSize: 14, color: MUTED, marginTop: 8 },
  macroRow: {
    flexDirection: 'row',
    marginTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    paddingVertical: 14,
  },
  macroItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  macroDiv: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: BORDER,
  },
  macroInner: { flex: 1, alignItems: 'center' },
  macroVal: { fontSize: 16, fontWeight: '800' },
  macroLabel: { fontSize: 11, color: MUTED, marginTop: 4, textAlign: 'center' },
  detailTitle: { fontSize: 15, fontWeight: '700', color: INK, marginBottom: 6 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  detailLabel: { fontSize: 14, color: MUTED },
  detailVal: { fontSize: 14, fontWeight: '700', color: INK },
  disclaimer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginTop: 16,
  },
  disclaimerText: { flex: 1, fontSize: 12, lineHeight: 18, color: MUTED },
  cta: {
    marginTop: 18,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 16, fontWeight: '800', color: INK },
});

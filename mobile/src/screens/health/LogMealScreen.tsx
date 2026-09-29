import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, Search, X } from '@/components/icons';
import { dishesApi } from '../../services/api/dishes';
import { healthApi } from '../../services/api/health';
import { getDeviceTimeZone } from '../../lib/dates';
import { resolveDishImageUrl } from '../explore/utils';
import {
  HC,
  HCard,
  MEAL_SLOTS,
  PrimaryButton,
  SLOT_LABEL,
  SLOT_SHORT,
  SubHeader,
  Thumb,
  fmtNum,
  s,
  type MealSlot,
} from './HealthUI';

type DishOption = { id: string; name: string; kcal: number | null; imageUrl: string | null };

type Props = {
  date: Date;
  initialSlot?: MealSlot;
  onClose: () => void;
  onSaved: () => void;
};

function readKcal(d: any): number | null {
  const raw = d?.calories ?? d?.nutritionProfiles?.[0]?.calories ?? d?.nutrition?.calories ?? null;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function LogMealScreen({ date, initialSlot = 'LUNCH', onClose, onSaved }: Props) {
  const [slot, setSlot] = useState<MealSlot>(initialSlot);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DishOption[]>([]);
  const [selected, setSelected] = useState<DishOption | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    setSearchError(null);
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const id = ++seq.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res: any = await dishesApi.search({ q, limit: 20 });
        if (id !== seq.current) return;
        const rows: any[] = Array.isArray(res?.data) ? res.data : Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        setResults(
          rows.map((d) => ({
            id: String(d.id),
            name: String(d.name ?? d.title ?? 'Món ăn'),
            kcal: readKcal(d),
            imageUrl: resolveDishImageUrl(d),
          })),
        );
      } catch (e: any) {
        if (id !== seq.current) return;
        setResults([]);
        setSearchError(e?.message ?? 'Không tìm được món. Thử lại nhé.');
      } finally {
        if (id === seq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const dirty = !!selected || query.trim().length > 0;

  const requestClose = () => {
    if (!dirty || saving) {
      if (!saving) onClose();
      return;
    }
    Alert.alert('Rời khỏi form?', 'Món bạn đã chọn sẽ không được lưu.', [
      { text: 'Ở lại', style: 'cancel' },
      { text: 'Rời đi', style: 'destructive', onPress: onClose },
    ]);
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    try {
      const occurred = new Date(date);
      occurred.setHours(12, 0, 0, 0);
      await healthApi.createMealLog({
        mealSlot: slot,
        timezone: getDeviceTimeZone(),
        occurredAt: occurred.toISOString(),
        items: [{ referenceType: 'DISH', referenceId: selected.id, quantity: 1, unitCode: 'SERVING' }],
      });
      onSaved();
    } catch (e: any) {
      setSaveError(e?.message || 'Không lưu được bữa ăn. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingHorizontal: 20 }}>
          <SubHeader title="Ghi bữa ăn" onBack={requestClose} />
        </View>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[s.datePill, { justifyContent: 'center', gap: 8 }]}>
            <CalendarDays size={18} color={HC.ink} />
            <Text style={s.dateText}>
              {date.getDate()} tháng {date.getMonth() + 1}, {date.getFullYear()}
            </Text>
          </View>

          <Text style={{ fontSize: 16, fontWeight: '800', color: HC.ink, marginTop: 20, marginBottom: 10 }}>Chọn bữa ăn</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {MEAL_SLOTS.map((m) => {
              const active = m === slot;
              return (
                <Pressable
                  key={m}
                  onPress={() => setSlot(m)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={{
                    flex: 1,
                    height: 46,
                    borderRadius: 23,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active ? HC.yellow : HC.chip,
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: active ? '800' : '600', color: active ? HC.ink : HC.sub }}>
                    {SLOT_SHORT[m]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={{ fontSize: 16, fontWeight: '800', color: HC.ink, marginTop: 20, marginBottom: 10 }}>Tìm món ăn</Text>
          <View
            style={{
              height: 50,
              borderRadius: 25,
              borderWidth: 1,
              borderColor: HC.line,
              backgroundColor: HC.card,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 14,
              gap: 10,
            }}
          >
            <Search size={20} color={HC.ink} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Nhập tên món, ví dụ: Cơm tấm"
              placeholderTextColor={HC.muted}
              returnKeyType="search"
              style={{ flex: 1, fontSize: 15, color: HC.ink, paddingVertical: 0 }}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Xoá tìm kiếm">
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#DDD4C6', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={13} color="#FFF" strokeWidth={3} />
                </View>
              </Pressable>
            ) : null}
          </View>

          <View style={{ gap: 10, marginTop: 12 }}>
            {searching ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 }}>
                <ActivityIndicator size="small" color={HC.yellowDeep} />
                <Text style={{ color: HC.sub, fontSize: 14 }}>Đang tìm món…</Text>
              </View>
            ) : searchError ? (
              <Text style={{ color: '#C0392B', fontSize: 14, paddingVertical: 6 }}>{searchError}</Text>
            ) : query.trim().length >= 2 && results.length === 0 ? (
              <Text style={{ color: HC.sub, fontSize: 14, paddingVertical: 6 }}>
                Không tìm thấy món “{query.trim()}”. Thử tên khác nhé.
              </Text>
            ) : null}

            {!searching &&
              results.map((r) => {
                const active = selected?.id === r.id;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => setSelected(r)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${r.name}, ${r.kcal != null ? `${r.kcal} kcal` : 'chưa có kcal'}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      padding: 10,
                      borderRadius: 18,
                      backgroundColor: active ? '#FFFBEA' : HC.card,
                      borderWidth: active ? 1.5 : 1,
                      borderColor: active ? HC.yellow : HC.line,
                    }}
                  >
                    <Thumb uri={r.imageUrl} width={80} height={62} radius={12} />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: '700', color: HC.ink }}>
                        {r.name}
                      </Text>
                      <Text style={{ fontSize: 13, color: HC.sub, marginTop: 3 }}>
                        {r.kcal != null ? `${fmtNum(r.kcal)} kcal` : 'Chưa có kcal'}
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: active ? HC.yellow : '#D9CFC1',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {active ? <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: HC.yellow }} /> : null}
                    </View>
                  </Pressable>
                );
              })}
          </View>

          {selected ? (
            <HCard style={{ marginTop: 18 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: HC.ink, marginBottom: 10 }}>Món đã chọn</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Thumb uri={selected.imageUrl} width={72} height={60} radius={12} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: '700', color: HC.ink }}>
                    {selected.name}
                  </Text>
                  <Text style={{ fontSize: 13, color: HC.sub, marginTop: 3 }}>
                    1 khẩu phần · {SLOT_LABEL[slot]}
                  </Text>
                </View>
              </View>
            </HCard>
          ) : null}

          {saveError ? (
            <Text style={{ color: '#C0392B', fontSize: 14, marginTop: 12 }}>{saveError}</Text>
          ) : null}
        </ScrollView>

        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}>
          <PrimaryButton
            label={saving ? 'Đang lưu…' : 'Lưu bữa ăn'}
            onPress={save}
            disabled={!selected}
            loading={saving}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

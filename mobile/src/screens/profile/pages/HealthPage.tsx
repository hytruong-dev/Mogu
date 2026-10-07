import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { profileApi, profileVersionOf, withVersionRetry, type ActivityLevel } from '../../../services/api/profile';
import { useHealthProfile, useMeProfile } from '../../../hooks/useMeProfile';
import { recordHealthMeasurementStore } from '../../../services/app-store';
import {
  P,
  PageScaffold,
  PButton,
  PCard,
  PChip,
  PInput,
  SectionTitle,
  StatTile,
  InfoBanner,
  InlineNotice,
} from '../ProfileUI';
import { LoadBlock, errMsg } from '../shared';

// ─── Health ──────────────────────────────────────────────────────────────────

const ACTIVITY_OPTIONS: Array<{ value: ActivityLevel; label: string }> = [
  { value: 'SEDENTARY', label: 'Ít vận động' },
  { value: 'LIGHT', label: 'Nhẹ' },
  { value: 'MODERATE', label: 'Vừa phải' },
  { value: 'ACTIVE', label: 'Năng động' },
  { value: 'VERY_ACTIVE', label: 'Rất năng động' },
];

function activityLabel(code?: string | null) {
  const c = (code ?? '').toUpperCase();
  return ACTIVITY_OPTIONS.find((o) => o.value === c)?.label ?? '—';
}

const toNum = (s: string) => {
  const n = Number(s.trim().replace(',', '.'));
  return s.trim() && Number.isFinite(n) ? n : null;
};

export function HealthPage({ onEditProfile }: { onEditProfile?: () => void }) {
  const { health: data, isLoading, error: queryError, refetch, setHealth } = useHealthProfile();
  const { fetchVersion } = useMeProfile();
  const [saving, setSaving] = useState(false);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [targetW, setTargetW] = useState('');
  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [needDob, setNeedDob] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!data || hydrated) return;
    setHeight(data.latestMeasurements?.height?.value != null ? String(data.latestMeasurements.height.value) : '');
    setWeight(data.latestMeasurements?.weight?.value != null ? String(data.latestMeasurements.weight.value) : '');
    setTargetW(data.targetWeight?.value != null ? String(data.targetWeight.value) : '');
    const a = (data.activityLevel ?? '').toString().toUpperCase();
    setActivity(ACTIVITY_OPTIONS.some((o) => o.value === a) ? (a as ActivityLevel) : null);
    setHydrated(true);
  }, [data, hydrated]);

  const loading = isLoading && !data;
  const loadError = queryError && !data ? errMsg(queryError, 'Không tải được thông tin sức khỏe.') : null;

  const save = async () => {
    setSaving(true);
    setMsg(null);
    setError(null);
    setNeedDob(false);
    try {
      const h = toNum(height);
      const w = toNum(weight);
      const tw = toNum(targetW);
      if (h != null && (h < 50 || h > 250)) throw new Error('Chiều cao cần nằm trong khoảng 50–250 cm.');
      if (w != null && (w < 20 || w > 350)) throw new Error('Cân nặng cần nằm trong khoảng 20–350 kg.');
      if (tw != null && (tw < 20 || tw > 350)) throw new Error('Cân nặng mục tiêu cần nằm trong khoảng 20–350 kg.');
      const res = await withVersionRetry(fetchVersion, (v) =>
        profileApi.updateHealth(
          {
            ...(h != null ? { heightCm: h } : {}),
            ...(w != null ? { weightKg: w } : {}),
            ...(tw != null ? { targetWeightKg: tw } : {}),
            ...(activity ? { activityLevel: activity } : {}),
          },
          v,
        ),
      );
      if (res.healthProfile) setHealth(res.healthProfile);
      recordHealthMeasurementStore();
      if (res.targetStatus === 'INSUFFICIENT_INPUT' || res.missingInputs?.includes('dateOfBirth')) {
        setNeedDob(true);
        setMsg('Đã lưu. Hãy bổ sung ngày sinh để NOAN tính mục tiêu mỗi ngày.');
      } else {
        setMsg('Đã cập nhật thông tin sức khỏe.');
      }
    } catch (e) {
      setError(errMsg(e, 'Không cập nhật được.'));
    } finally {
      setSaving(false);
    }
  };

  // Live BMI preview from the inputs; falls back to server value.
  const hNum = Number(height.replace(',', '.'));
  const wNum = Number(weight.replace(',', '.'));
  const liveBmi = hNum > 0 && wNum > 0 ? wNum / Math.pow(hNum / 100, 2) : null;
  const serverBmi = data?.bmi?.status === 'AVAILABLE' && data?.bmi?.value != null ? Number(data.bmi.value) : null;
  const bmiNum = liveBmi ?? serverBmi;
  const bmi = bmiNum != null ? bmiNum.toFixed(1).replace('.', ',') : '—';
  const bmiInfo = bmiCategory(bmiNum);
  const targetWeight = data?.targetWeight?.value != null ? String(data.targetWeight.value) : '—';
  const targets = data?.dailyTargets;

  return (
    <PageScaffold
      footer={
        <PButton
          text={saving ? 'Đang cập nhật…' : 'Cập nhật thông tin'}
          onPress={save}
          disabled={saving}
          loading={saving}
        />
      }
    >
      <LoadBlock loading={loading} error={loadError} onRetry={() => void refetch()} skeleton="form">
        <InfoBanner
          emoji="🔒"
          title="Dữ liệu được bảo mật"
          body="Chỉ số giúp NOAN gợi ý món phù hợp hơn. NOAN không chia sẻ thông tin này với ai."
        />

        <SectionTitle title="Chỉ số cơ thể" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <PCard style={{ flex: 1, paddingVertical: 12 }}>
            <Text style={hs.inputLabel}>📏 Chiều cao</Text>
            <View style={hs.inputRow}>
              <PInput big value={height} onChangeText={setHeight} keyboardType="decimal-pad" placeholder="—" style={{ flex: 1 }} />
              <Text style={hs.unit}>cm</Text>
            </View>
          </PCard>
          <PCard style={{ flex: 1, paddingVertical: 12 }}>
            <Text style={hs.inputLabel}>⚖️ Cân nặng</Text>
            <View style={hs.inputRow}>
              <PInput big value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="—" style={{ flex: 1 }} />
              <Text style={hs.unit}>kg</Text>
            </View>
          </PCard>
        </View>

        <PCard delay={60}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={[hs.bmiCircle, { borderColor: bmiInfo.color }]}>
              <Text style={[hs.bmiValue, { color: bmiInfo.color }]}>{bmi}</Text>
              <Text style={hs.bmiLabel}>BMI</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: P.ink }}>{bmiInfo.label}</Text>
              <Text style={{ fontSize: 13, color: P.muted, marginTop: 3, lineHeight: 18 }}>{bmiInfo.hint}</Text>
              <View style={{ marginTop: 10 }}>
                <BmiScale value={bmiNum} />
              </View>
            </View>
          </View>
        </PCard>

        <SectionTitle title="Mục tiêu & vận động" />
        <PCard style={{ paddingVertical: 12 }}>
          <Text style={hs.inputLabel}>🎯 Cân nặng mục tiêu</Text>
          <View style={hs.inputRow}>
            <PInput big value={targetW} onChangeText={setTargetW} keyboardType="decimal-pad" placeholder="—" style={{ flex: 1 }} />
            <Text style={hs.unit}>kg</Text>
          </View>
          <Text style={[hs.inputLabel, { marginTop: 14 }]}>🏃 Mức vận động</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {ACTIVITY_OPTIONS.map((o) => (
              <PChip
                key={o.value}
                text={o.label}
                active={activity === o.value}
                onPress={() => setActivity(activity === o.value ? null : o.value)}
                check
              />
            ))}
          </View>
        </PCard>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatTile emoji="🎯" value={targetWeight} unit={targetWeight !== '—' ? 'kg' : undefined} label="Mục tiêu cân nặng" tint="orange" />
          <StatTile emoji="🏃" value={activityLabel(data?.activityLevel)} label="Mức vận động" tint="blue" />
        </View>

        <SectionTitle title="Mục tiêu mỗi ngày" sub="NOAN tính từ chỉ số của bạn" />
        <PCard delay={120}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
            {[
              ['🔥', 'Năng lượng', targets?.energyKcal != null ? `${targets.energyKcal}` : '—', 'kcal'],
              ['🥩', 'Protein', targets?.proteinG != null ? `${targets.proteinG}` : '—', 'g'],
              ['💧', 'Nước', targets?.waterMl != null ? `${(targets.waterMl / 1000).toLocaleString('vi-VN')}` : '—', 'L'],
              ['👟', 'Bước chân', targets?.steps != null ? Number(targets.steps).toLocaleString('vi-VN') : '—', ''],
            ].map(([emoji, label, value, unit]) => (
              <View key={label} style={{ width: '50%', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={hs.targetEmoji}>
                  <Text style={{ fontSize: 18 }}>{emoji}</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 12, color: P.muted }}>{label}</Text>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: P.ink }}>
                    {value}
                    {value !== '—' && unit ? <Text style={{ fontSize: 12.5, color: P.muted, fontWeight: '700' }}> {unit}</Text> : null}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          {!targets ? (
            <Text style={{ fontSize: 12.5, color: P.muted, marginTop: 12, lineHeight: 18 }}>
              Nhập chiều cao, cân nặng, mức vận động và ngày sinh để NOAN tính mục tiêu hằng ngày.
            </Text>
          ) : null}
        </PCard>

        {needDob && onEditProfile ? <PButton text="Bổ sung ngày sinh" variant="dark" onPress={onEditProfile} /> : null}
        {error ? <InlineNotice tone="error" text={error} /> : null}
        {msg ? <InlineNotice tone="success" text={msg} /> : null}
      </LoadBlock>
    </PageScaffold>
  );
}

function bmiCategory(bmi: number | null) {
  if (bmi == null || !Number.isFinite(bmi)) {
    return { label: 'Chưa có dữ liệu', hint: 'Nhập chiều cao và cân nặng để xem BMI.', color: P.faint };
  }
  if (bmi < 18.5) return { label: 'Thiếu cân', hint: 'Nên bổ sung thêm năng lượng và đạm trong bữa ăn.', color: '#3B82F6' };
  if (bmi < 23) return { label: 'Bình thường', hint: 'Tuyệt vời! Hãy duy trì chế độ ăn cân bằng.', color: '#16A34A' };
  if (bmi < 25) return { label: 'Thừa cân nhẹ', hint: 'Ưu tiên rau xanh, giảm đồ chiên và nước ngọt.', color: '#F59E0B' };
  return { label: 'Béo phì', hint: 'Nên tham khảo chuyên gia dinh dưỡng để có kế hoạch phù hợp.', color: '#E5402A' };
}

function BmiScale({ value }: { value: number | null }) {
  const segments = [
    { color: '#93C5FD', flex: 3.5 },
    { color: '#86EFAC', flex: 4.5 },
    { color: '#FCD34D', flex: 2 },
    { color: '#FCA5A5', flex: 5 },
  ];
  const min = 15;
  const max = 30;
  const pct = value != null ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : null;
  return (
    <View>
      <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
        {segments.map((s, i) => (
          <View key={i} style={{ flex: s.flex, backgroundColor: s.color }} />
        ))}
        </View>
      {pct != null ? (
        <View style={{ position: 'absolute', left: `${pct}%`, top: -3, marginLeft: -7 }}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: P.ink, borderWidth: 2.5, borderColor: '#FFFFFF' }} />
            </View>
      ) : null}
        </View>
  );
}

const hs = StyleSheet.create({
  inputLabel: { fontSize: 13, fontWeight: '700', color: P.muted },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 4 },
  unit: { fontSize: 14, fontWeight: '700', color: P.muted, marginBottom: 8 },
  bmiCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF7',
  },
  bmiValue: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  bmiLabel: { fontSize: 10.5, fontWeight: '800', color: P.muted, letterSpacing: 1 },
  targetEmoji: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#FFF6DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

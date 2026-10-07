import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StyledPressable as Pressable } from '../../../components/ui/styled-pressable';
import { profileApi, type SelectionPriority } from '../../../services/api/profile';
import { useMeProfile } from '../../../hooks/useMeProfile';
import { onboardingApi } from '../../../services/api/onboarding';
import { ingredientsApi, type AllergenItem } from '../../../services/api/ingredients';
import type { CatalogItem } from '../../../services/api/types';
import { recordPreferencesUpdatedStore } from '../../../services/app-store';
import { Check, HeartPulse, Sparkles, Wallet, Zap } from '@/components/icons';
import { P, PageScaffold, PButton, PCard, PChip, PToggleRow, SectionTitle, InfoBanner, InlineNotice } from '../ProfileUI';
import { LoadBlock, errMsg } from '../shared';

// ─── Preferences ─────────────────────────────────────────────────────────────

const PRIORITY_CODES = ['HEALTHY', 'ECONOMY', 'QUICK', 'NOVELTY'] as const;

export function PreferencesPage() {
  const { fetchVersion, mutate } = useMeProfile();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [goals, setGoals] = useState<CatalogItem[]>([]);
  const [tastes, setTastes] = useState<CatalogItem[]>([]);
  const [diets, setDiets] = useState<CatalogItem[]>([]);
  const [allergens, setAllergens] = useState<AllergenItem[]>([]);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [tasteIds, setTasteIds] = useState<string[]>([]);
  const [dietIds, setDietIds] = useState<string[]>([]);
  const [allergenIds, setAllergenIds] = useState<string[]>([]);
  const [noAllergies, setNoAllergies] = useState(false);
  const [priorities, setPriorities] = useState<Record<string, boolean>>({
    HEALTHY: false,
    ECONOMY: false,
    QUICK: false,
    NOVELTY: false,
  });
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchVersion();
      const [me, catalog, allergenList] = await Promise.all([
        profileApi.me(),
        onboardingApi.catalog(),
        ingredientsApi.getAllergens().catch(() => [] as AllergenItem[]),
      ]);
      setGoals(catalog.goals ?? []);
      setTastes(catalog.dietaryPreferences?.taste ?? []);
      setDiets(catalog.dietaryPreferences?.diet ?? []);
      setAllergens((allergenList ?? []).filter((a) => a.active !== false));
      setGoalId(me.preferences?.primaryGoal?.id ?? null);
      setTasteIds((me.preferences?.tastePreferences ?? []).map((x) => x.id));
      setDietIds((me.preferences?.dietTypes ?? []).map((x) => x.id));
      setAllergenIds((me.preferences?.allergens ?? []).map((x) => x.id));
      setNoAllergies(!!me.preferences?.noAllergies);
      const pri: Record<string, boolean> = { HEALTHY: false, ECONOMY: false, QUICK: false, NOVELTY: false };
      for (const p of me.preferences?.selectionPriorities ?? []) {
        if (p.code in pri) pri[p.code] = (p.weight ?? 0) > 0.3;
      }
      setPriorities(pri);
    } catch (e) {
      setError(errMsg(e, 'Không tải được sở thích.'));
    } finally {
      setLoading(false);
    }
  }, [fetchVersion]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      await mutate((v) =>
        profileApi.updatePreferences(
          {
            primaryGoalId: goalId ?? undefined,
            dietaryPreferenceIds: [...tasteIds, ...dietIds],
            ...(noAllergies ? { noAllergies: true } : { allergenIds, noAllergies: false }),
          },
          v,
        ),
      );
      const items: SelectionPriority[] = PRIORITY_CODES.map((code) => ({
        code,
        weight: priorities[code] ? 0.8 : 0.2,
      }));
      await profileApi.putSelectionPriorities(items);
      recordPreferencesUpdatedStore();
      setMsg('Đã lưu thay đổi.');
    } catch (e) {
      setError(errMsg(e, 'Không lưu được sở thích.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleId = (list: string[], id: string, setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };
  const togglePriority = (code: string) => (v: boolean) => setPriorities((p) => ({ ...p, [code]: v }));

  const activePriorities = Object.values(priorities).filter(Boolean).length;

  return (
    <PageScaffold
      footer={<PButton text={saving ? 'Đang lưu…' : 'Lưu thay đổi'} onPress={save} disabled={saving} loading={saving} />}
    >
      <LoadBlock loading={loading} error={error && goals.length === 0 ? error : null} onRetry={load} skeleton="form">
        <SectionTitle title="Mục tiêu chính" sub="Chọn một" />
        <ChoiceGrid items={goals} selected={goalId ? [goalId] : []} onToggle={(id) => setGoalId(goalId === id ? null : id)} emoji="🎯" />

        <SectionTitle title="Khẩu vị yêu thích" sub={tasteIds.length ? `Đã chọn ${tasteIds.length}` : 'Chọn nhiều'} />
        <ChoiceChips items={tastes} selected={tasteIds} onToggle={(id) => toggleId(tasteIds, id, setTasteIds)} />

        <SectionTitle title="Ẩm thực yêu thích" sub={dietIds.length ? `Đã chọn ${dietIds.length}` : 'Chọn nhiều'} />
        <ChoiceChips items={diets} selected={dietIds} onToggle={(id) => toggleId(dietIds, id, setDietIds)} />

        <SectionTitle
          title="Dị ứng"
          sub={noAllergies ? 'Không có dị ứng' : allergenIds.length ? `Đã chọn ${allergenIds.length}` : 'Chọn nếu có'}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <PChip
            text="Không có dị ứng"
            active={noAllergies}
            onPress={() => {
              setNoAllergies((v) => !v);
              setAllergenIds([]);
            }}
            tint="green"
            check
          />
          {allergens.map((a) => (
            <PChip
              key={a.id}
              text={a.name}
              active={!noAllergies && allergenIds.includes(a.id)}
              onPress={() => {
                setNoAllergies(false);
                toggleId(allergenIds, a.id, setAllergenIds);
              }}
              tint="red"
              check
            />
          ))}
        </View>

        <SectionTitle title="Ưu tiên khi chọn món" sub={activePriorities ? `${activePriorities} ưu tiên đang bật` : undefined} />
        <InfoBanner emoji="ℹ️" body="Bật những điều bạn muốn NOAN ưu tiên khi gợi ý và Random món." tint="blue" />
        <PCard noPadding>
          <PToggleRow icon={HeartPulse} tint="green" title="Lành mạnh" value={priorities.HEALTHY} onChange={togglePriority('HEALTHY')} />
          <PToggleRow icon={Wallet} tint="yellow" title="Tiết kiệm" value={priorities.ECONOMY} onChange={togglePriority('ECONOMY')} />
          <PToggleRow icon={Zap} tint="orange" title="Nhanh gọn" value={priorities.QUICK} onChange={togglePriority('QUICK')} />
          <PToggleRow icon={Sparkles} tint="purple" title="Thử món mới" value={priorities.NOVELTY} onChange={togglePriority('NOVELTY')} last />
        </PCard>

        {error ? <InlineNotice tone="error" text={error} /> : null}
        {msg ? <InlineNotice tone="success" text={msg} /> : null}
      </LoadBlock>
    </PageScaffold>
  );
}
function ChoiceGrid({
  items,
  selected,
  onToggle,
  emoji,
}: {
  items: CatalogItem[];
  selected: string[];
  onToggle: (id: string) => void;
  emoji?: string;
}) {
  if (items.length === 0) {
  return (
      <PCard>
        <Text style={{ color: P.muted, textAlign: 'center' }}>Chưa có lựa chọn.</Text>
      </PCard>
    );
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {items.map((x) => {
        const active = selected.includes(x.id);
        return (
          <Pressable
            key={x.id}
            onPress={() => onToggle(x.id)}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [ps.gridItem, active && ps.gridItemActive, pressed && { transform: [{ scale: 0.97 }] }]}
          >
            {active ? (
              <View style={ps.gridCheck}>
                <Check size={12} color="#FFFFFF" strokeWidth={3} />
              </View>
            ) : null}
            {emoji ? <Text style={{ fontSize: 20 }}>{emoji}</Text> : null}
            <Text style={[ps.gridTxt, active && { color: P.accentDeep }]} numberOfLines={2}>
              {x.name}
            </Text>
            {x.description ? (
              <Text style={ps.gridDesc} numberOfLines={2}>
                {x.description}
              </Text>
            ) : null}
      </Pressable>
        );
      })}
    </View>
  );
}

function ChoiceChips({
  items,
  selected,
  onToggle,
}: {
  items: CatalogItem[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (items.length === 0) {
  return (
      <PCard>
        <Text style={{ color: P.muted, textAlign: 'center' }}>Chưa có lựa chọn.</Text>
      </PCard>
    );
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map((x) => (
        <PChip key={x.id} text={x.name} active={selected.includes(x.id)} onPress={() => onToggle(x.id)} check />
      ))}
    </View>
  );
}

const ps = StyleSheet.create({
  gridItem: {
    width: '48%',
    flexGrow: 1,
    minHeight: 84,
    backgroundColor: P.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 4,
    shadowColor: '#5D490F',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  gridItemActive: { backgroundColor: '#FFF8E1', borderColor: P.accent },
  gridCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: P.accentDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTxt: { fontSize: 14.5, fontWeight: '800', color: P.ink, marginTop: 2 },
  gridDesc: { fontSize: 12, color: P.muted, lineHeight: 16 },
});

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { StyledPressable as Pressable } from '../../../components/ui/styled-pressable';
import { profileApi } from '../../../services/api/profile';
import { ingredientsApi, type IngredientItem } from '../../../services/api/ingredients';
import { P, PageScaffold, PButton, PCard, PSearchBar, SectionTitle, InfoBanner, InlineNotice, EmptyBlock } from '../ProfileUI';
import { recordAvoidancesUpdatedStore } from '../../../services/app-store';
import { Check, Plus, X } from '@/components/icons';
import { LoadBlock, errMsg } from '../shared';

// ─── Avoid ingredients ───────────────────────────────────────────────────────

type AvoidItem = {
  name: string;
  ingredientId?: string | null;
  mode?: 'HARD' | 'SOFT';
};

const AVOID_EMOJI: Record<string, string> = {
  'trứng': '🥚',
  'gluten': '🌾',
  'đậu nành': '🫘',
  'nấm': '🍄',
  'thịt bò': '🥩',
  'thịt heo': '🥓',
  'sữa': '🥛',
  'đậu phộng': '🥜',
  'hải sản': '🦐',
  'tôm': '🦐',
  'cua': '🦀',
  'cá': '🐟',
  'lúa mì': '🌾',
  'mè': '🌰',
  'hạt': '🌰',
};
function avoidEmoji(name: string) {
  const k = name.trim().toLowerCase();
  for (const key of Object.keys(AVOID_EMOJI)) if (k.includes(key)) return AVOID_EMOJI[key];
  return '🚫';
}

export function AvoidPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState<AvoidItem[]>([]);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IngredientItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ name: string; id?: string }>>([
    { name: 'Trứng' },
    { name: 'Gluten' },
    { name: 'Đậu nành' },
    { name: 'Nấm' },
    { name: 'Thịt bò' },
    { name: 'Thịt heo' },
  ]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [me, allergens] = await Promise.all([
        profileApi.me(),
        ingredientsApi.getAllergens().catch(() => []),
      ]);
      const avoided: AvoidItem[] = (me.preferences?.avoidedIngredients ?? [])
        .map((x) => ({
          name: (x.name ?? x.ingredientName ?? x.text ?? '').trim(),
          ingredientId: x.ingredientId ?? null,
          mode: (x as any).mode ?? 'HARD',
        }))
        .filter((x) => Boolean(x.name));
      setTags(avoided);

      if (Array.isArray(allergens) && allergens.length > 0) {
        const topAllergens = allergens
          .filter((a) => a.active !== false && a.code !== 'OTHER' && a.code !== 'SEAFOOD')
          .slice(0, 6)
          .map((a) => ({ name: a.name }));
        const combined: Array<{ name: string; id?: string }> = [...topAllergens];
        for (const extra of [{ name: 'Nấm' }, { name: 'Thịt bò' }, { name: 'Thịt heo' }]) {
          if (!combined.some((c) => c.name.toLowerCase() === extra.name.toLowerCase())) combined.push(extra);
        }
        setSuggestions(combined.slice(0, 8));
      }
    } catch (e) {
      setError(errMsg(e, 'Không tải được danh sách tránh.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await ingredientsApi.search(q, 8);
        if (!cancelled) setSearchResults(Array.isArray(results) ? results : []);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const has = (name: string) => tags.some((x) => x.name.toLowerCase() === name.trim().toLowerCase());
  const addTag = (name: string, ingredientId?: string | null) => {
    const cleanName = name.trim();
    if (!cleanName || has(cleanName)) return;
    setTags((prev) => [...prev, { name: cleanName, ingredientId: ingredientId ?? null, mode: 'HARD' }]);
    setQuery('');
    setSearchResults([]);
  };
  const removeTag = (name: string) =>
    setTags((prev) => prev.filter((t) => t.name.toLowerCase() !== name.toLowerCase()));
  const toggleTag = (name: string, ingredientId?: string | null) =>
    has(name) ? removeTag(name.trim()) : addTag(name, ingredientId);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      await profileApi.putAvoidances({
        items: tags.map((t) => ({ text: t.name, ingredientId: t.ingredientId ?? undefined, mode: t.mode ?? 'HARD' })),
      });
      setMsg('Đã lưu danh sách nguyên liệu cần tránh.');
      recordAvoidancesUpdatedStore();
    } catch (e) {
      setError(errMsg(e, 'Không lưu được.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageScaffold
      footer={
        <PButton
          text={saving ? 'Đang lưu…' : tags.length ? `Lưu ${tags.length} lựa chọn` : 'Lưu'}
          onPress={save}
          disabled={saving}
          loading={saving}
        />
      }
    >
      <LoadBlock loading={loading} error={error && tags.length === 0 ? error : null} onRetry={load} skeleton="form">
        <InfoBanner emoji="🛡️" body="NOAN sẽ tự loại các món có chứa nguyên liệu bạn chọn khỏi gợi ý và Random." />

        <PSearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Tìm hoặc nhập nguyên liệu…"
          onSubmit={() => addTag(query)}
          right={
            isSearching ? (
              <ActivityIndicator size="small" color={P.accentDeep} />
            ) : query.trim() ? (
              <Pressable onPress={() => addTag(query)} hitSlop={8} accessibilityLabel="Thêm nguyên liệu" style={as.addBtn}>
                <Plus color={P.ink} size={16} strokeWidth={2.5} />
            </Pressable>
            ) : undefined
          }
        />

        {searchResults.length > 0 ? (
          <PCard noPadding style={{ marginTop: -6 }}>
            {searchResults.map((item, idx) => {
              const isSelected = has(item.name);
  return (
                <Pressable
                  key={item.id || idx}
                  onPress={() => toggleTag(item.name, item.id)}
                  style={({ pressed }) => [as.resultRow, idx < searchResults.length - 1 && as.resultDivider, pressed && { backgroundColor: '#FFFBF2' }]}
                >
                  <Text style={{ fontSize: 20 }}>{avoidEmoji(item.name)}</Text>
      <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: P.ink }}>{item.name}</Text>
                    {item.allergenCode ? (
                      <Text style={{ fontSize: 12, color: P.accentDeep, marginTop: 1 }}>Nhóm dị ứng: {item.allergenCode}</Text>
                    ) : null}
      </View>
                  <View style={[as.resultAction, isSelected && { backgroundColor: P.ink }]}>
                    {isSelected ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : <Plus size={14} color={P.ink} strokeWidth={2.5} />}
                  </View>
                </Pressable>
              );
            })}
          </PCard>
        ) : null}

        <SectionTitle title="Đang tránh" sub={tags.length ? `${tags.length} nguyên liệu · chạm để bỏ` : undefined} />
        {tags.length === 0 ? (
          <PCard>
            <EmptyBlock emoji="🥗" title="Chưa chọn nguyên liệu nào" body="Tìm ở trên hoặc chọn nhanh từ gợi ý bên dưới." />
          </PCard>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {tags.map((x) => (
              <Animated.View key={x.name} entering={FadeInDown.duration(220)}>
                <Pressable onPress={() => removeTag(x.name)} style={({ pressed }) => [as.tag, pressed && { opacity: 0.7 }]}>
                  <Text style={{ fontSize: 15 }}>{avoidEmoji(x.name)}</Text>
                  <Text style={as.tagTxt}>{x.name}</Text>
                  <View style={as.tagX}>
                    <X size={11} color="#FFFFFF" strokeWidth={3} />
          </View>
                </Pressable>
              </Animated.View>
        ))}
      </View>
        )}

        <SectionTitle title="Gợi ý phổ biến" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {suggestions.map((x, i) => {
            const isSelected = has(x.name);
  return (
              <Animated.View key={x.name} entering={FadeInDown.delay(60 + i * 40).duration(320)} style={{ width: '48%', flexGrow: 1 }}>
                <Pressable
                  onPress={() => toggleTag(x.name, x.id)}
                  style={({ pressed }) => [as.suggest, isSelected && as.suggestActive, pressed && { transform: [{ scale: 0.97 }] }]}
                >
                  <View style={[as.suggestEmoji, isSelected && { backgroundColor: '#FFE08A' }]}>
                    <Text style={{ fontSize: 20 }}>{avoidEmoji(x.name)}</Text>
            </View>
                  <Text style={[as.suggestTxt, isSelected && { color: P.accentDeep }]} numberOfLines={1}>
                    {x.name}
                  </Text>
                  {isSelected ? <Check size={18} color={P.accentDeep} strokeWidth={2.5} /> : <Plus size={18} color={P.faint} />}
          </Pressable>
              </Animated.View>
        );
      })}
    </View>

        {error ? <InlineNotice tone="error" text={error} /> : null}
        {msg ? <InlineNotice tone="success" text={msg} /> : null}
      </LoadBlock>
    </PageScaffold>
  );
}

const as = StyleSheet.create({
  addBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  resultDivider: { borderBottomWidth: 1, borderBottomColor: '#F6EFE2' },
  resultAction: { width: 28, height: 28, borderRadius: 14, backgroundColor: P.accentSoft, alignItems: 'center', justifyContent: 'center' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingRight: 6,
    height: 38,
    borderRadius: 19,
    backgroundColor: P.ink,
  },
  tagTxt: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  tagX: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  suggest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: P.card,
    borderRadius: 16,
    padding: 10,
    paddingRight: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#5D490F',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  suggestActive: { backgroundColor: '#FFF8E1', borderColor: P.accent },
  suggestEmoji: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#F6F0E4', alignItems: 'center', justifyContent: 'center' },
  suggestTxt: { flex: 1, fontSize: 14.5, fontWeight: '700', color: P.ink },
});

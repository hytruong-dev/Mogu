/**
 * Bottom sheet hồ sơ ăn uống đang áp dụng — Drawer + Accordion (react-native-reusables).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import {
  AlertTriangle,
  Check,
  Leaf,
  ShieldPlus,
  Target,
} from 'lucide-react-native';
import { onboardingApi } from '../../services/api/onboarding';
import { profileApi } from '../../services/api/profile';
import { formatApiErrorWithCode } from '../../lib/api-error';
import type { CatalogItem } from '../../services/api/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '../ui/drawer';
import { Text } from '../ui/text';
import { cn } from '../../lib/utils';

type MeProfile = {
  version?: number;
  profileVersion?: number;
  noAllergies?: boolean;
  preferences?: {
    primaryGoal?: { id: string; code: string; name: string } | null;
    tastePreferences?: CatalogItem[];
    dietTypes?: CatalogItem[];
    allergens?: CatalogItem[];
  };
};

export type ProfileSnapshot = {
  profileVersion: number;
  primaryGoal: { id: string; code: string; name: string } | null;
  dietTypes: CatalogItem[];
  tasteIds: string[];
  allergens: CatalogItem[];
  noAllergies: boolean;
  goalCodes: string[];
  dietTypeCodes: string[];
};

type AccordionKey = 'goal' | 'diet' | 'allergy';
type PendingConfirmation =
  | { kind: 'discard' }
  | { kind: 'remove-allergen'; allergenId: string }
  | null;

type Props = {
  visible: boolean;
  onClose: () => void;
  onApplied: (snapshot: ProfileSnapshot) => void;
  initialSnapshot?: ProfileSnapshot | null;
};

function labelOrUndeclared(text: string | null | undefined): string {
  const t = text?.trim();
  return t ? t : 'Chưa khai báo';
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function OptionGrid({
  items,
  selectedIds,
  multi,
  onToggle,
}: {
  items: CatalogItem[];
  selectedIds: string[];
  multi?: boolean;
  onToggle: (id: string, currentlySelected: boolean) => void;
}) {
  return (
    <View className="gap-2 rounded-xl border border-border bg-muted/40 p-2">
      {chunkArray(items, 3).map((row, rowIdx) => (
        <View key={rowIdx} className="flex-row gap-2">
          {row.map((item) => {
            const selected = selectedIds.includes(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => onToggle(item.id, selected)}
                className={cn(
                  'relative min-h-[52px] flex-1 items-center justify-center rounded-xl border-[1.5px] px-1 py-2',
                  selected ? 'border-primary bg-secondary' : 'border-border bg-background',
                )}
              >
                {selected ? (
                  <View className="absolute right-1 top-1 size-3.5 items-center justify-center rounded-full bg-primary">
                    <Check size={9} color="#18181B" strokeWidth={3} />
                  </View>
                ) : null}
                <Text
                  numberOfLines={2}
                  className={cn(
                    'text-center text-xs leading-4',
                    selected ? 'font-extrabold text-foreground' : 'font-semibold text-muted-foreground',
                  )}
                >
                  {item.name}
                </Text>
              </Pressable>
            );
          })}
          {row.length < 3
            ? Array.from({ length: 3 - row.length }).map((_, idx) => (
                <View key={`ph-${rowIdx}-${idx}`} className="flex-1" />
              ))
            : null}
        </View>
      ))}
      {multi ? null : null}
    </View>
  );
}

export function RandomProfileSheet({ visible, onClose, onApplied, initialSnapshot }: Props) {
  const snapHeight = Math.round(Dimensions.get('window').height * 0.88);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<AccordionKey | undefined>(undefined);

  const [version, setVersion] = useState(1);
  const [goals, setGoals] = useState<CatalogItem[]>([]);
  const [diets, setDiets] = useState<CatalogItem[]>([]);
  const [allergensCatalog, setAllergensCatalog] = useState<CatalogItem[]>([]);
  const [tasteIds, setTasteIds] = useState<string[]>([]);

  const [goalId, setGoalId] = useState<string | null>(null);
  const [dietIds, setDietIds] = useState<string[]>([]);
  const [allergenIds, setAllergenIds] = useState<string[]>([]);
  const [noAllergies, setNoAllergies] = useState(false);

  const [baseGoalId, setBaseGoalId] = useState<string | null>(null);
  const [baseDietIds, setBaseDietIds] = useState<string[]>([]);
  const [baseAllergenIds, setBaseAllergenIds] = useState<string[]>([]);
  const [baseNoAllergies, setBaseNoAllergies] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation>(null);

  const dirty = useMemo(() => {
    const sameArr = (a: string[], b: string[]) =>
      a.length === b.length && a.every((x) => b.includes(x));
    return (
      goalId !== baseGoalId ||
      !sameArr(dietIds, baseDietIds) ||
      !sameArr(allergenIds, baseAllergenIds) ||
      noAllergies !== baseNoAllergies
    );
  }, [
    goalId,
    baseGoalId,
    dietIds,
    baseDietIds,
    allergenIds,
    baseAllergenIds,
    noAllergies,
    baseNoAllergies,
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [me, catalog] = await Promise.all([
        profileApi.me<MeProfile>(),
        onboardingApi.catalog(),
      ]);
      const ver = me.version ?? me.profileVersion ?? 1;
      setVersion(ver);
      setGoals(catalog.goals ?? []);
      setDiets(catalog.dietaryPreferences?.diet ?? []);
      setAllergensCatalog(catalog.allergens ?? []);

      const gId = me.preferences?.primaryGoal?.id ?? null;
      const dIds = (me.preferences?.dietTypes ?? []).map((x) => x.id);
      const tIds = (me.preferences?.tastePreferences ?? []).map((x) => x.id);
      const aIds = (me.preferences?.allergens ?? []).map((x) => x.id);
      const none = Boolean(me.noAllergies);

      setGoalId(gId);
      setDietIds(dIds);
      setTasteIds(tIds);
      setAllergenIds(aIds);
      setNoAllergies(none);
      setBaseGoalId(gId);
      setBaseDietIds(dIds);
      setBaseAllergenIds(aIds);
      setBaseNoAllergies(none);

      onApplied({
        profileVersion: ver,
        primaryGoal: me.preferences?.primaryGoal ?? null,
        dietTypes: me.preferences?.dietTypes ?? [],
        tasteIds: tIds,
        allergens: me.preferences?.allergens ?? [],
        noAllergies: none,
        goalCodes: me.preferences?.primaryGoal?.code ? [me.preferences.primaryGoal.code] : [],
        dietTypeCodes: (me.preferences?.dietTypes ?? []).map((d) => d.code).filter(Boolean),
      });
    } catch (e) {
      setError(formatApiErrorWithCode(e));
    } finally {
      setLoading(false);
    }
  }, [onApplied]);

  useEffect(() => {
    if (visible) {
      setOpen(undefined);
      void load();
    }
  }, [visible, load]);

  const resetDraft = () => {
    setGoalId(baseGoalId);
    setDietIds(baseDietIds);
    setAllergenIds(baseAllergenIds);
    setNoAllergies(baseNoAllergies);
    setError(null);
  };

  const requestClose = () => {
    if (!dirty) {
      onClose();
      return;
    }
    setPendingConfirmation({ kind: 'discard' });
  };

  const confirmPendingAction = () => {
    if (pendingConfirmation?.kind === 'discard') {
      resetDraft();
      setPendingConfirmation(null);
      onClose();
      return;
    }
    if (pendingConfirmation?.kind === 'remove-allergen') {
      setNoAllergies(false);
      setAllergenIds((prev) => prev.filter((id) => id !== pendingConfirmation.allergenId));
      setPendingConfirmation(null);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await profileApi.updatePreferences(
        {
          primaryGoalId: goalId ?? undefined,
          dietaryPreferenceIds: [...tasteIds, ...dietIds],
          allergenIds: noAllergies ? [] : allergenIds,
          noAllergies,
        },
        version,
      );
      const nextVer = (updated as any)?.profileVersion ?? (updated as any)?.version ?? version + 1;
      setVersion(nextVer);
      setBaseGoalId(goalId);
      setBaseDietIds(dietIds);
      setBaseAllergenIds(allergenIds);
      setBaseNoAllergies(noAllergies);

      const goal = goals.find((g) => g.id === goalId) ?? null;
      const dietItems = diets.filter((d) => dietIds.includes(d.id));
      const allergenItems = allergensCatalog.filter((a) => allergenIds.includes(a.id));
      onApplied({
        profileVersion: nextVer,
        primaryGoal: goal ? { id: goal.id, code: goal.code, name: goal.name } : null,
        dietTypes: dietItems,
        tasteIds,
        allergens: allergenItems,
        noAllergies,
        goalCodes: goal?.code ? [goal.code] : [],
        dietTypeCodes: dietItems.map((d) => d.code),
      });
      onClose();
    } catch (e) {
      setError(formatApiErrorWithCode(e));
    } finally {
      setSaving(false);
    }
  };

  const goalLabel = labelOrUndeclared(
    goals.find((g) => g.id === goalId)?.name ?? initialSnapshot?.primaryGoal?.name,
  );
  const dietLabel =
    dietIds.length === 0
      ? 'Chưa khai báo'
      : diets
          .filter((d) => dietIds.includes(d.id))
          .map((d) => d.name)
          .join(', ') || 'Chưa khai báo';
  const allergyLabel = noAllergies
    ? 'Không có dị ứng đã biết'
    : allergenIds.length === 0
      ? 'Chưa khai báo'
      : allergensCatalog
          .filter((a) => allergenIds.includes(a.id))
          .map((a) => a.name)
          .join(', ') || 'Chưa khai báo';

  const showAllergyWarn = !noAllergies && allergenIds.length === 0;

  const isRemoveAllergen = pendingConfirmation?.kind === 'remove-allergen';

  return (
    <>
      <Drawer
        open={visible}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
        snapHeight={snapHeight}
      >
        <DrawerHeader className="flex-row items-start gap-2 px-4">
          <View className="flex-1">
            <DrawerTitle>Hồ sơ ăn uống đang áp dụng</DrawerTitle>
            <DrawerDescription>Mogu dùng thông tin này khi chọn món.</DrawerDescription>
          </View>
          <DrawerClose onPress={requestClose} />
        </DrawerHeader>

        <DrawerContent className="max-h-[62%] px-4 pb-2">
          {loading ? (
            <View className="items-center py-10">
              <ActivityIndicator color="#FFC31A" />
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Accordion
                type="single"
                collapsible
                value={open}
                onValueChange={(v: string | undefined) =>
                  setOpen((v as AccordionKey | undefined) || undefined)
                }
                className="w-full gap-0"
              >
                <AccordionItem value="goal" className="mb-2 overflow-hidden rounded-2xl border border-border px-3">
                  <AccordionTrigger className="py-3.5">
                    <View className="flex-1 flex-row items-center gap-3">
                      <View className="size-9 items-center justify-center rounded-[10px] bg-secondary">
                        <Target size={18} color="#101010" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[13px] font-bold text-foreground">Mục tiêu</Text>
                        <Text className="mt-0.5 text-[13px] text-muted-foreground">{goalLabel}</Text>
                      </View>
                    </View>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    <OptionGrid
                      items={goals}
                      selectedIds={goalId ? [goalId] : []}
                      onToggle={(id) => setGoalId(id)}
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="diet" className="mb-2 overflow-hidden rounded-2xl border border-border px-3">
                  <AccordionTrigger className="py-3.5">
                    <View className="flex-1 flex-row items-center gap-3">
                      <View className="size-9 items-center justify-center rounded-[10px] bg-secondary">
                        <Leaf size={18} color="#101010" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[13px] font-bold text-foreground">Chế độ ăn</Text>
                        <Text className="mt-0.5 text-[13px] text-muted-foreground" numberOfLines={2}>
                          {dietLabel}
                        </Text>
                      </View>
                    </View>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    <OptionGrid
                      items={diets}
                      selectedIds={dietIds}
                      multi
                      onToggle={(id, selected) =>
                        setDietIds((prev) =>
                          selected ? prev.filter((x) => x !== id) : [...prev, id],
                        )
                      }
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="allergy" className="mb-2 overflow-hidden rounded-2xl border border-border px-3">
                  <AccordionTrigger className="py-3.5">
                    <View className="flex-1 flex-row items-center gap-3">
                      <View className="size-9 items-center justify-center rounded-[10px] bg-secondary">
                        <ShieldPlus size={18} color="#101010" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[13px] font-bold text-foreground">Dị ứng đã khai báo</Text>
                        <Text className="mt-0.5 text-[13px] text-muted-foreground" numberOfLines={2}>
                          {allergyLabel}
                        </Text>
                      </View>
                    </View>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    <View className="gap-2 rounded-xl border border-border bg-muted/40 p-2">
                      <Pressable
                        onPress={() => {
                          if (noAllergies) setNoAllergies(false);
                          else {
                            setNoAllergies(true);
                            setAllergenIds([]);
                          }
                        }}
                        className={cn(
                          'flex-row items-center gap-2.5 rounded-xl border-[1.5px] px-3 py-2.5',
                          noAllergies ? 'border-primary bg-secondary' : 'border-border bg-background',
                        )}
                      >
                        <Checkbox
                          checked={noAllergies}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setNoAllergies(true);
                              setAllergenIds([]);
                            } else {
                              setNoAllergies(false);
                            }
                          }}
                          className="size-5 rounded-md"
                          checkedClassName="border-primary"
                        />
                        <Text
                          className={cn(
                            'flex-1 text-[13px]',
                            noAllergies ? 'font-extrabold text-foreground' : 'font-semibold text-muted-foreground',
                          )}
                        >
                          Tôi không có dị ứng đã biết
                        </Text>
                      </Pressable>

                      {chunkArray(allergensCatalog, 3).map((row, rowIdx) => (
                        <View key={rowIdx} className="flex-row gap-2">
                          {row.map((a) => {
                            const selected = !noAllergies && allergenIds.includes(a.id);
                            return (
                              <Pressable
                                key={a.id}
                                onPress={() => {
                                  if (selected && baseAllergenIds.includes(a.id)) {
                                    setPendingConfirmation({
                                      kind: 'remove-allergen',
                                      allergenId: a.id,
                                    });
                                    return;
                                  }
                                  setNoAllergies(false);
                                  setAllergenIds((prev) =>
                                    prev.includes(a.id)
                                      ? prev.filter((x) => x !== a.id)
                                      : [...prev, a.id],
                                  );
                                }}
                                className={cn(
                                  'relative min-h-[52px] flex-1 items-center justify-center rounded-xl border-[1.5px] px-1 py-2',
                                  selected ? 'border-primary bg-secondary' : 'border-border bg-background',
                                )}
                              >
                                {selected ? (
                                  <View className="absolute right-1 top-1 size-3.5 items-center justify-center rounded-full bg-primary">
                                    <Check size={9} color="#18181B" strokeWidth={3} />
                                  </View>
                                ) : null}
                                <Text
                                  numberOfLines={2}
                                  className={cn(
                                    'text-center text-xs leading-4',
                                    selected
                                      ? 'font-extrabold text-foreground'
                                      : 'font-semibold text-muted-foreground',
                                  )}
                                >
                                  {a.name}
                                </Text>
                              </Pressable>
                            );
                          })}
                          {row.length < 3
                            ? Array.from({ length: 3 - row.length }).map((_, idx) => (
                                <View key={`allergy-ph-${idx}`} className="flex-1" />
                              ))
                            : null}
                        </View>
                      ))}
                    </View>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {showAllergyWarn ? (
                <Alert icon={AlertTriangle} className="mt-2 border-[#FFE082] bg-[#FFF8E1]" iconClassName="text-[#C08000]">
                  <AlertDescription className="text-[#7A6120]">
                    Chưa khai báo không có nghĩa là không dị ứng. Hãy kiểm tra nguyên liệu trước khi ăn.
                  </AlertDescription>
                </Alert>
              ) : null}

              {error ? (
                <Text className="mt-2 text-center text-[13px] text-destructive">{error}</Text>
              ) : null}
            </ScrollView>
          )}
        </DrawerContent>

        <DrawerFooter className="px-4">
          {dirty ? (
            <>
              <Text className="mb-1 text-center text-xs text-muted-foreground">
                Thay đổi sẽ lưu vào hồ sơ của bạn
              </Text>
              <View className="flex-row gap-2.5">
                <Button
                  variant="outline"
                  disabled={saving}
                  onPress={resetDraft}
                  className="h-12 flex-1 rounded-2xl"
                >
                  <Text className="font-bold text-foreground">Huỷ thay đổi</Text>
                </Button>
                <Button
                  disabled={saving}
                  onPress={() => void save()}
                  className="h-12 flex-1 rounded-2xl bg-primary"
                >
                  {saving ? (
                    <ActivityIndicator color="#18181B" />
                  ) : (
                    <Text className="font-extrabold text-foreground">Lưu và áp dụng</Text>
                  )}
                </Button>
              </View>
            </>
          ) : (
            <Button onPress={onClose} className="h-12 w-full rounded-2xl bg-primary">
              <Text className="font-extrabold text-foreground">Xong</Text>
            </Button>
          )}
        </DrawerFooter>
      </Drawer>

      <ConfirmDialog
        visible={pendingConfirmation !== null}
        tone={isRemoveAllergen ? 'danger' : 'warning'}
        title={isRemoveAllergen ? 'Xoá dị ứng này?' : 'Bỏ thay đổi?'}
        description={
          isRemoveAllergen
            ? 'Việc này có thể mở rộng tập món được gợi ý.'
            : 'Các lựa chọn chưa lưu sẽ không được áp dụng.'
        }
        confirmLabel={isRemoveAllergen ? 'Xoá dị ứng' : 'Bỏ thay đổi'}
        cancelLabel={isRemoveAllergen ? 'Giữ dị ứng' : 'Tiếp tục chỉnh sửa'}
        dismissOnBackdrop={false}
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={confirmPendingAction}
      />
    </>
  );
}

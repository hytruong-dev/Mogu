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
  columns = 2,
  onToggle,
}: {
  items: CatalogItem[];
  selectedIds: string[];
  columns?: number;
  multi?: boolean;
  onToggle: (id: string, currentlySelected: boolean) => void;
}) {
  return (
    <View className="gap-2">
      {chunkArray(items, columns).map((row, rowIdx) => (
        <View key={rowIdx} className="flex-row gap-2">
          {row.map((item) => {
            const selected = selectedIds.includes(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => onToggle(item.id, selected)}
                className={cn(
                  'relative min-h-[50px] flex-1 items-center justify-center rounded-xl border-[1.5px] px-2 py-2',
                  selected
                    ? 'border-[#FFC31A] bg-[#FFFDF0]'
                    : 'border-[#EAE4D6] bg-white',
                )}
              >
                {selected ? (
                  <View className="absolute right-1.5 top-1.5 size-4 items-center justify-center rounded-full bg-[#FFC31A]">
                    <Check size={10} color="#161616" strokeWidth={3} />
                  </View>
                ) : null}
                <Text
                  numberOfLines={2}
                  className={cn(
                    'text-center text-xs leading-4',
                    selected
                      ? 'font-extrabold text-[#161616]'
                      : 'font-semibold text-[#747474]',
                  )}
                >
                  {item.name}
                </Text>
              </Pressable>
            );
          })}
          {row.length < columns
            ? Array.from({ length: columns - row.length }).map((_, idx) => (
                <View key={`ph-${rowIdx}-${idx}`} className="flex-1" />
              ))
            : null}
        </View>
      ))}
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
        <DrawerHeader className="flex-row items-start gap-2 px-5 pb-2">
          <View className="flex-1">
            <DrawerTitle className="text-[19px] font-black text-[#161616]">
              Hồ sơ ăn uống đang áp dụng
            </DrawerTitle>
            <DrawerDescription className="mt-1 text-[13px] text-[#747474]">
              Mogu tự động lọc theo các tiêu chí này khi random.
            </DrawerDescription>
          </View>
          <DrawerClose onPress={requestClose} />
        </DrawerHeader>

        <DrawerContent className="max-h-[66%] px-4 pb-2">
          {loading ? (
            <View className="items-center py-10">
              <ActivityIndicator color="#FFC31A" />
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="overflow-hidden rounded-[22px] border border-[#EAE4D6] bg-white shadow-sm">
                <Accordion
                  type="single"
                  collapsible
                  value={open}
                  onValueChange={(v: string | undefined) =>
                    setOpen((v as AccordionKey | undefined) || undefined)
                  }
                  className="w-full gap-0"
                >
                  {/* Row 1: Mục tiêu chính */}
                  <AccordionItem value="goal" className="border-b border-[#F0EBE0]">
                    <AccordionTrigger className="px-4 py-3.5 hover:no-underline">
                      <View className="mr-1 flex-1 flex-row items-center justify-between gap-3">
                        <View className="flex-1 flex-row items-center gap-3">
                          <View className="size-10 items-center justify-center rounded-xl bg-[#FFF3D6]">
                            <Target size={20} color="#D9822B" />
                          </View>
                          <Text className="text-[15px] font-bold text-[#161616]">
                            Mục tiêu chính
                          </Text>
                        </View>
                        <Text
                          className="max-w-[130px] text-right text-[13.5px] font-medium text-[#747474]"
                          numberOfLines={1}
                        >
                          {goalLabel}
                        </Text>
                      </View>
                    </AccordionTrigger>
                    <AccordionContent className="pb-3 pt-0">
                      <View className="mx-3 rounded-2xl border border-[#EFE9DC] bg-[#FAF7EE] p-2.5">
                        <OptionGrid
                          items={goals}
                          selectedIds={goalId ? [goalId] : []}
                          columns={2}
                          onToggle={(id) => setGoalId(id)}
                        />
                      </View>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Row 2: Chế độ ăn */}
                  <AccordionItem value="diet" className="border-b border-[#F0EBE0]">
                    <AccordionTrigger className="px-4 py-3.5 hover:no-underline">
                      <View className="mr-1 flex-1 flex-row items-center justify-between gap-3">
                        <View className="flex-1 flex-row items-center gap-3">
                          <View className="size-10 items-center justify-center rounded-xl bg-[#E8F5E9]">
                            <Leaf size={20} color="#2E7D32" />
                          </View>
                          <Text className="text-[15px] font-bold text-[#161616]">
                            Chế độ ăn
                          </Text>
                        </View>
                        <Text
                          className="max-w-[130px] text-right text-[13.5px] font-medium text-[#747474]"
                          numberOfLines={1}
                        >
                          {dietLabel}
                        </Text>
                      </View>
                    </AccordionTrigger>
                    <AccordionContent className="pb-3 pt-0">
                      <View className="mx-3 rounded-2xl border border-[#EFE9DC] bg-[#FAF7EE] p-2.5">
                        <OptionGrid
                          items={diets}
                          selectedIds={dietIds}
                          columns={2}
                          multi
                          onToggle={(id, selected) =>
                            setDietIds((prev) =>
                              selected ? prev.filter((x) => x !== id) : [...prev, id],
                            )
                          }
                        />
                      </View>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Row 3: Dị ứng cần tránh */}
                  <AccordionItem value="allergy" className="border-b-0">
                    <AccordionTrigger className="px-4 py-3.5 hover:no-underline">
                      <View className="mr-1 flex-1 flex-row items-center justify-between gap-3">
                        <View className="flex-1 flex-row items-center gap-3">
                          <View className="size-10 items-center justify-center rounded-xl bg-[#FDEED9]">
                            <ShieldPlus size={20} color="#C05621" />
                          </View>
                          <Text className="text-[15px] font-bold text-[#161616]">
                            Dị ứng cần tránh
                          </Text>
                        </View>
                        <Text
                          className="max-w-[130px] text-right text-[13.5px] font-medium text-[#747474]"
                          numberOfLines={1}
                        >
                          {allergyLabel}
                        </Text>
                      </View>
                    </AccordionTrigger>
                    <AccordionContent className="pb-3 pt-0">
                      <View className="mx-3 gap-2.5 rounded-2xl border border-[#EFE9DC] bg-[#FAF7EE] p-2.5">
                        <Pressable
                          onPress={() => {
                            if (noAllergies) setNoAllergies(false);
                            else {
                              setNoAllergies(true);
                              setAllergenIds([]);
                            }
                          }}
                          className={cn(
                            'relative flex-row items-center gap-3 rounded-xl border-[1.5px] px-3.5 py-2.5',
                            noAllergies
                              ? 'border-[#FFC31A] bg-[#FFFDF0]'
                              : 'border-[#EAE4D6] bg-white',
                          )}
                        >
                          <View
                            className={cn(
                              'size-5 items-center justify-center rounded-md border-[1.5px]',
                              noAllergies
                                ? 'border-[#FFC31A] bg-[#FFC31A]'
                                : 'border-[#D1D5DB] bg-white',
                            )}
                          >
                            {noAllergies ? <Check size={12} color="#161616" strokeWidth={3} /> : null}
                          </View>
                          <Text
                            className={cn(
                              'flex-1 text-[13.5px]',
                              noAllergies
                                ? 'font-bold text-[#161616]'
                                : 'font-semibold text-[#747474]',
                            )}
                          >
                            Tôi không có dị ứng đã biết
                          </Text>
                        </Pressable>

                        <OptionGrid
                          items={allergensCatalog}
                          selectedIds={noAllergies ? [] : allergenIds}
                          columns={3}
                          multi
                          onToggle={(id, selected) => {
                            if (selected && baseAllergenIds.includes(id)) {
                              setPendingConfirmation({
                                kind: 'remove-allergen',
                                allergenId: id,
                              });
                              return;
                            }
                            setNoAllergies(false);
                            setAllergenIds((prev) =>
                              prev.includes(id)
                                ? prev.filter((x) => x !== id)
                                : [...prev, id],
                            );
                          }}
                        />

                        {showAllergyWarn ? (
                          <View className="flex-row items-center gap-2.5 rounded-xl border border-[#FFE082] bg-[#FFF8E1] p-2.5">
                            <AlertTriangle size={16} color="#C08000" />
                            <Text className="flex-1 text-[12px] leading-4 text-[#7A6120]">
                              Chưa khai báo không có nghĩa là không dị ứng. Hãy kiểm tra nguyên liệu trước khi ăn.
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </View>

              {error ? (
                <Text className="mt-2 text-center text-[13px] text-destructive">{error}</Text>
              ) : null}
            </ScrollView>
          )}
        </DrawerContent>

        <DrawerFooter className="px-4 pt-2">
          {dirty ? (
            <>
              <Text className="mb-1.5 text-center text-xs text-[#747474]">
                Thay đổi sẽ lưu vào hồ sơ của bạn
              </Text>
              <View className="flex-row gap-2.5">
                <Button
                  variant="outline"
                  disabled={saving}
                  onPress={resetDraft}
                  className="h-[50px] flex-1 rounded-[22px] border-[1.5px] border-[#EAE4D6] bg-white"
                >
                  <Text className="font-bold text-[#161616]">Huỷ thay đổi</Text>
                </Button>
                <Button
                  disabled={saving}
                  onPress={() => void save()}
                  className="h-[50px] flex-[1.2] rounded-[22px] bg-[#FFC31A]"
                >
                  {saving ? (
                    <ActivityIndicator color="#161616" />
                  ) : (
                    <Text className="font-extrabold text-[#161616]">Lưu và áp dụng</Text>
                  )}
                </Button>
              </View>
            </>
          ) : (
            <Button
              onPress={onClose}
              className="h-[52px] w-full rounded-[22px] bg-[#FFC31A]"
            >
              <Text className="font-extrabold text-[#161616]">Xong</Text>
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

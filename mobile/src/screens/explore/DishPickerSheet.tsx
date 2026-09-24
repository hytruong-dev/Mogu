import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, View } from 'react-native';
import { Check, Search } from 'lucide-react-native';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '../../components/ui/drawer';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Text } from '../../components/ui/text';
import { Skeleton } from '../../components/ui/skeleton';
import { AppImage } from '../../components/ui/app-image';
import { dishesApi, type Dish } from '../../services/api/dishes';
import { resolveDishImageUrl, formatPriceK } from './utils';

const pho = require('../../assets/images/random/pho-result.jpg');

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedId?: string | null;
  onConfirm: (dish: { id: string; name: string; thumbnailUrl: string | null }) => void;
};

export function DishPickerSheet({ open, onOpenChange, selectedId, onConfirm }: Props) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Dish[]>([]);
  const [recent, setRecent] = useState<Dish[]>([]);
  const [picked, setPicked] = useState<string | null>(selectedId ?? null);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await dishesApi.search({ q: query || undefined, limit: 20 });
      setItems(res.data);
      if (!query && recent.length === 0) setRecent(res.data.slice(0, 8));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [recent.length]);

  useEffect(() => {
    if (!open) return;
    setPicked(selectedId ?? null);
    setQ('');
    void load('');
  }, [open, selectedId, load]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void load(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q, open, load]);

  const selectedDish = items.find((d) => d.id === picked) ?? recent.find((d) => d.id === picked);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} snapHeight={640}>
      <DrawerHeader className="flex-row items-center justify-between px-4">
        <DrawerClose onPress={() => onOpenChange(false)} />
        <DrawerTitle className="text-base font-extrabold text-[#161616]">Gắn món ăn</DrawerTitle>
        <View className="w-10" />
      </DrawerHeader>

      <DrawerContent className="px-4">
        <View className="mb-3 h-11 flex-row items-center gap-2 rounded-full border border-[#E8E0D2] bg-white px-3">
          <Search size={18} color="#8A8A8A" />
          <Input
            className="h-auto flex-1 border-0 bg-transparent p-0 text-[15px] shadow-none"
            placeholder="Tìm món ăn"
            value={q}
            onChangeText={setQ}
            autoCorrect={false}
          />
        </View>

        {!q.trim() && recent.length > 0 ? (
          <View className="mb-3">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-[14px] font-bold text-[#161616]">Gần đây</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {recent.map((d) => (
                <Pressable
                  key={`r-${d.id}`}
                  onPress={() => setPicked(d.id)}
                  className="mr-3 w-[72px] items-center"
                >
                  <AppImage
                    uri={resolveDishImageUrl(d)}
                    fallbackSource={pho}
                    style={{ width: 64, height: 64, borderRadius: 12 }}
                    contentFit="cover"
                  />
                  <Text className="mt-1 text-center text-[11px] font-semibold text-[#161616]" numberOfLines={1}>
                    {d.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <Text className="mb-2 text-[14px] font-bold text-[#161616]">
          {q.trim() ? 'Kết quả tìm kiếm' : 'Gợi ý'}
        </Text>

        {loading && items.length === 0 ? (
          <View className="gap-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(d) => d.id}
            style={{ maxHeight: 320 }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text className="py-8 text-center text-[#8A8A8A]">
                {loading ? 'Đang tải…' : 'Không có kết quả'}
              </Text>
            }
            renderItem={({ item }) => {
              const selected = picked === item.id;
              const price = formatPriceK(item.priceMin, item.priceMax);
              const meta = [
                item.categories?.[0]?.name ?? item.category?.name,
                item.region?.name,
                price,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <Pressable
                  onPress={() => setPicked(item.id)}
                  className="mb-2 min-h-14 flex-row items-center gap-3 rounded-2xl px-2 py-2"
                  style={{ backgroundColor: selected ? '#FFF4C7' : '#FFFFFF' }}
                >
                  <AppImage
                    uri={resolveDishImageUrl(item)}
                    fallbackSource={pho}
                    style={{ width: 52, height: 52, borderRadius: 12 }}
                    contentFit="cover"
                  />
                  <View className="flex-1">
                    <Text className="text-[15px] font-bold text-[#161616]" numberOfLines={1}>
                      {item.name}
                    </Text>
                    {meta ? (
                      <Text className="text-[12px] text-[#8A8A8A]" numberOfLines={1}>
                        {meta}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    className="h-6 w-6 items-center justify-center rounded-full border"
                    style={{
                      borderColor: selected ? '#FFD54F' : '#D6D0C4',
                      backgroundColor: selected ? '#FFD54F' : 'transparent',
                    }}
                  >
                    {selected ? <Check size={14} color="#161616" /> : null}
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </DrawerContent>

      <DrawerFooter className="flex-row gap-3 px-4 pb-6">
        <Button
          variant="secondary"
          className="h-12 flex-1 rounded-full bg-[#F0EBE0]"
          onPress={() => onOpenChange(false)}
        >
          <Text className="font-bold text-[#161616]">Hủy</Text>
        </Button>
        <Button
          className="h-12 flex-[1.4] rounded-full bg-[#FFD54F]"
          disabled={!picked}
          onPress={() => {
            if (!selectedDish) return;
            onConfirm({
              id: selectedDish.id,
              name: selectedDish.name,
              thumbnailUrl: resolveDishImageUrl(selectedDish),
            });
            onOpenChange(false);
          }}
        >
          {loading ? (
            <ActivityIndicator color="#161616" />
          ) : (
            <Text className="font-extrabold text-[#161616]">Gắn món ăn</Text>
          )}
        </Button>
      </DrawerFooter>
    </Drawer>
  );
}

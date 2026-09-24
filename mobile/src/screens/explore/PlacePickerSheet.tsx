import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { MapPin, Navigation, Search } from 'lucide-react-native';
import * as Location from 'expo-location';
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
import { placesApi, type PlaceItem } from '../../services/api/explore';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedId?: string | null;
  onConfirm: (place: PlaceItem) => void;
};

export function PlacePickerSheet({ open, onOpenChange, selectedId, onConfirm }: Props) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PlaceItem[]>([]);
  const [picked, setPicked] = useState<string | null>(selectedId ?? null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locError, setLocError] = useState('');

  const load = useCallback(
    async (query: string, loc?: { lat: number; lng: number } | null) => {
      setLoading(true);
      try {
        const res = await placesApi.search({
          q: query || undefined,
          lat: loc?.lat,
          lng: loc?.lng,
          limit: 20,
        });
        setItems(res.data);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    setPicked(selectedId ?? null);
    setQ('');
    setLocError('');
    void load('');
  }, [open, selectedId, load]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void load(q.trim(), coords), 300);
    return () => clearTimeout(t);
  }, [q, open, coords, load]);

  const useCurrentLocation = async () => {
    setLocError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocError('Bạn đã từ chối quyền vị trí. Vẫn có thể tìm bằng từ khóa.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoords(next);
      await load(q.trim(), next);
    } catch {
      setLocError('Không lấy được vị trí hiện tại.');
    }
  };

  const selected = items.find((p) => p.id === picked);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} snapHeight={620}>
      <DrawerHeader className="flex-row items-center justify-between px-4">
        <DrawerClose onPress={() => onOpenChange(false)} />
        <DrawerTitle className="text-base font-extrabold text-[#161616]">
          Thêm địa điểm
        </DrawerTitle>
        <View className="w-10" />
      </DrawerHeader>

      <DrawerContent className="px-4">
        <View className="mb-3 h-11 flex-row items-center gap-2 rounded-full border border-[#E8E0D2] bg-white px-3">
          <Search size={18} color="#8A8A8A" />
          <Input
            className="h-auto flex-1 border-0 bg-transparent p-0 text-[15px] shadow-none"
            placeholder="Tìm quán, địa điểm"
            value={q}
            onChangeText={setQ}
            autoCorrect={false}
          />
        </View>

        <Pressable
          onPress={() => void useCurrentLocation()}
          className="mb-3 min-h-12 flex-row items-center gap-2 rounded-2xl bg-[#FFF8E0] px-3"
        >
          <Navigation size={18} color="#161616" />
          <Text className="font-semibold text-[#161616]">Dùng vị trí hiện tại</Text>
        </Pressable>
        {locError ? <Text className="mb-2 text-[12px] text-[#B91C1C]">{locError}</Text> : null}

        {loading && items.length === 0 ? (
          <View className="gap-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(p) => p.id}
            style={{ maxHeight: 340 }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text className="py-8 text-center text-[#8A8A8A]">
                {loading ? 'Đang tải…' : 'Chưa có địa điểm. Thử tìm hoặc resolve tên quán.'}
              </Text>
            }
            renderItem={({ item }) => {
              const selectedRow = picked === item.id;
              return (
                <Pressable
                  onPress={() => setPicked(item.id)}
                  className="mb-2 min-h-14 flex-row items-center gap-3 rounded-2xl px-2 py-2"
                  style={{ backgroundColor: selectedRow ? '#FFF4C7' : '#FFFFFF' }}
                >
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-[#F3EFE6]">
                    <MapPin size={18} color="#161616" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[15px] font-bold text-[#161616]" numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.addressShort ? (
                      <Text className="text-[12px] text-[#8A8A8A]" numberOfLines={1}>
                        {item.addressShort}
                      </Text>
                    ) : null}
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
          onPress={async () => {
            if (selected) {
              onConfirm(selected);
              onOpenChange(false);
              return;
            }
            if (q.trim()) {
              const created = await placesApi.resolve({
                provider: 'LOCAL',
                name: q.trim(),
              });
              onConfirm(created);
              onOpenChange(false);
            }
          }}
        >
          <Text className="font-extrabold text-[#161616]">Thêm địa điểm</Text>
        </Button>
      </DrawerFooter>
    </Drawer>
  );
}

import { useEffect, useState } from 'react';
import {
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import {
  ArrowLeft,
  Crosshair,
  MapPin,
  Navigation,
  Settings2,
  Star,
} from 'lucide-react-native';
import { AppImage } from '../../components/ui/app-image';
import {
  BORDER,
  CREAM,
  GREEN_OPEN,
  INK,
  MAP_BG,
  MUTED,
  TERTIARY,
  WHITE,
  YELLOW,
  cardShadow,
} from './tokens';
import type { NearbyPlace } from './types';
import { formatDistance } from './utils';

const { height: SH } = Dimensions.get('window');
const MAP_H = Math.round(SH * 0.32);

type Props = {
  dishName: string;
  places?: NearbyPlace[];
  onBack: () => void;
};

export function NearbyPage({ dishName, places = [], onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'list' | 'map'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locStatus, setLocStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          setLocStatus('denied');
          return;
        }
        setLocStatus('granted');
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      } catch {
        if (!cancelled) setLocStatus('denied');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = places.find((p) => p.placeId === selectedId) ?? null;

  const openDirections = async () => {
    if (!selected?.directionsDeepLink) {
      if (selected?.coordinates) {
        const { lat, lng } = selected.coordinates;
        const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        await Linking.openURL(url);
      }
      return;
    }
    await Linking.openURL(selected.directionsDeepLink);
  };

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setLocStatus('granted');
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } else {
      setLocStatus('denied');
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.iconBtn} accessibilityLabel="Quay lại">
          <ArrowLeft size={22} color={INK} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Nơi bán {dishName}
        </Text>
        <Pressable style={styles.iconBtn} accessibilityLabel="Bộ lọc">
          <Settings2 size={20} color={INK} />
        </Pressable>
      </View>

      {locStatus === 'denied' ? (
        <Pressable onPress={() => void requestLocation()} style={styles.banner}>
          <Text style={styles.bannerText}>Bật vị trí để xem khoảng cách</Text>
        </Pressable>
      ) : null}

      <View style={[styles.map, mode === 'map' && { height: Math.round(SH * 0.52) }]}>
        <View style={styles.mapInner}>
          {coords ? <View style={styles.userDot} /> : null}
          {places.length === 0 ? (
            <>
              <MapPin size={28} color={YELLOW} />
              <Text style={styles.mapHint}>Chưa có dữ liệu bản đồ cho món này</Text>
            </>
          ) : (
            places.slice(0, 5).map((p, i) => (
              <Pressable
                key={p.placeId}
                onPress={() => setSelectedId(p.placeId)}
                style={[
                  styles.pinWrap,
                  {
                    left: 36 + (i % 5) * 58,
                    top: 36 + (i % 3) * 42,
                  },
                ]}
              >
                <View
                  style={[
                    styles.pinHead,
                    selectedId === p.placeId && styles.pinHeadSelected,
                  ]}
                >
                  <Text style={styles.pinText}>{i + 1}</Text>
                </View>
                <View
                  style={[
                    styles.pinPoint,
                    selectedId === p.placeId && { borderTopColor: YELLOW },
                  ]}
                />
              </Pressable>
            ))
          )}
          {!coords && places.length > 0 ? (
            <Text style={styles.mapHint}>Đang chờ vị trí…</Text>
          ) : null}
        </View>
        {locStatus === 'granted' ? (
          <Pressable style={styles.locateBtn} onPress={() => void requestLocation()}>
            <Crosshair size={18} color={INK} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.segWrap}>
        <View style={styles.seg}>
          <Pressable
            onPress={() => setMode('list')}
            style={[styles.segBtn, mode === 'list' && styles.segActive]}
          >
            <Text style={[styles.segText, mode === 'list' && styles.segTextActive]}>
              Danh sách
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('map')}
            style={[styles.segBtn, mode === 'map' && styles.segActive]}
          >
            <Text style={[styles.segText, mode === 'map' && styles.segTextActive]}>Bản đồ</Text>
          </Pressable>
        </View>
      </View>

      {mode === 'list' ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          {places.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Chưa tìm thấy nơi bán món này gần bạn</Text>
              <Text style={styles.emptySub}>
                Khi có nguồn dữ liệu quán, danh sách sẽ hiện tại đây.
              </Text>
            </View>
          ) : (
            places.map((p, i) => {
              const isSelected = p.placeId === selectedId;
              const dist = formatDistance(p.distanceMeters);
              return (
                <Pressable
                  key={p.placeId}
                  onPress={() => setSelectedId(p.placeId)}
                  style={[styles.placeRow, isSelected && styles.placeSelected]}
                >
                  <View style={styles.placeThumb}>
                    {p.imageUrl ? (
                      <AppImage uri={p.imageUrl} style={styles.placeThumbImg} contentFit="cover" />
                    ) : (
                      <View style={[styles.placeThumbImg, styles.placeThumbPh]}>
                        <Text style={{ fontWeight: '800', color: MUTED }}>{i + 1}</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.placeName}>{p.name}</Text>
                    {p.rating != null ? (
                      <View style={styles.ratingRow}>
                        <Star size={13} color={YELLOW} fill={YELLOW} />
                        <Text style={styles.ratingText}>
                          {p.rating.toFixed(1)}
                          {p.ratingCount != null ? ` (${p.ratingCount})` : ''}
                        </Text>
                      </View>
                    ) : null}
                    <Text style={styles.placeMeta}>
                      {[dist, p.priceRange].filter(Boolean).join(' · ') || '—'}
                    </Text>
                    {p.openStatus === 'OPEN' ? (
                      <Text style={styles.open}>Đang mở</Text>
                    ) : p.openStatus === 'CLOSED' ? (
                      <Text style={styles.closed}>Đã đóng</Text>
                    ) : null}
                  </View>
                  <View style={[styles.radio, isSelected && styles.radioOn]}>
                    {isSelected ? <View style={styles.radioDot} /> : null}
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding: 16 }}>
          {selected ? (
            <View style={styles.preview}>
              <Text style={styles.placeName}>{selected.name}</Text>
              <Text style={styles.placeMeta}>
                {[formatDistance(selected.distanceMeters), selected.priceRange]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          ) : (
            <Text style={styles.emptySub}>
              Chạm một pin hoặc chuyển sang Danh sách để chọn quán.
            </Text>
          )}
        </View>
      )}

      <View style={[styles.footer, { paddingBottom: Math.max(12, insets.bottom) }]}>
        <Text style={styles.selectedLabel} numberOfLines={1}>
          {selected ? (
            <>
              Đã chọn: <Text style={styles.selectedName}>{selected.name}</Text>
            </>
          ) : (
            'Chọn một quán để chỉ đường'
          )}
        </Text>
        <Pressable
          onPress={() => void openDirections()}
          disabled={!selected}
          style={[styles.dirBtn, !selected && { opacity: 0.45 }]}
          accessibilityLabel="Chỉ đường"
        >
          <Navigation size={16} color={INK} />
          <Text style={styles.dirText}>Chỉ đường</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: INK,
    paddingHorizontal: 4,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  banner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: WHITE,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...cardShadow,
  },
  bannerText: { fontSize: 13, fontWeight: '600', color: MUTED },
  map: {
    height: MAP_H,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: MAP_BG,
  },
  mapInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  userDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3B82F6',
    borderWidth: 2,
    borderColor: WHITE,
    left: '46%',
    top: '48%',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  mapHint: {
    marginTop: 8,
    fontSize: 13,
    color: MUTED,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  pinWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  pinHead: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: INK,
  },
  pinHeadSelected: {
    backgroundColor: YELLOW,
    transform: [{ scale: 1.1 }],
  },
  pinPoint: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: YELLOW,
  },
  pinText: { fontSize: 12, fontWeight: '800', color: INK },
  locateBtn: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  segWrap: { alignItems: 'center', paddingVertical: 12 },
  seg: {
    flexDirection: 'row',
    backgroundColor: '#F0EBE0',
    borderRadius: 999,
    padding: 4,
  },
  segBtn: {
    minWidth: 110,
    minHeight: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  segActive: { backgroundColor: YELLOW },
  segText: { fontSize: 14, fontWeight: '600', color: MUTED },
  segTextActive: { color: INK, fontWeight: '800' },
  empty: { paddingVertical: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: INK, textAlign: 'center' },
  emptySub: {
    marginTop: 8,
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  placeRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    ...cardShadow,
  },
  placeSelected: { borderColor: YELLOW },
  placeThumb: { width: 56, height: 56, borderRadius: 10, overflow: 'hidden' },
  placeThumbImg: { width: 56, height: 56, borderRadius: 10 },
  placeThumbPh: { backgroundColor: '#F0EBE0', alignItems: 'center', justifyContent: 'center' },
  placeName: { fontSize: 15, fontWeight: '700', color: INK },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ratingText: { fontSize: 12, fontWeight: '600', color: MUTED },
  placeMeta: { fontSize: 12, color: TERTIARY, marginTop: 2 },
  open: { fontSize: 12, fontWeight: '700', color: GREEN_OPEN, marginTop: 2 },
  closed: { fontSize: 12, fontWeight: '600', color: MUTED, marginTop: 2 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: YELLOW },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: YELLOW },
  preview: {
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 14,
    ...cardShadow,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: CREAM,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  selectedLabel: { flex: 1, fontSize: 13, color: MUTED },
  selectedName: { fontWeight: '800', color: INK },
  dirBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: YELLOW,
    borderRadius: 14,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  dirText: { fontSize: 14, fontWeight: '800', color: INK },
});

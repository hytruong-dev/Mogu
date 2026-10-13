import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  type ImageSourcePropType,
  Linking,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Crosshair,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  ShoppingCart,
  Star,
  Utensils,
  X,
} from '@/components/icons';
import { AppImage } from '../../components/ui/app-image';
import { placesApi } from '../../services/api/places';
import { useUserLocation } from '../../hooks/useUserLocation';
import { PlaceDetailSheet } from './PlaceDetailSheet';
import { FoodMapView, MAP_BG, type FoodMapViewHandle, type MapPin as MapPinData } from './FoodMapView';
import type { NearbyPlace } from './types';
import { formatDistance } from './utils';

/* ─── Màu ─────────────────────────────────────────────────────────────── */
const SURFACE = '#FFFFFF';
const CREAM = '#FFF7E8';
const YELLOW = '#FFC928';
const YELLOW_L = '#FFF1B8';
const YELLOW_D = '#E6AC00';
const INK = '#2A1A10';
const COCOA = '#6B4A32';
const MUTED = '#91877F';
const BORDER = '#EFE6D6';
const CORAL = '#FF725E';
const SUCCESS = '#2E9D63';
const SHOPEE = '#EE4D2D';
const SHOPEE_L = '#FFF0EC';
const GOOGLE = '#1A73E8';

const { width: SW } = Dimensions.get('window');
const CARD_GAP = 10;
const CARD_W = Math.min(SW - 48, 340);
const SNAP = CARD_W + CARD_GAP;
const SHEET_H = 250;

const RADIUS_OPTIONS = [1, 3, 5] as const;
type Sort = 'near' | 'top' | 'open';
export type SourceTab = 'google' | 'shopeefood';

const SORTS: Array<{ id: Sort; label: string }> = [
  { id: 'near', label: 'Gần nhất' },
  { id: 'top', label: 'Đánh giá cao' },
  { id: 'open', label: 'Đang mở' },
];

/** Quán có trên ShopeeFood (đặt giao được). */
function isShopeePlace(p: NearbyPlace) {
  return p.provider === 'SHOPEEFOOD' || Boolean(p.sourceUrl?.includes('shopeefood'));
}

/** Quán có toạ độ → đến ăn trực tiếp, chỉ đường bằng Google Maps. */
function hasLocation(p: NearbyPlace) {
  return Boolean(p.coordinates);
}

function isHot(p: NearbyPlace) {
  const r = p.rating ?? 0;
  const n = p.ratingCount ?? 0;
  return (r >= 4.3 && n >= 50) || (r >= 4.6 && n >= 10);
}

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371e3 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function foldVi(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

function ratingScore(p: NearbyPlace) {
  return (p.rating ?? 0) * Math.log10(10 + (p.ratingCount ?? 0));
}

type Props = {
  dishId?: string;
  dishName: string;
  /** Ảnh món — dùng làm ảnh mặc định cho quán không có ảnh */
  dishImage?: ImageSourcePropType;
  places?: NearbyPlace[];
  onBack: () => void;
};

export function NearbyPage({ dishId, dishName, dishImage, places = [], onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { coords, status: locStatus, request: requestLocationPerm } = useUserLocation();

  const [placeList, setPlaceList] = useState<NearbyPlace[]>(places);
  const [tab, setTab] = useState<SourceTab>('google');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(3);
  const [sort, setSort] = useState<Sort>('near');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [listOpen, setListOpen] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [sheetH, setSheetH] = useState(SHEET_H + insets.bottom);
  const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);

  const mapRef = useRef<FoodMapViewHandle>(null);
  const listRef = useRef<FlatList<NearbyPlace>>(null);
  const center = searchCenter ?? coords;
  const isShopee = tab === 'shopeefood';

  useEffect(() => {
    if (places.length > 0) setPlaceList(places);
  }, [places]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const job = center
      ? placesApi
          .nearby({
            dishId,
            q: dishName || undefined,
            lat: center.lat,
            lng: center.lng,
            radiusKm,
            sort: 'distance',
            limit: 50,
          })
          .then((r) => r.places)
      : placesApi.search({ q: dishName, limit: 30 });
    job
      .then((items) => {
        if (cancelled) return;
        if (center || items.length > 0) setPlaceList(items);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dishId, dishName, center?.lat, center?.lng, radiusKm, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Dữ liệu hiển thị ────────────────────────────────────────────────── */
  const visible = useMemo(() => {
    const q = foldVi(query.trim());
    let list = placeList.filter(isShopee ? isShopeePlace : hasLocation);
    if (q) list = list.filter((p) => foldVi(`${p.name} ${p.address ?? ''}`).includes(q));
    if (sort === 'open') list = list.filter((p) => p.openStatus === 'OPEN');
    if (sort === 'top') {
      return list.filter((p) => p.rating != null).sort((a, b) => ratingScore(b) - ratingScore(a));
    }
    return [...list].sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
  }, [placeList, isShopee, query, sort]);

  const pins: MapPinData[] = useMemo(
    () =>
      visible
        .filter((p) => p.coordinates)
        .map((p) => ({
          placeId: p.placeId,
          lat: p.coordinates!.lat,
          lng: p.coordinates!.lng,
          name: p.name,
          label: p.rating != null ? p.rating.toFixed(1) : '',
          hot: isHot(p),
          isShopee,
        })),
    [visible, isShopee],
  );

  const showRescan =
    !!mapCenter && !!center && metersBetween(mapCenter, center) > Math.max(400, radiusKm * 1000 * 0.4);

  const emptyState = !loading && visible.length === 0;
  const sheetVisible = listOpen || emptyState;
  const topInset = insets.top + 118;
  const bottomInset = sheetVisible ? sheetH : 64 + insets.bottom + 12;

  // Đổi tab / bộ lọc → về đầu danh sách
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    setSelectedId(null);
  }, [tab, sort, query, radiusKm]);

  /* ─── Hành động ───────────────────────────────────────────────────────── */
  const openDirections = async (place: NearbyPlace) => {
    const url =
      place.directionsDeepLink ??
      (place.coordinates
        ? `https://www.google.com/maps/dir/?api=1&destination=${place.coordinates.lat},${place.coordinates.lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.address ?? ''}`)}`);
    await Linking.openURL(url).catch(() => undefined);
  };

  const openShopee = async (place: NearbyPlace) => {
    const url = place.sourceUrl || `https://shopeefood.vn/tim-kiem?q=${encodeURIComponent(place.name)}`;
    await Linking.openURL(url).catch(() => undefined);
  };

  const openSource = async (place?: NearbyPlace | null) => {
    if (place?.sourceUrl) await Linking.openURL(place.sourceUrl).catch(() => undefined);
  };

  const searchOutside = async () => {
    const q = encodeURIComponent(query.trim() || dishName);
    const url = isShopee
      ? `https://shopeefood.vn/tim-kiem?q=${q}`
      : center
        ? `https://www.google.com/maps/search/${q}/@${center.lat},${center.lng},15z`
        : `https://www.google.com/maps/search/?api=1&query=${q}`;
    await Linking.openURL(url).catch(() => undefined);
  };

  const focusPlace = useCallback(
    (place: NearbyPlace, scroll: boolean) => {
      setSelectedId(place.placeId);
      setListOpen(true);
      mapRef.current?.animateToPlace(place);
      if (scroll) {
        const index = visible.findIndex((p) => p.placeId === place.placeId);
        if (index >= 0) listRef.current?.scrollToOffset({ offset: index * SNAP, animated: true });
      }
    },
    [visible],
  );

  const handlePinPress = useCallback(
    (placeId: string) => {
      const p = visible.find((x) => x.placeId === placeId);
      if (p) focusPlace(p, true);
    },
    [visible, focusPlace],
  );

  const handleMapPress = useCallback(() => setSelectedId(null), []);

  const onCarouselEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SNAP);
    const p = visible[Math.max(0, Math.min(index, visible.length - 1))];
    if (p && p.placeId !== selectedId) {
      setSelectedId(p.placeId);
      mapRef.current?.animateToPlace(p);
    }
  };

  const recenter = () => {
    if (!coords) {
      void requestLocationPerm();
      return;
    }
    setSearchCenter(null);
    mapRef.current?.animateToUser();
  };

  const rescanHere = () => {
    if (mapCenter) {
      setSearchCenter(mapCenter);
      setSelectedId(null);
    }
  };

  /* ─── Render ──────────────────────────────────────────────────────────── */
  const renderThumb = (p: NearbyPlace) => {
    if (p.imageUrl) return <AppImage uri={p.imageUrl} style={styles.thumb} contentFit="cover" />;
    if (dishImage) {
      return (
        <View style={styles.thumb}>
          <Image source={dishImage} style={StyleSheet.absoluteFill} resizeMode="cover" />
        </View>
      );
    }
    return (
      <View style={[styles.thumb, styles.thumbPh]}>
        <Utensils size={22} color={YELLOW_D} />
      </View>
    );
  };

  const renderCard = ({ item: p }: { item: NearbyPlace }) => {
    const sel = p.placeId === selectedId;
    const dist = formatDistance(p.distanceMeters);
    const meta = [dist, p.priceRange].filter(Boolean).join('  ·  ');
    return (
      <Pressable
        onPress={() => (sel ? setDetailId(p.placeId) : focusPlace(p, true))}
        style={[styles.card, sel && (isShopee ? styles.cardSelShopee : styles.cardSel)]}
      >
        <View style={styles.cardRow}>
          {renderThumb(p)}
          <View style={styles.cardBody}>
            <Text style={styles.cardName} numberOfLines={2}>
              {p.name}
            </Text>
            <View style={styles.metaRow}>
              {p.rating != null ? (
                <View style={styles.rating}>
                  <Star size={12} color={YELLOW_D} fill={YELLOW} />
                  <Text style={styles.ratingText}>{p.rating.toFixed(1)}</Text>
                </View>
              ) : null}
              {meta ? (
                <Text style={styles.metaText} numberOfLines={1}>
                  {meta}
                </Text>
              ) : null}
              {p.openStatus === 'OPEN' ? <Text style={styles.openText}>Đang mở</Text> : null}
            </View>
            {p.address ? (
              <Text style={styles.addr} numberOfLines={1}>
                {p.address}
              </Text>
            ) : null}
          </View>
        </View>

        <Pressable
          style={[styles.cta, isShopee ? styles.ctaShopee : styles.ctaGoogle]}
          onPress={() => void (isShopee ? openShopee(p) : openDirections(p))}
          hitSlop={4}
        >
          {isShopee ? <ShoppingCart size={16} color={SURFACE} /> : <Navigation size={16} color={INK} />}
          <Text style={[styles.ctaText, isShopee && { color: SURFACE }]}>
            {isShopee ? 'Đặt trên ShopeeFood' : 'Chỉ đường'}
          </Text>
        </Pressable>
      </Pressable>
    );
  };

  const countLabel = loading
    ? 'Đang tìm quán…'
    : `${visible.length} quán${center ? ` trong ${radiusKm} km` : ''}`;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <FoodMapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        coords={coords}
        center={center}
        pins={pins}
        selectedId={selectedId}
        onSelectPlace={handlePinPress}
        onMapPress={handleMapPress}
        radiusKm={center ? radiusKm : null}
        onCenterChange={setMapCenter}
        insetTop={topInset}
        insetBottom={bottomInset}
      />

      {/* ─── Phía trên: tìm kiếm + chọn cách ăn ─────────────────────────── */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.searchRow}>
          <Pressable onPress={onBack} style={styles.iconBtn} accessibilityLabel="Quay lại">
            <ArrowLeft size={20} color={INK} />
          </Pressable>
          <View style={styles.searchBox}>
            <Search size={17} color={MUTED} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={`Tìm quán ${dishName.toLowerCase()}`}
              placeholderTextColor={MUTED}
              style={styles.searchInput}
              returnKeyType="search"
              numberOfLines={1}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8} style={styles.clearBtn}>
                <X size={12} color={SURFACE} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.segment}>
          <Pressable
            onPress={() => setTab('google')}
            style={[styles.segBtn, !isShopee && styles.segBtnActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: !isShopee }}
          >
            <MapPin size={18} color={!isShopee ? GOOGLE : MUTED} />
            <View>
              <Text style={[styles.segText, !isShopee && { color: INK }]}>Đến quán</Text>
              <Text style={styles.segHint}>Google Map</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => setTab('shopeefood')}
            style={[styles.segBtn, isShopee && styles.segBtnActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isShopee }}
          >
            <ShoppingCart size={18} color={isShopee ? SHOPEE : MUTED} />
            <View>
              <Text style={[styles.segText, isShopee && { color: INK }]}>Giao tận nơi</Text>
              <Text style={styles.segHint}>ShopeeFood</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Thông báo nổi */}
      {(locStatus === 'denied' && !coords) || (showRescan && !loading) ? (
        <View style={[styles.floatWrap, { top: topInset + 4 }]} pointerEvents="box-none">
          {locStatus === 'denied' && !coords ? (
            <Pressable style={styles.floatPill} onPress={() => void requestLocationPerm()}>
              <Crosshair size={14} color={CORAL} />
              <Text style={styles.floatText}>Bật vị trí để xem quán gần bạn</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.floatPill, { backgroundColor: INK }]} onPress={rescanHere}>
              <Search size={14} color={SURFACE} />
              <Text style={[styles.floatText, { color: SURFACE }]}>Tìm ở khu vực này</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {/* Nút về vị trí */}
      <Pressable
        style={[styles.locBtn, { bottom: bottomInset + 12 }]}
        onPress={recenter}
        accessibilityLabel="Về vị trí của tôi"
      >
        <Crosshair size={21} color={INK} />
      </Pressable>

      {/* ─── Bottom sheet ───────────────────────────────────────────────── */}
      {sheetVisible ? (
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}
          onLayout={(e) => setSheetH(Math.round(e.nativeEvent.layout.height))}
        >
          <View style={styles.handle} />

          <View style={styles.sheetHead}>
            {loading ? <ActivityIndicator size="small" color={YELLOW_D} /> : null}
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {countLabel}
            </Text>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => setReloadKey((k) => k + 1)}
              hitSlop={8}
              style={styles.headBtn}
              accessibilityLabel="Tải lại"
            >
              <RefreshCw size={16} color={COCOA} />
            </Pressable>
            {!emptyState ? (
              <Pressable onPress={() => setListOpen(false)} hitSlop={8} style={styles.headBtn} accessibilityLabel="Thu gọn">
                <ChevronDown size={18} color={COCOA} />
              </Pressable>
            ) : null}
          </View>

          {/* Bộ lọc gọn: sắp xếp | bán kính */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {SORTS.map((s) => {
              const active = sort === s.id;
              return (
                <Pressable key={s.id} onPress={() => setSort(s.id)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.label}</Text>
                </Pressable>
              );
            })}
            <View style={styles.divider} />
            {RADIUS_OPTIONS.map((r) => {
              const active = radiusKm === r;
              return (
                <Pressable key={r} onPress={() => setRadiusKm(r)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{r} km</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {emptyState ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, isShopee && { backgroundColor: SHOPEE_L }]}>
                {isShopee ? <ShoppingCart size={22} color={SHOPEE} /> : <Utensils size={22} color={YELLOW_D} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.emptyTitle}>
                  {center ? `Chưa có quán trong ${radiusKm} km` : 'Chưa có quán'}
                </Text>
                <Text style={styles.emptySub}>
                  {radiusKm < 5 ? 'Thử mở rộng bán kính' : `Thử tìm trên ${isShopee ? 'ShopeeFood' : 'Google Maps'}`}
                </Text>
                <View style={styles.emptyActions}>
                  {radiusKm < 5 ? (
                    <Pressable style={styles.ghostBtn} onPress={() => setRadiusKm(5)}>
                      <Text style={styles.ghostText}>Mở rộng 5 km</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={[styles.ghostBtn, isShopee ? styles.ctaShopee : styles.ctaGoogle, { borderWidth: 0 }]}
                    onPress={() => void searchOutside()}
                  >
                    <Text style={[styles.ghostText, isShopee && { color: SURFACE }]}>
                      {isShopee ? 'Mở ShopeeFood' : 'Mở Google Maps'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={visible}
              keyExtractor={(p) => p.placeId}
              renderItem={renderCard}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={SNAP}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: 16, gap: CARD_GAP }}
              onMomentumScrollEnd={onCarouselEnd}
              getItemLayout={(_, index) => ({ length: SNAP, offset: SNAP * index, index })}
            />
          )}
        </View>
      ) : (
        <Pressable style={[styles.showListBtn, { bottom: insets.bottom + 16 }]} onPress={() => setListOpen(true)}>
          <ChevronUp size={18} color={INK} />
          <Text style={styles.showListText}>Xem {visible.length} quán</Text>
        </Pressable>
      )}

      <PlaceDetailSheet
        placeId={detailId}
        fallback={placeList.find((p) => p.placeId === detailId) ?? null}
        coords={coords}
        onClose={() => setDetailId(null)}
        onDirections={(p) => void openDirections(p)}
        onOpenSource={(p) => void openSource(p)}
      />
    </View>
  );
}

const shadow = {
  shadowColor: '#6B4A32',
  shadowOpacity: 0.14,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 5,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MAP_BG },

  /* Phía trên */
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 12, gap: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  searchBox: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: SURFACE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    ...shadow,
  },
  searchInput: { flex: 1, color: INK, fontSize: 15, fontWeight: '600', paddingVertical: 0 },
  clearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: MUTED,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Chọn cách ăn */
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 18,
    backgroundColor: SURFACE,
    ...shadow,
  },
  segBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  segBtnActive: { backgroundColor: CREAM, borderWidth: 1, borderColor: '#F1DFB8' },
  segText: { color: MUTED, fontSize: 14, fontWeight: '800', lineHeight: 18 },
  segHint: { color: MUTED, fontSize: 11, fontWeight: '600', lineHeight: 14 },

  /* Thông báo nổi */
  floatWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  floatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: SURFACE,
    ...shadow,
  },
  floatText: { color: INK, fontSize: 13, fontWeight: '700' },

  locBtn: {
    position: 'absolute',
    right: 14,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },

  /* Bottom sheet */
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    backgroundColor: SURFACE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...shadow,
    shadowOffset: { width: 0, height: -4 },
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: BORDER, marginBottom: 8 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18 },
  sheetTitle: { color: INK, fontSize: 17, fontWeight: '800', flexShrink: 1 },
  headBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: CREAM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: { gap: 6, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  chip: {
    height: 32,
    paddingHorizontal: 13,
    borderRadius: 16,
    backgroundColor: CREAM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: INK },
  chipText: { color: COCOA, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: SURFACE },
  divider: { width: 1, height: 18, backgroundColor: BORDER, marginHorizontal: 4 },

  /* Thẻ quán */
  card: {
    width: CARD_W,
    backgroundColor: SURFACE,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1.5,
    borderColor: BORDER,
    gap: 12,
  },
  cardSel: { borderColor: YELLOW },
  cardSelShopee: { borderColor: SHOPEE },
  cardRow: { flexDirection: 'row', gap: 12 },
  thumb: { width: 68, height: 68, borderRadius: 14, overflow: 'hidden', backgroundColor: CREAM },
  thumbPh: { alignItems: 'center', justifyContent: 'center', backgroundColor: YELLOW_L },
  cardBody: { flex: 1, minWidth: 0, justifyContent: 'center' },
  cardName: { color: INK, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { color: INK, fontSize: 13, fontWeight: '800' },
  metaText: { color: COCOA, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  openText: { color: SUCCESS, fontSize: 12, fontWeight: '700' },
  addr: { color: MUTED, fontSize: 12.5, marginTop: 3 },
  cta: {
    height: 44,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaGoogle: { backgroundColor: YELLOW },
  ctaShopee: { backgroundColor: SHOPEE },
  ctaText: { color: INK, fontSize: 14.5, fontWeight: '800' },

  /* Trống */
  empty: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: CREAM,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: YELLOW_L,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { color: INK, fontSize: 15, fontWeight: '800' },
  emptySub: { color: MUTED, fontSize: 13, marginTop: 2 },
  emptyActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  ghostBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { color: INK, fontWeight: '800', fontSize: 13.5 },

  showListBtn: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 24,
    backgroundColor: YELLOW,
    ...shadow,
  },
  showListText: { color: INK, fontWeight: '800', fontSize: 15 },
});

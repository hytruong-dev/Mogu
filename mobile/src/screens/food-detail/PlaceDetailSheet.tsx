import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExternalLink, MapPin, Navigation, Star, X } from '@/components/icons';
import { AppImage } from '../../components/ui/app-image';
import { placesApi, toNearbyPlace, type PlaceDetail } from '../../services/api/places';
import { BORDER, CREAM, GREEN_OPEN, INK, MUTED, TERTIARY, WHITE, YELLOW, YELLOW_D } from './tokens';
import type { NearbyPlace } from './types';
import { formatDistance } from './utils';

const DAY_LABEL = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const PROVIDER_LABEL: Record<string, string> = {
  SHOPEEFOOD: 'ShopeeFood',
  GOOGLE: 'Google Maps',
  OSM: 'OpenStreetMap',
  LOCAL: 'Cộng đồng NOAN',
};

type Props = {
  placeId: string | null;
  /** Dữ liệu có sẵn từ danh sách — hiển thị ngay trong lúc tải chi tiết */
  fallback?: NearbyPlace | null;
  coords?: { lat: number; lng: number } | null;
  onClose: () => void;
  onDirections: (place: NearbyPlace) => void;
  onOpenSource: (place: NearbyPlace) => void;
};

function formatVnd(v: number) {
  return `${v.toLocaleString('vi-VN')}đ`;
}

export function PlaceDetailSheet({ placeId, fallback, coords, onClose, onDirections, onOpenSource }: Props) {
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!placeId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    placesApi
      .getDetail(placeId, coords)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [placeId, coords]);

  const place: NearbyPlace | null = detail ? toNearbyPlace(detail) : fallback ?? null;
  const hours = (detail?.openingHours ?? []).slice().sort((a, b) => a.day - b.day);
  const dist = formatDistance(place?.distanceMeters);
  const providerLabel = place?.provider ? PROVIDER_LABEL[place.provider] ?? place.provider : null;

  return (
    <Modal visible={!!placeId} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
        <View style={styles.handle} />
        {!place ? (
          <View style={styles.loading}>
            <ActivityIndicator color={YELLOW_D} />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            <View style={styles.headRow}>
              {place.imageUrl ? (
                <AppImage uri={place.imageUrl} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbPh]}>
                  <MapPin size={22} color={INK} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={2}>
                  {place.name}
                </Text>
                <View style={styles.metaRow}>
                  {place.rating != null ? (
                    <>
                      <Star size={13} color={YELLOW_D} fill={YELLOW_D} />
                      <Text style={styles.metaStrong}>{place.rating.toFixed(1)}</Text>
                      {place.ratingCount != null ? (
                        <Text style={styles.meta}>({place.ratingCount} đánh giá)</Text>
                      ) : null}
                    </>
                  ) : (
                    <Text style={styles.meta}>Chưa có đánh giá</Text>
                  )}
                </View>
                <Text style={styles.meta}>
                  {[dist, place.priceRange, providerLabel].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} accessibilityLabel="Đóng">
                <X size={18} color={INK} />
              </Pressable>
            </View>

            {place.openStatus === 'OPEN' ? (
              <Text style={styles.open}>Đang mở cửa</Text>
            ) : place.openStatus === 'CLOSED' ? (
              <Text style={styles.closed}>Đã đóng cửa</Text>
            ) : null}

            {place.address ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Địa chỉ</Text>
                <Text style={styles.body}>{place.address}</Text>
              </View>
            ) : null}

            {hours.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Giờ mở cửa</Text>
                <View style={styles.hoursGrid}>
                  {hours.map((h, i) => (
                    <Text key={`${h.day}-${i}`} style={styles.body}>
                      {DAY_LABEL[h.day] ?? h.day}: {h.open} – {h.close}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}

            {detail?.dishes?.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Món có bán</Text>
                {detail.dishes.slice(0, 8).map((d) => (
                  <View key={d.dishId} style={styles.dishRow}>
                    <Text style={styles.body} numberOfLines={1}>
                      {d.name}
                      {d.matchStatus === 'LIKELY' ? <Text style={styles.meta}> (có thể)</Text> : null}
                    </Text>
                    {d.priceVnd ? <Text style={styles.metaStrong}>{formatVnd(d.priceVnd)}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}

            {loading ? <ActivityIndicator style={{ marginTop: 8 }} color={YELLOW_D} /> : null}

            <View style={styles.actions}>
              <Pressable
                style={[styles.primaryBtn, !place.coordinates && { opacity: 0.45 }]}
                disabled={!place.coordinates}
                onPress={() => onDirections(place)}
                accessibilityRole="button"
              >
                <Navigation size={16} color={INK} />
                <Text style={styles.primaryText}>Chỉ đường</Text>
              </Pressable>
              {place.sourceUrl ? (
                <Pressable
                  style={styles.ghostBtn}
                  onPress={() => onOpenSource(place)}
                  accessibilityRole="button"
                >
                  <ExternalLink size={15} color={INK} />
                  <Text style={styles.ghostText}>
                    {place.provider === 'SHOPEEFOOD' ? 'Xem trên ShopeeFood' : 'Xem nguồn'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {providerLabel && place.provider !== 'LOCAL' ? (
              <Text style={styles.attribution}>Dữ liệu quán tham khảo từ {providerLabel}</Text>
            ) : null}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: CREAM,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 8,
    maxHeight: '78%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    marginBottom: 12,
  },
  loading: { paddingVertical: 40, alignItems: 'center' },
  headRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  thumb: { width: 64, height: 64, borderRadius: 12, overflow: 'hidden' },
  thumbPh: { backgroundColor: '#FFF2B8', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 17, fontWeight: '800', color: INK },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  meta: { fontSize: 12.5, color: TERTIARY, marginTop: 2 },
  metaStrong: { fontSize: 12.5, fontWeight: '800', color: INK },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  open: { marginTop: 10, fontSize: 13, fontWeight: '800', color: GREEN_OPEN },
  closed: { marginTop: 10, fontSize: 13, fontWeight: '700', color: MUTED },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: INK, marginBottom: 4 },
  body: { fontSize: 13, color: MUTED, lineHeight: 19, flexShrink: 1 },
  hoursGrid: { gap: 2 },
  dishRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  primaryBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: YELLOW,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryText: { fontSize: 14, fontWeight: '800', color: INK },
  ghostBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ghostText: { fontSize: 13.5, fontWeight: '800', color: INK },
  attribution: { marginTop: 10, fontSize: 11, color: TERTIARY, textAlign: 'center' },
});

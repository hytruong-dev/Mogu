import { useMemo, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { UtensilsCrossed } from 'lucide-react-native';
import { AppImage } from '../../components/ui/app-image';
import type { ExplorePostMedia } from '../../services/api/explore';
import { MEDIA_RADIUS, WHITE } from './tokens';

type Props = {
  media?: ExplorePostMedia[] | null;
  imageUrls?: string[] | null;
  /** Explicit page width; if omitted, measured from onLayout (multi-image only) */
  pageWidth?: number;
  aspectRatio?: number;
  borderRadius?: number;
  onPressImage?: () => void;
  style?: StyleProp<ViewStyle>;
  showCounter?: boolean;
};

function resolveUrls(media?: ExplorePostMedia[] | null, imageUrls?: string[] | null): string[] {
  const fromMedia = (media ?? [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((m) => m.url)
    .filter((u): u is string => Boolean(u && String(u).trim()));
  if (fromMedia.length) return fromMedia;
  return (imageUrls ?? []).filter((u): u is string => Boolean(u && String(u).trim()));
}

function resolveAspectRatio(
  media?: ExplorePostMedia[] | null,
  fallback = 1,
): number {
  const sorted = (media ?? [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  for (const m of sorted) {
    const w = m.width;
    const h = m.height;
    if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
      const ratio = w / h;
      return Math.min(1.91, Math.max(0.75, ratio));
    }
  }
  return fallback;
}

export function PostMediaCarousel({
  media,
  imageUrls,
  pageWidth: pageWidthProp,
  aspectRatio: aspectRatioProp,
  borderRadius = MEDIA_RADIUS,
  onPressImage,
  style,
  showCounter = true,
}: Props) {
  const urls = useMemo(() => resolveUrls(media, imageUrls), [media, imageUrls]);
  const aspectRatio = useMemo(
    () =>
      typeof aspectRatioProp === 'number'
        ? aspectRatioProp
        : resolveAspectRatio(media, 1),
    [aspectRatioProp, media],
  );
  const [index, setIndex] = useState(0);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const pageWidth = pageWidthProp ?? measuredWidth;

  if (!urls.length) return null;

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageWidth <= 0) return;
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.round(x / pageWidth);
    if (next >= 0 && next < urls.length) setIndex(next);
  };

  // Single image: không cần đo width → tránh kẹt placeholder xám
  if (urls.length === 1) {
    const img = (
      <AppImage
        uri={urls[0]}
        style={[styles.image, { width: '100%', aspectRatio, borderRadius }]}
        contentFit="cover"
        borderRadius={borderRadius}
      />
    );
    return (
      <View style={style}>
        {onPressImage ? (
          <Pressable onPress={onPressImage} accessibilityRole="button">
            {img}
          </Pressable>
        ) : (
          img
        )}
      </View>
    );
  }

  return (
    <View
      style={style}
      onLayout={(e) => {
        if (pageWidthProp) return;
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0 && w !== measuredWidth) setMeasuredWidth(w);
      }}
    >
      {pageWidth > 0 ? (
        <>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={pageWidth}
            snapToAlignment="start"
            disableIntervalMomentum
            onMomentumScrollEnd={onScrollEnd}
            onScrollEndDrag={onScrollEnd}
            style={{ width: pageWidth }}
          >
            {urls.map((uri, i) => {
              const img = (
                <AppImage
                  uri={uri}
                  style={[styles.image, { width: pageWidth, aspectRatio, borderRadius }]}
                  contentFit="cover"
                  borderRadius={borderRadius}
                />
              );
              return (
                <View key={`${uri}-${i}`} style={{ width: pageWidth }}>
                  {onPressImage ? (
                    <Pressable onPress={onPressImage} accessibilityRole="button">
                      {img}
                    </Pressable>
                  ) : (
                    img
                  )}
                </View>
              );
            })}
          </ScrollView>

          {showCounter ? (
            <View style={styles.counter} pointerEvents="none">
              <Text style={styles.counterTxt}>
                {index + 1}/{urls.length}
              </Text>
            </View>
          ) : null}

          <View style={styles.dots} pointerEvents="none">
            {urls.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        </>
      ) : (
        <View
          style={[
            styles.measuringPlaceholder,
            { aspectRatio, borderRadius },
          ]}
        >
          <UtensilsCrossed size={36} color="#D99E00" strokeWidth={1.5} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#FFF2C9',
  },
  measuringPlaceholder: {
    width: '100%',
    backgroundColor: '#FFF2C9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterTxt: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '700',
  },
  dots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: {
    backgroundColor: WHITE,
  },
});

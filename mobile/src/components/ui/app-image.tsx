import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  StyleProp,
  ImageStyle,
  ViewStyle,
  Image as RNImage,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { UtensilsCrossed } from 'lucide-react-native';

export interface AppImageProps {
  uri?: string | null;
  source?: any;
  fallbackSource?: any;
  fallbackIcon?: React.ReactNode;
  style?: StyleProp<ImageStyle | ViewStyle>;
  className?: string;
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
  transition?: number;
  priority?: 'low' | 'normal' | 'high';
  showLoader?: boolean;
  loaderColor?: string;
  borderRadius?: number;
  recyclingKey?: string;
  onLoad?: () => void;
  onError?: (err?: any) => void;
  accessibilityLabel?: string;
}

function resolveRemoteUri(uri?: string | null, source?: any): string | null {
  if (uri && typeof uri === 'string' && uri.trim()) return uri.trim();
  if (source && typeof source === 'object' && typeof source.uri === 'string' && source.uri.trim()) {
    return source.uri.trim();
  }
  return null;
}

export function AppImage({
  uri,
  source,
  fallbackSource,
  fallbackIcon,
  style,
  className,
  contentFit,
  resizeMode = 'cover',
  cachePolicy = 'memory-disk',
  transition = 200,
  priority = 'normal',
  showLoader = true,
  loaderColor = '#FFC51A',
  borderRadius,
  recyclingKey,
  onLoad,
  onError,
  accessibilityLabel,
}: AppImageProps) {
  const remoteUri = useMemo(() => resolveRemoteUri(uri, source), [uri, source]);
  const localSource = typeof source === 'number' ? source : undefined;

  const [isLoading, setIsLoading] = useState(Boolean(remoteUri));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    setIsLoading(Boolean(remoteUri));
  }, [remoteUri, localSource]);

  const fit =
    contentFit ??
    (resizeMode === 'contain'
      ? 'contain'
      : resizeMode === 'stretch'
        ? 'fill'
        : resizeMode === 'center'
          ? 'scale-down'
          : 'cover');

  const flattened = StyleSheet.flatten(style) || {};
  const radius = borderRadius ?? (flattened as any).borderRadius ?? 0;

  // Prefer remote → local source → fallback asset → icon placeholder
  const primarySource = !failed && remoteUri
    ? { uri: remoteUri }
    : !failed && localSource != null
      ? localSource
      : fallbackSource ?? null;

  if (!primarySource) {
    return (
      <View
        className={className}
        style={[
          styles.placeholder,
          style as any,
          radius ? { borderRadius: radius } : null,
        ]}
      >
        {fallbackIcon ?? <UtensilsCrossed size={36} color="#D99E00" strokeWidth={1.5} />}
      </View>
    );
  }

  return (
    <View
      className={className}
      style={[
        styles.container,
        style as any,
        radius ? { borderRadius: radius, overflow: 'hidden' } : null,
      ]}
    >
      <ExpoImage
        source={primarySource}
        style={StyleSheet.absoluteFill}
        className={className}
        contentFit={fit}
        cachePolicy={cachePolicy}
        priority={priority}
        transition={transition}
        recyclingKey={recyclingKey ?? remoteUri ?? undefined}
        placeholder={fallbackSource}
        placeholderContentFit={fit}
        accessibilityLabel={accessibilityLabel}
        onLoadStart={() => setIsLoading(true)}
        onLoad={() => {
          setIsLoading(false);
          onLoad?.();
        }}
        onError={(err) => {
          setIsLoading(false);
          // If remote fails, try fallback asset once
          if (!failed && remoteUri && fallbackSource) {
            setFailed(true);
          } else if (!failed && remoteUri) {
            // Last resort: RN Image (some Expo Go builds glitch with expo-image)
            setFailed(true);
          }
          onError?.(err);
        }}
      />

      {/* RN Image safety net when expo-image fails and we still have a remote URI + no fallback asset */}
      {failed && remoteUri && !fallbackSource ? (
        <RNImage
          source={{ uri: remoteUri }}
          style={StyleSheet.absoluteFill}
          resizeMode={resizeMode === 'stretch' ? 'stretch' : resizeMode === 'contain' ? 'contain' : 'cover'}
          onError={() => onError?.()}
          onLoad={() => {
            setIsLoading(false);
            onLoad?.();
          }}
        />
      ) : null}

      {isLoading && showLoader && remoteUri && !failed ? (
        <View style={[StyleSheet.absoluteFill, styles.loaderContainer]} pointerEvents="none">
          <ActivityIndicator size="small" color={loaderColor} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#FFF2C9',
    overflow: 'hidden',
  },
  placeholder: {
    backgroundColor: '#FFF2C9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 242, 201, 0.55)',
  },
});

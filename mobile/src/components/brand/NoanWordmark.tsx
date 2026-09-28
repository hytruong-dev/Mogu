import { Image } from 'react-native';

type Props = {
  width?: number;
  height?: number;
  accessibilityLabel?: string;
};

/**
 * Proprietary NOAN wordmark.
 * N: buffalo-hoof terminals · O: steaming bowl · A: nón lá silhouette · N: tail accent.
 */
export function NoanWordmark({
  width = 148,
  height = 52,
  accessibilityLabel = 'NOAN — Nghé Ơi, Ăn Ngon',
}: Props) {
  return (
    <Image
      source={require('../../assets/images/noan/noan-wordmark-custom-v2.png')}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      resizeMode="contain"
      style={{ width, height }}
    />
  );
}

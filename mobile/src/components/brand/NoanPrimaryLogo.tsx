import { Image, ImageProps } from 'react-native';

type Props = Omit<ImageProps, 'source'> & {
  size?: number;
  width?: number;
  height?: number;
};

/**
 * Primary NOAN Logo: Vietnamese golden water-buffalo calf wearing non la above uppercase NOAN lockup.
 * Transparent raster asset matching docs/NOAN_BRAND_DIRECTION_2026.md.
 */
export function NoanPrimaryLogo({ size = 120, width, height, style, ...props }: Props) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <Image
      source={require('../../assets/images/noan/noan-primary-logo-v1.png')}
      resizeMode="contain"
      style={[{ width: w, height: h }, style]}
      accessibilityRole="image"
      accessibilityLabel="NOAN Logo"
      {...props}
    />
  );
}

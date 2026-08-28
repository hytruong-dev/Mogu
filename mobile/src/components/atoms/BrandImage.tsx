import { Image, type ImageSourcePropType } from 'react-native';
import { cn } from '../../lib/utils';

type Props = {
  source: ImageSourcePropType;
  width: number;
  height: number;
  className?: string;
};

export function BrandImage({ source, width, height, className }: Props) {
  return (
    <Image
      source={source}
      style={{ width, height }}
      resizeMode="contain"
      className={cn(className)}
    />
  );
}

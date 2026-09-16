import { View, type ImageStyle } from 'react-native';
import { UserRound } from 'lucide-react-native';
import { Avatar, AvatarFallback, AvatarImage as RnrAvatarImage } from '../ui/avatar';
import { cn } from '../../lib/utils';

/** Shared read-only avatar display — wraps react-native-reusables Avatar. */
export function AvatarImage({
  uri,
  size,
  style,
  label = 'Ảnh đại diện',
  className,
}: {
  uri?: string | null;
  size: number;
  style?: ImageStyle;
  label?: string;
  className?: string;
}) {
  return (
    <Avatar
      alt={label}
      className={cn('overflow-hidden rounded-full', className)}
      style={[{ width: size, height: size }, style]}
    >
      {uri ? <RnrAvatarImage source={{ uri }} /> : null}
      <AvatarFallback className="bg-[#FFF0C6]">
        <View className="items-center justify-center">
          <UserRound size={size * 0.48} color="#765400" />
        </View>
      </AvatarFallback>
    </Avatar>
  );
}

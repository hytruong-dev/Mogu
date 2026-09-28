import { Image, type ImageStyle } from 'react-native';
import { Avatar, AvatarFallback, AvatarImage as RnrAvatarImage } from '../ui/avatar';
import { cn } from '../../lib/utils';
import {
  getDefaultAvatarForUser,
  getDefaultAvatar,
  getMemoryDefaultAvatarKey,
} from '../../theme/default-avatars';

/** Shared read-only avatar display — wraps react-native-reusables Avatar with NOAN mascot defaults. */
export function AvatarImage({
  uri,
  size,
  style,
  label = 'Ảnh đại diện',
  className,
  gender,
  seed,
  defaultAvatarId,
  isCurrentUser,
}: {
  uri?: string | null;
  size: number;
  style?: ImageStyle;
  label?: string;
  className?: string;
  gender?: string | null;
  seed?: string | number | null;
  defaultAvatarId?: string | null;
  isCurrentUser?: boolean;
}) {
  const activeKey = defaultAvatarId || (isCurrentUser ? getMemoryDefaultAvatarKey() : null);
  const fallbackAvatar = activeKey
    ? (getDefaultAvatar(activeKey) ?? getDefaultAvatarForUser(gender, seed, activeKey))
    : getDefaultAvatarForUser(gender, seed);

  const hasRemoteUri = typeof uri === 'string' && uri.trim().length > 0;

  return (
    <Avatar
      alt={label}
      className={cn('overflow-hidden rounded-full bg-secondary', className)}
      style={[{ width: size, height: size }, style]}
    >
      {hasRemoteUri ? (
        <RnrAvatarImage source={{ uri }} />
      ) : (
        <Image
          source={fallbackAvatar.source}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      )}
      <AvatarFallback className="bg-secondary">
        <Image
          source={fallbackAvatar.source}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      </AvatarFallback>
    </Avatar>
  );
}

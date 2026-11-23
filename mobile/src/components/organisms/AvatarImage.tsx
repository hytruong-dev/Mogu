import { useState } from 'react';
import { Image, View, type ImageStyle } from 'react-native';
import { Avatar, AvatarFallback, AvatarImage as RnrAvatarImage } from '../ui/avatar';
import { cn } from '../../lib/utils';
import {
  getDefaultAvatarForUser,
  getDefaultAvatar,
  getMemoryDefaultAvatarKey,
  getAdminAvatar,
} from '../../theme/default-avatars';
import { normalizeImageUrl } from '../../services/api/randomization';

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
  const [hasError, setHasError] = useState(false);

  // 1. Check if this is an official NOAN Admin account avatar
  const adminAvatar = getAdminAvatar(uri, seed ?? label);
  if (adminAvatar) {
    return (
      <View
        accessibilityLabel={label}
        className={cn('overflow-hidden rounded-full bg-secondary aspect-square', className)}
        style={[{ width: size, height: size, aspectRatio: 1 }, style]}
      >
        <Image
          source={adminAvatar.source}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      </View>
    );
  }

  // 2. Normalization: resolve relative paths (/avatars/..., /storage/...)
  const normalized = normalizeImageUrl(uri);
  const isNetworkUri =
    typeof normalized === 'string' &&
    (normalized.startsWith('http://') || normalized.startsWith('https://'));

  const activeKey = defaultAvatarId || (isCurrentUser ? getMemoryDefaultAvatarKey() : null);
  const fallbackAvatar = activeKey
    ? (getDefaultAvatar(activeKey) ?? getDefaultAvatarForUser(gender, seed, activeKey))
    : getDefaultAvatarForUser(gender, seed);

  return (
    <Avatar
      alt={label}
      className={cn('overflow-hidden rounded-full bg-secondary', className)}
      style={[{ width: size, height: size }, style]}
    >
      {isNetworkUri && !hasError ? (
        <RnrAvatarImage
          source={{ uri: normalized }}
          onError={() => setHasError(true)}
        />
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

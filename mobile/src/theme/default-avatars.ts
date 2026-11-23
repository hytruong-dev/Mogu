import type { ImageSourcePropType } from 'react-native';

export type DefaultAvatarGender = 'male' | 'female';

export type DefaultAvatar = {
  id: string;
  gender: DefaultAvatarGender;
  label: string;
  source: ImageSourcePropType;
};

/**
 * Persist only `id` in the user profile (for example `male_active`).
 * The bundled image source stays an implementation detail of the mobile app.
 */
export const defaultAvatars: readonly DefaultAvatar[] = [
  {
    id: 'male_calm',
    gender: 'male',
    label: 'Điềm tĩnh',
    source: require('../assets/images/noan/avatars/noan-avatar-male-calm-v1.png'),
  },
  {
    id: 'male_active',
    gender: 'male',
    label: 'Năng động',
    source: require('../assets/images/noan/avatars/noan-avatar-male-active-v1.png'),
  },
  {
    id: 'male_chef',
    gender: 'male',
    label: 'Đầu bếp',
    source: require('../assets/images/noan/avatars/noan-avatar-male-chef-v1.png'),
  },
  {
    id: 'male_scholar',
    gender: 'male',
    label: 'Học giả',
    source: require('../assets/images/noan/avatars/noan-avatar-male-scholar-v1.png'),
  },
  {
    id: 'male_adventure',
    gender: 'male',
    label: 'Phiêu lưu',
    source: require('../assets/images/noan/avatars/noan-avatar-male-adventure-v1.png'),
  },
  {
    id: 'female_gentle',
    gender: 'female',
    label: 'Dịu dàng',
    source: require('../assets/images/noan/avatars/noan-avatar-female-gentle-v1.png'),
  },
  {
    id: 'female_active',
    gender: 'female',
    label: 'Năng động',
    source: require('../assets/images/noan/avatars/noan-avatar-female-active-v1.png'),
  },
  {
    id: 'female_chef',
    gender: 'female',
    label: 'Đầu bếp',
    source: require('../assets/images/noan/avatars/noan-avatar-female-chef-v1.png'),
  },
  {
    id: 'female_creative',
    gender: 'female',
    label: 'Sáng tạo',
    source: require('../assets/images/noan/avatars/noan-avatar-female-creative-v1.png'),
  },
  {
    id: 'female_elegant',
    gender: 'female',
    label: 'Thanh lịch',
    source: require('../assets/images/noan/avatars/noan-avatar-female-elegant-v1.png'),
  },
] as const;

/** Bundled high-resolution mascot avatars for official NOAN administrative staff accounts */
export const adminAvatars = {
  content: {
    id: 'admin_noan_content',
    gender: 'male' as const,
    label: 'NOAN Content Admin',
    source: require('../assets/images/noan/admin-avatars/admin-noan-content.png'),
  },
  reviewer: {
    id: 'admin_noan_reviewer',
    gender: 'male' as const,
    label: 'NOAN Reviewer',
    source: require('../assets/images/noan/admin-avatars/admin-noan-reviewer.png'),
  },
  studiomaster: {
    id: 'admin_noan_studiomaster',
    gender: 'male' as const,
    label: 'NOAN Studio Master',
    source: require('../assets/images/noan/admin-avatars/admin-noan-studiomaster.png'),
  },
  superadmin: {
    id: 'admin_noan_superadmin',
    gender: 'male' as const,
    label: 'NOAN Super Admin',
    source: require('../assets/images/noan/admin-avatars/admin-noan-superadmin.png'),
  },
  classic: {
    id: 'admin_superadmin_classic',
    gender: 'male' as const,
    label: 'Super Admin',
    source: require('../assets/images/noan/admin-avatars/admin-superadmin-classic.png'),
  },
};

/** Detects if an avatar URI or author name/seed matches an official NOAN Admin account */
export function getAdminAvatar(
  uri?: string | null,
  seedOrName?: string | number | null
): DefaultAvatar | null {
  const u = (uri || '').toLowerCase();
  const s = String(seedOrName || '').toLowerCase();

  if (
    u.includes('admin-noan-content') ||
    s.includes('content admin') ||
    s === 'noan content' ||
    s === 'content@noan.vn'
  ) {
    return adminAvatars.content;
  }
  if (
    u.includes('admin-noan-reviewer') ||
    s.includes('reviewer') ||
    s === 'noan reviewer' ||
    s === 'reviewer@noan.vn'
  ) {
    return adminAvatars.reviewer;
  }
  if (
    u.includes('admin-noan-studiomaster') ||
    s.includes('studio master') ||
    s === 'admin' ||
    s === 'admin@noan.vn'
  ) {
    return adminAvatars.studiomaster;
  }
  if (
    u.includes('admin-noan-superadmin') ||
    s.includes('noan super admin') ||
    s === 'superadmin@noan.vn'
  ) {
    return adminAvatars.superadmin;
  }
  if (
    u.includes('admin-superadmin-classic') ||
    s === 'super admin' ||
    s === 'superadmin'
  ) {
    return adminAvatars.classic;
  }
  return null;
}

export function getDefaultAvatar(id?: string | null) {
  return defaultAvatars.find((avatar) => avatar.id === id) ?? null;
}

export const maleAvatars = defaultAvatars.filter((a) => a.gender === 'male');
export const femaleAvatars = defaultAvatars.filter((a) => a.gender === 'female');

export function normalizeGender(gender?: string | null): DefaultAvatarGender | null {
  if (!gender) return null;
  const g = gender.toLowerCase().trim();
  if (g === 'male' || g === 'nam' || g === 'm') return 'male';
  if (g === 'female' || g === 'nu' || g === 'nữ' || g === 'f') return 'female';
  return null;
}

export function getAvatarsByGender(gender?: string | null): readonly DefaultAvatar[] {
  const norm = normalizeGender(gender);
  if (norm === 'male') return maleAvatars;
  if (norm === 'female') return femaleAvatars;
  return defaultAvatars;
}

function hashSeed(seed: string | number): number {
  const str = String(seed);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Returns a purely random default avatar for a given gender:
 * - Male -> 1 of the 5 male avatars
 * - Female -> 1 of the 5 female avatars
 * - Other/Unknown -> 1 of the 10 avatars
 */
export function getRandomAvatar(gender?: string | null): DefaultAvatar {
  const pool = getAvatarsByGender(gender);
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

let memoryDefaultAvatarKey: string | null = null;

export function getMemoryDefaultAvatarKey(): string | null {
  return memoryDefaultAvatarKey;
}

export function setMemoryDefaultAvatarKey(key: string | null): void {
  memoryDefaultAvatarKey = key;
}

/**
 * Returns a default avatar for a user:
 * - If explicitKey is provided and valid, returns that avatar.
 * - If seed (e.g. userId, username, displayName) is provided, hashes it so the user
 *   consistently receives the same avatar across app re-renders.
 * - If no seed is provided, picks a random avatar matching the gender.
 */
export function getDefaultAvatarForUser(
  gender?: string | null,
  seed?: string | number | null,
  explicitKey?: string | null
): DefaultAvatar {
  const keyToUse = explicitKey || (!seed ? memoryDefaultAvatarKey : null);
  if (keyToUse) {
    const found = getDefaultAvatar(keyToUse);
    if (found) return found;
  }

  const pool = getAvatarsByGender(gender);

  if (seed != null && seed !== '') {
    const index = hashSeed(seed) % pool.length;
    return pool[index];
  }

  return getRandomAvatar(gender);
}


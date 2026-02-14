import type { AnimationConfig, AvatarConfig } from '../types';

/** Returns animations available for the given avatar (by animations.available). If not set, returns all. */
export function getAvailableAnimationsForAvatar(animations: readonly AnimationConfig[], avatar: AvatarConfig | undefined): AnimationConfig[] {
  if (!avatar?.animations?.available?.length) {
    return [...animations];
  }

  const idSet = new Set(avatar.animations.available);
  return animations.filter((a) => idSet.has(a.id));
}

export function findAvatarById(avatars: readonly AvatarConfig[], id: string): AvatarConfig | undefined {
  return avatars.find((a) => a.id === id);
}

export function getDefaultAvatarId(avatars: readonly AvatarConfig[]): string {
  return avatars[0]?.id ?? '';
}

import { isTtsConfigured } from '../lib/tts';
import { getConfigStore } from '../stores/config.store';
import type { AvatarConfig } from '../types';
import { getTtsConfigForAvatar } from './tts.service';

export function getAvatars(): readonly AvatarConfig[] {
  return getConfigStore().avatars;
}

export function getAvatarById(id: string): AvatarConfig | undefined {
  return getConfigStore().avatars.find((a) => a.id === id);
}

export function getPublicAvatars(): AvatarConfig[] {
  return getConfigStore().avatars.map((avatar) => {
    const { id, name, outfits, animations, speechRecognition, scene } = avatar;
    return {
      id,
      name,
      outfits,
      ...(animations && { animations }),
      ...(speechRecognition && { speechRecognition }),
      ...(scene && { scene }),
      hasTts: isTtsConfigured(getTtsConfigForAvatar(avatar)),
    };
  });
}

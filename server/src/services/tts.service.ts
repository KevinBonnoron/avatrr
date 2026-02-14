import { getConfigStore } from '../stores/config.store';
import type { AvatarConfig, TtsConfig } from '../types';

export function getTtsConfigForAvatar(avatar: AvatarConfig): TtsConfig | undefined {
  const ref = avatar.tts?.ref;
  if (!ref) {
    return undefined;
  }

  const base = getConfigStore().ttsConfigs.get(ref);
  if (!base) {
    return undefined;
  }

  const avatarOpts = avatar.tts?.overrides;
  if (!avatarOpts) {
    return base;
  }

  // Merge avatar-level overrides into the base config
  return {
    ...base,
    options: {
      ...base.options,
      ...(avatarOpts.voice != null && { voice: avatarOpts.voice }),
      ...(avatarOpts.model != null && { model: avatarOpts.model }),
      ...(avatarOpts.speed != null && { speed: avatarOpts.speed }),
    },
  } as TtsConfig;
}

import { getConfigStore } from '../stores/config.store';
import type { AvatarConfig } from '../types';

export function getMemoryConfig() {
  return getConfigStore().memoryConfig;
}

/** True when global memory is configured and this avatar has memory enabled (default true, set avatar.llm.memory: false to disable). */
export function isMemoryEnabledForAvatar(avatar: AvatarConfig): boolean {
  return getConfigStore().memoryConfig != null && avatar.llm?.memory !== false;
}

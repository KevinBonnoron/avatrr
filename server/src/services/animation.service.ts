import { getConfigStore } from '../stores/config.store';

export function getAnimations() {
  return getConfigStore().animations;
}

import { getConfigStore } from '../stores/config.store';

export function getScenes() {
  return getConfigStore().scenes;
}

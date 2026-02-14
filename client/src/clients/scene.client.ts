import type { SceneConfig } from '@avatrr/shared';
import { universalClient, withFetchDelegate, withMethods } from 'universal-client';
import { config } from '@/lib/config';

export const sceneClient = universalClient(
  withFetchDelegate({ baseURL: config.server.url }),
  withMethods(({ delegate }) => ({
    getScenes: () => delegate.get<SceneConfig[]>('/scenes'),
  })),
);

import type { AvatarConfig } from '@avatrr/shared';
import { universalClient, withFetchDelegate, withMethods } from 'universal-client';
import { config } from '@/lib/config';

export const avatarClient = universalClient(
  withFetchDelegate({ baseURL: `${config.server.url}` }),
  withMethods(({ delegate }) => ({
    getAvatars: () => delegate.get<AvatarConfig[]>('/avatars'),
  })),
);

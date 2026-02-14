import type { ConfigFile } from '@avatrr/shared';
import { universalClient, withFetchDelegate, withMethods } from 'universal-client';
import { config } from '@/lib/config';

export const configClient = universalClient(
  withFetchDelegate({ baseURL: config.server.url }),
  withMethods(({ delegate }) => ({
    getConfig: () => delegate.get<ConfigFile>('/config'),
    updateConfig: (body: ConfigFile) => delegate.put<{ success: boolean }>('/config', body),
  })),
);

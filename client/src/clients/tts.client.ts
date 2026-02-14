import { universalClient, withFetchDelegate, withMethods } from 'universal-client';
import { config } from '@/lib/config';

export const ttsClient = universalClient(
  withFetchDelegate({ baseURL: config.server.url }),
  withMethods(({ delegate }) => ({
    testTts: (entry: Record<string, unknown>) => delegate.post<{ ok: boolean; message?: string }>('/tts/test', entry),
    getSuggestions: (type: string) => delegate.get<{ models: string[]; voices: string[] }>(`/tts/suggestions?type=${encodeURIComponent(type)}`),
    getVoices: (type: string, opts?: { baseUrl?: string; apiKey?: string }) => {
      const params = new URLSearchParams({ type });
      if (opts?.baseUrl) {
        params.set('baseUrl', opts.baseUrl);
      }
      if (opts?.apiKey) {
        params.set('apiKey', opts.apiKey);
      }
      return delegate.get<{ value: string; label: string }[]>(`/tts/voices?${params}`);
    },
  })),
);

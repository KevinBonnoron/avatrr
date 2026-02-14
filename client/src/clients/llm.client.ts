import { universalClient, withFetchDelegate, withMethods } from 'universal-client';
import { config } from '@/lib/config';

export const llmClient = universalClient(
  withFetchDelegate({ baseURL: config.server.url }),
  withMethods(({ delegate }) => ({
    getLlmModels: (name: string) => delegate.get<string[]>(`/llm/${name}/models`),
    fetchModels: (entry: Record<string, unknown>) => delegate.post<string[]>('/llm/models', entry),
    testLlm: (entry: Record<string, unknown>) => delegate.post<{ ok: boolean; message?: string }>('/llm/test', entry),
  })),
);

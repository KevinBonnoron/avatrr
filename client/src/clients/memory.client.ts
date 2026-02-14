import type { MemoryEntry } from '@avatrr/shared';
import { universalClient, withFetchDelegate, withMethods } from 'universal-client';
import { config } from '@/lib/config';

export const memoryClient = universalClient(
  withFetchDelegate({ baseURL: config.server.url }),
  withMethods(({ delegate }) => ({
    getMemoryStatus: () => delegate.get<{ enabled: boolean }>('/memory/status'),
    getAllMemories: () => delegate.get<MemoryEntry[]>('/memory/all'),
    getMemories: (avatarId: string) => delegate.get<MemoryEntry[]>(`/memory/${avatarId}`),
    deleteMemory: (id: number) => delegate.delete<{ success: boolean }>(`/memory/${id}`),
    deleteAllMemories: (avatarId: string) => delegate.delete<{ success: boolean; deleted: number }>(`/memory/avatar/${avatarId}`),
    updateMemory: (id: number, text: string) => delegate.put<{ success: boolean }>(`/memory/${id}`, { text }),
  })),
);

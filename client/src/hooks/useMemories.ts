import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { memoryClient } from '@/clients/memory.client';

export function useMemoryStatus() {
  return useQuery({
    queryKey: ['memory', 'status'],
    queryFn: () => memoryClient.getMemoryStatus(),
    initialData: { enabled: false },
  });
}

export function useAllMemories() {
  return useQuery({
    queryKey: ['memory', 'all'],
    queryFn: () => memoryClient.getAllMemories(),
  });
}

export function useDeleteMemory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => memoryClient.deleteMemory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memory'] });
    },
  });
}

export function useDeleteAllMemories() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (avatarId: string) => memoryClient.deleteAllMemories(avatarId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memory'] });
    },
  });
}

export function useUpdateMemory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: number; text: string }) => memoryClient.updateMemory(id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memory'] });
    },
  });
}

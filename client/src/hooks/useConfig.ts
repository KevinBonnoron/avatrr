import type { ConfigFile } from '@avatrr/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configClient } from '@/clients/config.client';

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => configClient.getConfig(),
  });
}

export function useUpdateConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: ConfigFile) => configClient.updateConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['avatars'] });
      queryClient.invalidateQueries({ queryKey: ['animations'] });
      queryClient.invalidateQueries({ queryKey: ['memory'] });
    },
  });
}

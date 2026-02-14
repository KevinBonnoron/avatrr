import { useQuery } from '@tanstack/react-query';
import { sceneClient } from '@/clients/scene.client';

export function useScenes() {
  return useQuery({
    queryKey: ['scenes'],
    queryFn: () => sceneClient.getScenes(),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

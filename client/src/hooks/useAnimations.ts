import { useQuery } from '@tanstack/react-query';
import { animationClient } from '@/clients/animation.client';

export function useAnimations() {
  return useQuery({
    queryKey: ['animations'],
    queryFn: () => animationClient.getAnimations(),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

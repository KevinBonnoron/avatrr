import { useQuery } from '@tanstack/react-query';
import { avatarClient } from '@/clients/avatar.client';

export function useAvatars() {
  return useQuery({
    queryKey: ['avatars'],
    queryFn: () => avatarClient.getAvatars(),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

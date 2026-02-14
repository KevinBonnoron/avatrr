import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { conversationsClient } from '@/clients/conversations.client';

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => conversationsClient.getConversations(),
    refetchInterval: 10_000,
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ['conversations', id],
    queryFn: () => conversationsClient.getConversation(id as string),
    enabled: id != null,
  });
}

export function useDeleteAllConversationsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => conversationsClient.deleteAllConversations(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useDeleteConversationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => conversationsClient.deleteConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useUpdateMessageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, text }: { messageId: number; text: string }) => conversationsClient.updateMessage(messageId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

import type { ConversationMessage, ConversationSummary } from '@avatrr/shared';
import { universalClient, withFetchDelegate, withMethods } from 'universal-client';
import { config } from '@/lib/config';

export const conversationsClient = universalClient(
  withFetchDelegate({ baseURL: config.server.url }),
  withMethods(({ delegate }) => ({
    getConversations: () => delegate.get<ConversationSummary[]>('/conversations'),
    getConversation: (id: string) => delegate.get<ConversationMessage[]>(`/conversations/${id}`),
    deleteAllConversations: () => delegate.delete<{ success: boolean }>('/conversations'),
    deleteConversation: (id: string) => delegate.delete<{ success: boolean }>(`/conversations/${id}`),
    updateMessage: (messageId: number, text: string) => delegate.put<{ success: boolean }>(`/conversations/messages/${messageId}`, { text }),
  })),
);

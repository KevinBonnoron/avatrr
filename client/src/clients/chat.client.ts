import { universalClient, withMethods, withSseDelegate } from 'universal-client';
import { config } from '@/lib/config';

const baseURL = config.server.url;

export interface SendChatBody {
  message: string;
  conversationId?: string;
  avatarId?: string;
  images?: Array<{ data: string; mimeType?: string }>;
}

export const chatClient = universalClient(
  withSseDelegate({ baseURL: `${baseURL}/chat`, name: 'sse' }),
  withMethods(({ sse }) => ({
    onMessage(callback: (data: unknown) => void): () => void {
      return sse.onMessage(callback);
    },
    onError(callback: (event: Event) => void): () => void {
      return sse.onError(callback);
    },
    sendChat(body: SendChatBody): () => void {
      sse.open({ method: 'POST', body });
      return () => sse.close();
    },
  })),
);

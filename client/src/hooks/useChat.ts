import type { StreamChunk } from '@avatrr/shared';
import { useCallback, useRef, useState } from 'react';
import { chatClient, type SendChatBody } from '@/clients/chat.client';
import { useOnMountUnsafe } from './useOnMountUnsafe';

function newConversationId(): string {
  return crypto.randomUUID();
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  parts: Array<{ type: string; content?: string; data?: string; mimeType?: string }>;
}

export interface UseChatOptions {
  /** Extra body fields for each request (e.g. { avatarId }). */
  getBody?: () => Record<string, unknown>;
  /** Called for each stream chunk (expression, tts_audio, etc.). */
  onChunk?: (chunk: StreamChunk) => void;
}

export interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (text: string, images?: Array<{ data: string; mimeType?: string }>) => void;
  isLoading: boolean;
  status: 'idle' | 'streaming' | 'error';
  clear: () => void;
}

function parseChunk(data: unknown): StreamChunk | null {
  if (typeof data !== 'string') {
    return null;
  }
  try {
    return JSON.parse(data) as StreamChunk;
  } catch {
    return null;
  }
}

export function useChat({ getBody = () => ({}), onChunk }: UseChatOptions): UseChatReturn {
  const [conversationId, setConversationId] = useState<string>(newConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<'idle' | 'streaming' | 'error'>('idle');
  const closeRef = useRef<(() => void) | null>(null);
  const dispatchRef = useRef({ setMessages, setStatus, setConversationId, onChunk });
  dispatchRef.current = { setMessages, setStatus, setConversationId, onChunk };

  useOnMountUnsafe(() => {
    const unsubMessage = chatClient.onMessage((data: unknown) => {
      const chunk = parseChunk(data);
      if (!chunk) {
        return;
      }

      const { setMessages: setM, setStatus: setS, setConversationId: setCid, onChunk: oc } = dispatchRef.current;
      oc?.(chunk);
      if (chunk.type === 'STREAM_START' && 'conversationId' in chunk && typeof chunk.conversationId === 'string') {
        setCid(chunk.conversationId);
      }
      if (chunk.type === 'TEXT') {
        const delta = chunk.delta;
        setM((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant' && last.parts[0]) {
            next[next.length - 1] = {
              ...last,
              parts: [{ type: 'text', content: (last.parts[0].content ?? '') + delta }],
            };
          }
          return next;
        });
      }
      if (chunk.type === 'STREAM_END' || chunk.type === 'STREAM_ERROR') {
        setS('idle');
      }
    });

    const unsubError = chatClient.onError(() => {
      dispatchRef.current.setStatus('error');
    });

    return () => {
      unsubMessage();
      unsubError();
    };
  });

  const sendMessage = useCallback(
    (text: string, images?: Array<{ data: string; mimeType?: string }>) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      const userParts: ChatMessage['parts'] = [{ type: 'text', content: trimmed }];
      if (images?.length) {
        for (const img of images) {
          userParts.push({ type: 'image', data: img.data, mimeType: img.mimeType });
        }
      }

      const userMessage: ChatMessage = { role: 'user', parts: userParts };
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        parts: [{ type: 'text', content: '' }],
      };
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setStatus('streaming');

      closeRef.current?.();
      const body: SendChatBody = {
        message: trimmed,
        conversationId,
        ...(images?.length ? { images } : {}),
        ...getBody(),
      };
      const close = chatClient.sendChat(body);
      closeRef.current = close;
    },
    [getBody, conversationId],
  );

  const clear = useCallback(() => {
    closeRef.current?.();
    closeRef.current = null;
    setConversationId(newConversationId());
    setMessages([]);
    setStatus('idle');
  }, []);

  return {
    messages,
    sendMessage,
    isLoading: status === 'streaming',
    status,
    clear,
  };
}

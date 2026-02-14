import type { ChatRequestMessage } from '@avatrr/shared';

/** Options for sending a chat request through the LLM channel. */
export interface ChannelSendOptions {
  messages?: ChatRequestMessage[];
  conversationId?: string;
  systemPrompt?: string;
  signal?: AbortSignal;
}

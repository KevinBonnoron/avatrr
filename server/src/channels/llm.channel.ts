import type { ChatRequestMessage, StreamChunk } from '@avatrr/shared';
import type { ModelMessage } from 'ai';
import { streamText } from 'ai';
import { createLanguageModel } from '../lib/ai-provider';
import { getResolvedLlmConfigForAvatar } from '../services';
import type { AvatarConfig, ChannelSendOptions } from '../types';
import type { RawToken } from '../utils/chat-stream-parser';
import { parseChatStream } from '../utils/chat-stream-parser';
import { getMessageContent, isAbortError } from '../utils/message.utils';

function toAiSdkMessages(messages: ChatRequestMessage[]): ModelMessage[] {
  const result: ModelMessage[] = [];
  for (const msg of messages) {
    const role = msg.role === 'tool' ? 'user' : msg.role;
    if (role !== 'user' && role !== 'assistant') {
      continue;
    }

    const hasImages = role === 'user' && msg.parts?.some((p) => p.type === 'image');
    if (hasImages) {
      const content: Array<{ type: 'text'; text: string } | { type: 'image'; image: string; mimeType?: string }> = [];
      for (const part of msg.parts ?? []) {
        if (part.type === 'text' && 'content' in part && part.content) {
          content.push({ type: 'text', text: part.content });
        } else if (part.type === 'image' && 'data' in part) {
          content.push({ type: 'image', image: (part as { data: string }).data, mimeType: (part as { mimeType?: string }).mimeType });
        }
      }
      if (content.length > 0) {
        result.push({ role: 'user', content });
      }
    } else {
      const content = getMessageContent(msg);
      if (content) {
        result.push({ role, content });
      }
    }
  }
  return result;
}

/**
 * Single entry point for sending chat requests. Uses Vercel AI SDK streamText()
 * with the appropriate provider resolved from config.
 */
export class LlmChannel {
  public constructor(private readonly avatar: AvatarConfig) {}

  public async *send(options: ChannelSendOptions): AsyncIterable<StreamChunk> {
    const { messages, systemPrompt, signal } = options;
    if (!messages?.length) {
      yield {
        type: 'STREAM_ERROR',
        timestamp: Date.now(),
        error: { message: 'LLM channel requires messages', code: 'INVALID_OPTIONS' },
      };
      return;
    }

    const config = getResolvedLlmConfigForAvatar(this.avatar);
    const model = createLanguageModel(config);
    const sdkMessages = toAiSdkMessages(messages);

    try {
      yield* parseChatStream(this.toRawTokenStream(model, sdkMessages, systemPrompt, config.options.maxTokens, signal));
    } catch (err) {
      if (isAbortError(err)) {
        return;
      }

      yield {
        type: 'STREAM_ERROR',
        timestamp: Date.now(),
        error: {
          message: err instanceof Error ? err.message : 'LLM stream failed',
          code: 'STREAM_ERROR',
        },
      };
    }
  }

  private async *toRawTokenStream(
    model: ReturnType<typeof createLanguageModel>,
    messages: ModelMessage[],
    systemPrompt: string | undefined,
    maxTokens: number | undefined,
    signal: AbortSignal | undefined,
  ): AsyncGenerator<RawToken> {
    const result = streamText({
      model,
      system: systemPrompt?.trim() || undefined,
      messages,
      maxOutputTokens: maxTokens,
      abortSignal: signal,
    });

    for await (const delta of result.textStream) {
      yield { token: delta };
    }
    yield { token: '', done: true };
  }
}

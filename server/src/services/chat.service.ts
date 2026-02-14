import type { ChatMessagePart, ChatRequestMessage, Expression, StreamChunk } from '@avatrr/shared';
import { LlmChannel } from '../channels';
import { embed } from '../lib/embedding';
import { logger } from '../lib/logger';
import { addMemory, getSystemMemory, initMemory, SYSTEM_MEMORY_PREFIX, searchMemories, searchMemoriesByKeywords } from '../lib/memory';
import { buildSynthesizeFn, isTtsConfigured } from '../lib/tts';
import { appendToConversation, createConversationId, getConversation, getConversationMood, updateConversationMood } from '../stores';
import { withTtsEvents } from '../utils';
import { getAvatarById, getAvatars } from './avatar.service';
import { getEffectiveLlmOptions } from './llm.service';
import { getMemoryConfig, isMemoryEnabledForAvatar } from './memory.service';
import { getTtsConfigForAvatar } from './tts.service';

export interface ChatStreamParams {
  message: string;
  avatarId: string;
  conversationId?: string;
  signal?: AbortSignal;
  images?: Array<{ data: string; mimeType?: string }>;
}

async function enrichPromptWithMemories(systemPrompt: string, avatarId: string, lastUserContent: string, memoryEnabled: boolean): Promise<string> {
  if (!memoryEnabled || !lastUserContent) {
    return systemPrompt;
  }

  const memoryConfig = getMemoryConfig();
  if (!memoryConfig) {
    return systemPrompt;
  }

  try {
    let systemMemoryText = getSystemMemory(avatarId);
    if (!systemMemoryText) {
      const vector = await embed(systemPrompt, { model: memoryConfig.embeddingModel, llmName: memoryConfig.llmName });
      addMemory(avatarId, SYSTEM_MEMORY_PREFIX + systemPrompt, vector);
      systemMemoryText = systemPrompt;
    }

    const queryEmbedding = await embed(lastUserContent, { model: memoryConfig.embeddingModel, llmName: memoryConfig.llmName });
    const vectorMemories = searchMemories(avatarId, queryEmbedding, memoryConfig.topK + 5)
      .filter((m) => !m.text.startsWith(SYSTEM_MEMORY_PREFIX))
      .slice(0, memoryConfig.topK);
    const keywords = lastUserContent
      .toLowerCase()
      .replace(/\?|!|\.|,/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .slice(0, 6);
    const keywordMemories = searchMemoriesByKeywords(avatarId, keywords, memoryConfig.topK);
    const seenIds = new Set<number>();
    const memories = [...keywordMemories, ...vectorMemories]
      .filter((m) => {
        if (seenIds.has(m.id)) {
          return false;
        }
        seenIds.add(m.id);
        return !m.text.startsWith(SYSTEM_MEMORY_PREFIX);
      })
      .slice(0, memoryConfig.topK);
    const lines: string[] = [];
    if (systemMemoryText) {
      lines.push(`Character context (always apply):\n${systemMemoryText}`);
    }

    if (memories.length > 0) {
      lines.push(`Past exchanges (use when relevant):\n${memories.map((m) => `- ${m.text}`).join('\n')}`);
    }

    if (lines.length === 0) {
      return systemPrompt;
    }

    const block = lines.join('\n\n');
    return `${systemPrompt}\n\nRelevant context:\n${block}`;
  } catch (err) {
    logger.error(`[chat] Memory search failed: ${err}`);
    return systemPrompt;
  }
}

async function* streamWithMemoryStore(chatStream: AsyncIterable<StreamChunk>, avatarId: string, lastUserContent: string): AsyncIterable<StreamChunk> {
  let assistantText = '';
  for await (const chunk of chatStream) {
    if (chunk.type === 'TEXT' && typeof chunk.delta === 'string') {
      assistantText += chunk.delta;
    }
    yield chunk;
  }
  if (!lastUserContent.trim() || !assistantText.trim()) {
    return;
  }
  const memConfig = getMemoryConfig();
  if (!memConfig) {
    return;
  }
  const toStore = `User: ${lastUserContent}\nAssistant: ${assistantText.trim()}`;
  const embedOpts = { model: memConfig.embeddingModel, llmName: memConfig.llmName };
  embed(toStore, embedOpts)
    .then((v) => addMemory(avatarId, toStore, v))
    .catch((err) => {
      logger.error(`[chat] Memory store failed: ${err}`);
    });
}

function injectConversationIdIntoStream(stream: AsyncIterable<StreamChunk>, conversationId: string): AsyncIterable<StreamChunk> {
  return (async function* () {
    let injected = false;
    for await (const chunk of stream) {
      if (!injected && chunk.type === 'STREAM_START') {
        injected = true;
        yield { ...chunk, conversationId };
      } else {
        yield chunk;
      }
    }
  })();
}

async function* appendConversationAfterStream(stream: AsyncIterable<StreamChunk>, conversationId: string, messagesWithNewUser: ChatRequestMessage[], avatarId: string): AsyncIterable<StreamChunk> {
  let assistantText = '';
  for await (const chunk of stream) {
    if (chunk.type === 'TEXT' && typeof chunk.delta === 'string') {
      assistantText += chunk.delta;
    }
    yield chunk;
  }
  const userMessage = messagesWithNewUser[messagesWithNewUser.length - 1];
  if (userMessage && assistantText.trim()) {
    appendToConversation(conversationId, userMessage, avatarId);
    appendToConversation(conversationId, {
      role: 'assistant',
      parts: [{ type: 'text', content: assistantText.trim() }],
    });
  }
}

async function* withMoodTracking(stream: AsyncIterable<StreamChunk>, conversationId: string): AsyncIterable<StreamChunk> {
  let lastExpression: Expression = 'neutral';
  let streamEnded = false;
  for await (const chunk of stream) {
    if (chunk.type === 'EXPRESSION') {
      lastExpression = chunk.expression;
    }
    if (chunk.type === 'STREAM_END') {
      streamEnded = true;
    }
    yield chunk;
  }
  if (streamEnded && lastExpression !== 'neutral') {
    const { mood, intensity } = updateConversationMood(conversationId, lastExpression);
    if (mood !== 'neutral' && intensity > 0) {
      yield { type: 'MOOD', mood, intensity, timestamp: Date.now() };
    }
  }
}

/**
 * Builds the full chat stream: memories, channel, conversation append, mood tracking, memory store, TTS.
 * Caller is responsible for turning the stream into an SSE response.
 */
export async function* buildChatStream(params: ChatStreamParams): AsyncGenerator<StreamChunk> {
  const { message: rawMessage, avatarId: bodyAvatarId, conversationId: bodyConversationId, signal, images } = params;

  const avatar = (bodyAvatarId ? getAvatarById(bodyAvatarId) : null) ?? getAvatars()[0];
  if (!avatar) {
    yield {
      type: 'STREAM_ERROR',
      timestamp: Date.now(),
      error: { message: 'No avatar configured', code: 'NO_AVATAR' },
    };
    return;
  }

  const conversationId = typeof bodyConversationId === 'string' && bodyConversationId ? bodyConversationId : createConversationId();
  const injectConversationId = !bodyConversationId ? conversationId : undefined;

  const history = getConversation(conversationId) ?? [];
  const userParts: ChatMessagePart[] = [{ type: 'text', content: rawMessage }];
  if (images?.length) {
    for (const img of images) {
      userParts.push({ type: 'image', data: img.data, mimeType: img.mimeType });
    }
  }
  const userMessage: ChatRequestMessage = { role: 'user', parts: userParts };
  const messages = [...history, userMessage];

  const { systemPrompt } = getEffectiveLlmOptions(avatar);
  const lastUserContent = rawMessage;

  if (isMemoryEnabledForAvatar(avatar)) {
    const memConfigForInit = getMemoryConfig();
    if (memConfigForInit) {
      initMemory(memConfigForInit.dbPath);
    }
  }
  const memoryEnabled = isMemoryEnabledForAvatar(avatar);

  yield { type: 'CONNECTING', timestamp: Date.now() };

  // Inject persistent mood into system prompt if one exists
  let enrichedPrompt = systemPrompt;
  const currentMood = getConversationMood(conversationId);
  if (currentMood.mood !== 'neutral' && currentMood.intensity > 0) {
    const pct = Math.round(currentMood.intensity * 100);
    enrichedPrompt = `${systemPrompt}\n\nYour current emotional mood is: ${currentMood.mood} (intensity: ${pct}%). Let this subtly influence your tone.`;
  }

  const systemPromptToUse = await enrichPromptWithMemories(enrichedPrompt, avatar.id, lastUserContent, memoryEnabled);

  const channel = new LlmChannel(avatar);
  let chatStream = channel.send({
    messages,
    conversationId,
    systemPrompt: systemPromptToUse,
    signal,
  });

  if (injectConversationId) {
    chatStream = injectConversationIdIntoStream(chatStream, injectConversationId);
  }

  chatStream = appendConversationAfterStream(chatStream, conversationId, messages, avatar.id);

  chatStream = withMoodTracking(chatStream, conversationId);

  if (memoryEnabled && getMemoryConfig()) {
    chatStream = streamWithMemoryStore(chatStream, avatar.id, lastUserContent);
  }

  const ttsConfig = getTtsConfigForAvatar(avatar);
  if (isTtsConfigured(ttsConfig)) {
    const synthesize = buildSynthesizeFn(ttsConfig);
    chatStream = withTtsEvents(chatStream, synthesize);
  }

  yield* chatStream;
}

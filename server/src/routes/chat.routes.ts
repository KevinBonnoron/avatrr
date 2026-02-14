import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { buildChatStream, getAvatarById } from '../services';
import { createConversationId } from '../stores';
import { streamToSSEResponse } from '../utils';

const chatBodySchema = z.object({
  message: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, 'message is required and must be non-empty')),
  conversationId: z.string().min(1).optional(),
  avatarId: z.string(),
  images: z
    .array(
      z.object({
        data: z.string(),
        mimeType: z.string().optional(),
      }),
    )
    .optional(),
});

export const chatRoutes = new Hono().post('', zValidator('json', chatBodySchema), async (c) => {
  const { message: rawMessage, conversationId = createConversationId(), avatarId, images } = c.req.valid('json');

  const avatar = getAvatarById(avatarId);
  if (!avatar) {
    return c.json({ error: 'No avatar configured' }, 400);
  }

  const abortController = new AbortController();
  c.req.raw.signal?.addEventListener('abort', () => {
    abortController.abort();
  });

  const stream = buildChatStream({
    message: rawMessage,
    avatarId: avatar.id,
    conversationId,
    signal: c.req.raw.signal ?? undefined,
    images,
  });

  return streamToSSEResponse(stream, { abortController });
});

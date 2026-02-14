import { Hono } from 'hono';
import { deleteAllConversations, deleteConversation, getAllConversations, getConversationMessages, updateConversationMessage } from '../stores/conversation.store';

export const conversationsRoutes = new Hono()

  .get('/', (c) => {
    return c.json(getAllConversations());
  })

  .get('/:id', (c) => {
    const id = c.req.param('id');
    const messages = getConversationMessages(id);
    if (!messages) {
      return c.json({ error: 'Conversation not found' }, 404);
    }
    return c.json(messages);
  })

  .put('/messages/:messageId', async (c) => {
    const messageId = Number(c.req.param('messageId'));
    if (Number.isNaN(messageId)) {
      return c.json({ error: 'Invalid message id' }, 400);
    }
    const { text } = await c.req.json<{ text: string }>();
    if (!text?.trim()) {
      return c.json({ error: 'Text is required' }, 400);
    }
    const updated = updateConversationMessage(messageId, text.trim());
    if (!updated) {
      return c.json({ error: 'Message not found' }, 404);
    }
    return c.json({ success: true });
  })

  .delete('/', (c) => {
    const count = deleteAllConversations();
    return c.json({ success: true, count });
  })

  .delete('/:id', (c) => {
    const id = c.req.param('id');
    const deleted = deleteConversation(id);
    if (!deleted) {
      return c.json({ error: 'Conversation not found' }, 404);
    }
    return c.json({ success: true });
  });

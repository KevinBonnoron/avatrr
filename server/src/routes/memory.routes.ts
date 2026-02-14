import { Hono } from 'hono';
import { logger } from '../lib/logger';
import { deleteAllMemoriesForAvatar, deleteMemory, getAllMemories, getMemoriesForAvatar, isMemoryInitialized, updateMemoryText } from '../lib/memory';

export const memoryRoutes = new Hono()

  .get('/status', (c) => {
    return c.json({ enabled: isMemoryInitialized() });
  })

  .get('/all', (c) => {
    if (!isMemoryInitialized()) {
      return c.json({ error: 'Memory is not enabled' }, 400);
    }
    try {
      const memories = getAllMemories();
      return c.json(memories);
    } catch (err) {
      logger.error(`[memory] Failed to get all memories: ${err}`);
      return c.json({ error: 'Failed to get memories' }, 500);
    }
  })

  .get('/:avatarId', (c) => {
    if (!isMemoryInitialized()) {
      return c.json({ error: 'Memory is not enabled' }, 400);
    }
    const avatarId = c.req.param('avatarId');
    try {
      const memories = getMemoriesForAvatar(avatarId);
      return c.json(memories);
    } catch (err) {
      logger.error(`[memory] Failed to get memories: ${err}`);
      return c.json({ error: 'Failed to get memories' }, 500);
    }
  })

  .delete('/avatar/:avatarId', (c) => {
    if (!isMemoryInitialized()) {
      return c.json({ error: 'Memory is not enabled' }, 400);
    }
    const avatarId = c.req.param('avatarId');
    try {
      const count = deleteAllMemoriesForAvatar(avatarId);
      return c.json({ success: true, deleted: count });
    } catch (err) {
      logger.error(`[memory] Failed to delete all memories: ${err}`);
      return c.json({ error: 'Failed to delete memories' }, 500);
    }
  })

  .put('/:id', async (c) => {
    if (!isMemoryInitialized()) {
      return c.json({ error: 'Memory is not enabled' }, 400);
    }
    const id = Number(c.req.param('id'));
    if (Number.isNaN(id)) {
      return c.json({ error: 'Invalid memory id' }, 400);
    }
    try {
      const { text } = await c.req.json<{ text: string }>();
      if (!text?.trim()) {
        return c.json({ error: 'Text is required' }, 400);
      }
      const updated = updateMemoryText(id, text.trim());
      if (!updated) {
        return c.json({ error: 'Memory not found' }, 404);
      }
      return c.json({ success: true });
    } catch (err) {
      logger.error(`[memory] Failed to update memory: ${err}`);
      return c.json({ error: 'Failed to update memory' }, 500);
    }
  })

  .delete('/:id', (c) => {
    if (!isMemoryInitialized()) {
      return c.json({ error: 'Memory is not enabled' }, 400);
    }
    const id = Number(c.req.param('id'));
    if (Number.isNaN(id)) {
      return c.json({ error: 'Invalid memory id' }, 400);
    }
    try {
      const deleted = deleteMemory(id);
      if (!deleted) {
        return c.json({ error: 'Memory not found' }, 404);
      }
      return c.json({ success: true });
    } catch (err) {
      logger.error(`[memory] Failed to delete memory: ${err}`);
      return c.json({ error: 'Failed to delete memory' }, 500);
    }
  });

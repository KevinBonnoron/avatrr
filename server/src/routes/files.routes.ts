import { Hono } from 'hono';
import { ensureDataDirs, listFiles, saveFile } from '../services/files.service.js';

ensureDataDirs();

export const filesRoutes = new Hono()

  .post('/upload/models', async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file provided' }, 400);
    }
    try {
      return c.json(await saveFile('models', file, '.vrm'));
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }
  })

  .post('/upload/animations', async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file provided' }, 400);
    }
    try {
      return c.json(await saveFile('animations', file, '.vrma'));
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }
  })

  .post('/upload/scenes', async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file provided' }, 400);
    }
    try {
      return c.json(await saveFile('scenes', file, ['.jpg', '.jpeg', '.png', '.webp', '.hdr', '.exr']));
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }
  })

  .get('/models', (c) => c.json(listFiles('models', '.vrm')))

  .get('/animations', (c) => c.json(listFiles('animations', '.vrma')))

  .get('/scenes', (c) => c.json(listFiles('scenes', ['.jpg', '.jpeg', '.png', '.webp', '.hdr', '.exr'])));

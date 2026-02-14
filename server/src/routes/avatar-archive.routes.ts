import { Hono } from 'hono';
import { exportAvatar, importAvatar } from '../services/avatar-archive.service';

export const avatarArchiveRoutes = new Hono()

  .get('/export/:id', async (c) => {
    const id = c.req.param('id');
    try {
      const zipBuffer = await exportAvatar(id);
      return new Response(zipBuffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${id}.zip"`,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 404);
    }
  })

  .post('/import', async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) {
      return c.json({ error: 'Missing file upload (field: "file")' }, 400);
    }
    if (!file.name.endsWith('.zip')) {
      return c.json({ error: 'Only .zip files are allowed' }, 400);
    }
    try {
      const buffer = await file.arrayBuffer();
      const result = await importAvatar(buffer);
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 400);
    }
  });

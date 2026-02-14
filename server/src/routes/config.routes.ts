import { writeFileSync } from 'node:fs';
import { Hono } from 'hono';
import stripJsonComments from 'strip-json-comments';
import { configPath, reloadConfig, validateConfig } from '../lib/config';
import { logger } from '../lib/logger';

export const configRoutes = new Hono()

  .get('/', async (c) => {
    try {
      const raw = Bun.file(configPath);
      const text = await raw.text();
      const parsed = JSON.parse(stripJsonComments(text));
      return c.json(parsed);
    } catch (err) {
      logger.error(`[config] Failed to read config: ${err}`);
      return c.json({ error: 'Failed to read config' }, 500);
    }
  })

  .put('/', async (c) => {
    try {
      const body = await c.req.json();

      if (!validateConfig(body)) {
        const errors = validateConfig.errors ?? [];
        return c.json({ error: 'Validation failed', details: errors }, 400);
      }

      const content = JSON.stringify(body, null, 2);
      writeFileSync(configPath, content, 'utf-8');

      // Force reload instead of waiting for file watcher debounce
      reloadConfig();

      return c.json({ success: true });
    } catch (err) {
      logger.error(`[config] Failed to write config: ${err}`);
      return c.json({ error: 'Failed to write config' }, 500);
    }
  });

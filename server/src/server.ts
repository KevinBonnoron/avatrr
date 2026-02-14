import { resolve } from 'node:path';
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { cors } from 'hono/cors';
import { startConfigWatcher } from './lib/config';
import { initMemory } from './lib/memory';
import { animationsRoutes, avatarArchiveRoutes, avatarRoutes, chatRoutes, configRoutes, conversationsRoutes, filesRoutes, healthRoutes, llmRoutes, memoryRoutes, sceneRoutes, ttsRoutes } from './routes';
import { getMemoryConfig } from './services';

startConfigWatcher();

const memoryConfig = getMemoryConfig();
if (memoryConfig) {
  try {
    initMemory(memoryConfig.dbPath);
  } catch (_err) {
    // Memory disabled if init fails (e.g. vec0.so not found)
  }
}

const DATA_DIR = resolve(process.env.DATA_DIR || './data');

export const app = new Hono()
  .use(
    '/data/*',
    cors({ origin: '*' }),
    serveStatic({ root: DATA_DIR, rewriteRequestPath: (path) => path.replace('/data', '') }),
  )
  .basePath('/api')
  .use(
    '*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }),
  )
  .route('/config', configRoutes)
  .route('/files', filesRoutes)
  .route('/conversations', conversationsRoutes)
  .route('/memory', memoryRoutes)
  .route('/llm', llmRoutes)
  .route('/tts', ttsRoutes)
  .route('/avatars', avatarRoutes)
  .route('/avatars', avatarArchiveRoutes)
  .route('/animations', animationsRoutes)
  .route('/chat', chatRoutes)
  .route('/health', healthRoutes)
  .route('/scenes', sceneRoutes);

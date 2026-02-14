import { Hono } from 'hono';
import { getScenes } from '../services';

export const sceneRoutes = new Hono().get('', (c) => c.json(getScenes()));

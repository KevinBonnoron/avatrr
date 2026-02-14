import { Hono } from 'hono';
import { getAnimations } from '../services';

export const animationRoutes = new Hono().get('', (c) => c.json(getAnimations()));

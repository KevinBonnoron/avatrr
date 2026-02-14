import { Hono } from 'hono';
import { getPublicAvatars } from '../services';

export const avatarRoutes = new Hono().get('', (c) => c.json(getPublicAvatars()));

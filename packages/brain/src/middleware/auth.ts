import type { Context, Next } from 'hono';
import { config } from '../lib/config.js';

export async function authMiddleware(c: Context, next: Next) {
  // Skip auth for health checks
  const path = c.req.path;
  if (path === '/health' || path === '/health/deep') {
    return next();
  }

  const apiKey = c.req.header('x-api-key');
  if (!apiKey || apiKey !== config.brainApiKey) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  return next();
}

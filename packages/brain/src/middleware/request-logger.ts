import type { Context, Next } from 'hono';
import { logger } from '../lib/logger.js';

export async function requestLogger(c: Context, next: Next) {
  const startTime = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const durationMs = Date.now() - startTime;
  const status = c.res.status;

  logger.info('HTTP request', {
    method,
    path,
    status,
    durationMs,
    correlationId: c.get('correlationId'),
  });
}

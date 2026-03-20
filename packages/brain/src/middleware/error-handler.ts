import type { Context, Next } from 'hono';
import { logger } from '../lib/logger.js';

export async function errorHandler(c: Context, next: Next) {
  const startTime = Date.now();

  try {
    await next();
  } catch (err) {
    const correlationId = c.get('correlationId') || 'unknown';
    const message = err instanceof Error ? err.message : String(err);

    logger.error('Unhandled error', {
      correlationId,
      error: message,
      path: c.req.path,
      method: c.req.method,
      durationMs: Date.now() - startTime,
    });

    const code = message.includes('timeout') ? 'LLM_TIMEOUT'
      : message.includes('provider') ? 'LLM_ERROR'
      : 'INTERNAL_ERROR';

    return c.json({
      code,
      message: 'An error occurred processing your request',
      correlationId,
      timestamp: new Date().toISOString(),
    }, 500);
  }
}

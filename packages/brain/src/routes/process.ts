import { Hono } from 'hono';
import { ProcessRequestSchema } from '@namastex/contracts';
import { processMessage } from '../orchestrator.js';
import { logger } from '../lib/logger.js';

const process = new Hono();

process.post('/api/v1/process', async (c) => {
  const body = await c.req.json();

  // Validate request
  const parsed = ProcessRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({
      code: 'INVALID_REQUEST',
      message: 'Invalid request body',
      details: parsed.error.flatten(),
      correlationId: c.get('correlationId') || 'unknown',
      timestamp: new Date().toISOString(),
    }, 400);
  }

  const request = parsed.data;

  // Ensure correlationId from header is used if not in body
  if (!request.metadata.correlationId) {
    request.metadata.correlationId = c.get('correlationId') || crypto.randomUUID();
  }

  try {
    const response = await processMessage(request);
    return c.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Process failed', {
      correlationId: request.metadata.correlationId,
      error: message,
    });

    return c.json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to process message',
      correlationId: request.metadata.correlationId,
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

export { process };

import type { Context, Next } from "hono";

export async function correlationMiddleware(c: Context, next: Next) {
  const correlationId = c.req.header("x-correlation-id") || crypto.randomUUID();
  c.set("correlationId", correlationId);
  c.header("x-correlation-id", correlationId);

  const traceId = c.req.header("x-trace-id") || crypto.randomUUID();
  c.set("traceId", traceId);
  c.header("x-trace-id", traceId);

  return next();
}

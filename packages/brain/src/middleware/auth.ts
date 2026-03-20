import type { Context, Next } from "hono";
import { config } from "../lib/config.js";

const PUBLIC_PATHS = ["/health", "/health/deep"];

export async function authMiddleware(c: Context, next: Next) {
  const path = c.req.path;

  // Skip auth for health checks
  if (PUBLIC_PATHS.includes(path)) {
    return next();
  }

  // Webhook endpoints use a separate key (OMNI_WEBHOOK_SECRET or the standard brain key)
  if (path.startsWith("/webhooks/")) {
    const webhookKey = c.req.header("x-api-key") || c.req.header("x-webhook-secret");
    const expectedKey = config.omniWebhookSecret || config.brainApiKey;
    if (!webhookKey || webhookKey !== expectedKey) {
      return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    }
    return next();
  }

  const apiKey = c.req.header("x-api-key");
  if (!apiKey || apiKey !== config.brainApiKey) {
    return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }

  return next();
}

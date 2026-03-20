import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { sessionManager } from "./memory/session-manager.js";
import { providerManager } from "./providers/provider-manager.js";

// Middleware
import { authMiddleware } from "./middleware/auth.js";
import { correlationMiddleware } from "./middleware/correlation.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestLogger } from "./middleware/request-logger.js";

import { admin } from "./routes/admin.js";
import { agents } from "./routes/agents.js";
import { channels } from "./routes/channels.js";
import { conversations } from "./routes/conversations.js";
// Routes
import { health } from "./routes/health.js";
import { processRoute } from "./routes/process.js";
import { webhooks } from "./routes/webhooks.js";
import { whatsappWebhooks } from "./routes/whatsapp-webhooks.js";

// Import agent registry to trigger registration
import "./agents/agent-registry.js";

const app = new Hono();

// Global middleware
app.use("*", cors());
app.use("*", correlationMiddleware);
app.use("*", errorHandler);
app.use("*", requestLogger);
app.use("*", authMiddleware);

// Mount routes
app.route("/", health);
app.route("/", processRoute);
app.route("/", agents);
app.route("/", admin);
app.route("/", webhooks);
app.route("/", channels);
app.route("/", conversations);
app.route("/", whatsappWebhooks);

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not Found", path: c.req.path }, 404);
});

// Startup
async function start() {
  logger.info("Starting Genie Brain...", { version: config.version });

  // Initialize providers
  await providerManager.init();

  // Start session manager
  sessionManager.start();

  // Start server
  const server = Bun.serve({
    fetch: app.fetch,
    port: config.port,
    hostname: config.host,
  });

  logger.info(`Brain running on http://${config.host}:${config.port}`, {
    providers: providerManager.getAvailableProviders(),
    reviewEnabled: config.reviewEnabled,
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info("Shutting down...");
    sessionManager.stop();
    server.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((err) => {
  logger.error("Failed to start", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});

export { app };

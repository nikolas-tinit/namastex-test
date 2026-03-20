import { Hono } from "hono";
import { agentRegistry } from "../agents/agent-registry.js";
import { channelManager } from "../channels/channel-manager.js";
import { config } from "../lib/config.js";
import { sessionManager } from "../memory/session-manager.js";
import { providerManager } from "../providers/provider-manager.js";

const startedAt = Date.now();
const health = new Hono();

health.get("/health", (c) => {
  return c.json({
    status: "ok",
    version: config.version,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
  });
});

health.get("/health/deep", async (c) => {
  const checks: Record<string, { status: "ok" | "error"; details?: string }> = {};

  // Check LLM providers
  const providers = providerManager.getAvailableProviders();
  for (const name of providers) {
    checks[`llm_${name}`] = { status: "ok" };
  }
  if (providers.length === 0) {
    checks.llm = { status: "error", details: "No LLM providers configured" };
  }

  // Check memory
  const stats = sessionManager.getStats();
  checks.memory = { status: "ok", details: `${stats.activeSessions} active sessions` };

  // Check agents
  const agents = agentRegistry.list();
  checks.agents = { status: "ok", details: `${agents.length} agents registered` };

  // Check WhatsApp channel providers
  if (channelManager.isWhatsAppEnabled()) {
    const providersInfo = channelManager.getProvidersInfo();
    for (const info of providersInfo) {
      if (info.enabled) {
        checks[`channel_${info.name}`] = {
          status: info.status === "connected" ? "ok" : "error",
          details: `${info.channel} via ${info.name}: ${info.status}`,
        };
      }
    }
  } else {
    checks.whatsapp = { status: "ok", details: "WhatsApp disabled" };
  }

  const hasErrors = Object.values(checks).some((c) => c.status === "error");
  const status = hasErrors ? (providers.length === 0 ? "unhealthy" : "degraded") : "ok";

  return c.json({
    status,
    version: config.version,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    checks,
  });
});

export { health };

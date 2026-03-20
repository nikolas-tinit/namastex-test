import { Hono } from "hono";
import { config } from "../lib/config.js";

const channels = new Hono();

/**
 * Lists the channels the Brain knows about.
 * In production, this would query Omni's instance registry.
 * For now, returns the configured Omni connection info.
 */
channels.get("/api/v1/channels", (c) => {
  return c.json({
    channels: [
      { type: "whatsapp-baileys", status: "supported", via: "omni" },
      { type: "discord", status: "supported", via: "omni" },
      { type: "telegram", status: "supported", via: "omni" },
      { type: "slack", status: "planned", via: "omni" },
      { type: "webchat", status: "planned", via: "omni" },
      { type: "test", status: "available", via: "brain-admin" },
    ],
    omni: {
      baseUrl: config.omniBaseUrl,
      connected: !!config.omniApiKey,
    },
  });
});

export { channels };

import { Hono } from "hono";
import { channelManager } from "../channels/channel-manager.js";
import { config } from "../lib/config.js";

const channels = new Hono();

/**
 * Lists the channels the Brain knows about.
 */
channels.get("/api/v1/channels", (c) => {
  const whatsappProviders = channelManager.getProvidersInfo();
  const activeWhatsApp = whatsappProviders.find((p) => p.enabled);

  return c.json({
    channels: [
      {
        type: "whatsapp",
        status: activeWhatsApp ? activeWhatsApp.status : "disabled",
        via: activeWhatsApp ? activeWhatsApp.name : "not-configured",
        providers: whatsappProviders,
      },
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

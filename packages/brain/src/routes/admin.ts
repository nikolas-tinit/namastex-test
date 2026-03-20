import { Hono } from "hono";
import { processMessage } from "../orchestrator.js";

const admin = new Hono();

// Test endpoint — sends a simulated message through the full pipeline
admin.post("/api/v1/admin/test-message", async (c) => {
  const body = await c.req.json();
  const text = body.text || "Olá, como funciona o sistema?";
  const channel = body.channel || "test";

  const request = {
    messages: [{ role: "user" as const, content: text }],
    metadata: {
      correlationId: crypto.randomUUID(),
      instanceId: "test-instance",
      channelType: channel,
      chatId: "test-chat",
      chatType: "dm",
      personId: "test-user",
      platformUserId: "test-platform-user",
      senderName: body.senderName || "Test User",
      isGroup: false,
    },
    stream: false,
    timeout: 30000,
  };

  const response = await processMessage(request);
  return c.json(response);
});

export { admin };

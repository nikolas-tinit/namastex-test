import { describe, expect, test } from "bun:test";
import { app } from "../index.js";

describe("Webhooks", () => {
  test("POST /webhooks/omni/message-received rejects without auth", async () => {
    const res = await app.request("/webhooks/omni/message-received", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hello" }],
      }),
    });
    expect(res.status).toBe(401);
  });

  test("POST /webhooks/omni/message-received accepts x-api-key", async () => {
    // Without LLM keys, the request will fail at the LLM call,
    // but it should pass auth and try to process
    const res = await app.request("/webhooks/omni/message-received", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "brain-dev-key",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hello" }],
        metadata: {
          channelType: "whatsapp-baileys",
          instanceId: "test-inst",
          chatId: "chat-1",
          personId: "person-1",
          platformUserId: "plat-1",
          senderName: "Test",
        },
      }),
    });
    // Either 200 (if LLM keys available) or 500 (if not)
    expect([200, 500]).toContain(res.status);
  });

  test("POST /webhooks/omni/message-received accepts x-webhook-secret", async () => {
    const res = await app.request("/webhooks/omni/message-received", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": "brain-dev-key",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hello" }],
      }),
    });
    // Should pass auth (200 or 500 depending on LLM availability)
    expect([200, 500]).toContain(res.status);
  });
});

describe("Channels", () => {
  test("GET /api/v1/channels returns supported channels", async () => {
    const res = await app.request("/api/v1/channels", {
      headers: { "x-api-key": "brain-dev-key" },
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { channels: Array<{ type: string }> };
    const types = body.channels.map((c) => c.type);
    expect(types).toContain("whatsapp-baileys");
    expect(types).toContain("discord");
    expect(types).toContain("telegram");
  });
});

describe("Conversations", () => {
  test("GET /api/v1/conversations/:id returns session info", async () => {
    const res = await app.request("/api/v1/conversations/test-session", {
      headers: { "x-api-key": "brain-dev-key" },
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { sessionId: string };
    expect(body.sessionId).toBe("test-session");
  });

  test("GET /api/v1/messages/:id returns message info", async () => {
    const res = await app.request("/api/v1/messages/msg-123", {
      headers: { "x-api-key": "brain-dev-key" },
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { messageId: string };
    expect(body.messageId).toBe("msg-123");
  });
});

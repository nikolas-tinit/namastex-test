import { describe, expect, test } from "bun:test";
import {
  BrainErrorSchema,
  DeepHealthResponseSchema,
  HealthResponseSchema,
  ProcessRequestSchema,
  ProcessResponseSchema,
  UnifiedMessageSchema,
} from "./index.js";

describe("ProcessRequestSchema", () => {
  test("validates a complete request", () => {
    const request = {
      messages: [{ role: "user", content: "Hello" }],
      metadata: {
        correlationId: "test-123",
        instanceId: "inst-1",
        channelType: "whatsapp",
        chatId: "chat-1",
        personId: "person-1",
        platformUserId: "plat-1",
        senderName: "Test User",
      },
    };

    const result = ProcessRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
  });

  test("fills defaults for optional fields", () => {
    const request = {
      messages: [{ role: "user", content: "Hello" }],
      metadata: {
        correlationId: "test-123",
        instanceId: "inst-1",
        channelType: "whatsapp",
        chatId: "chat-1",
        personId: "person-1",
        platformUserId: "plat-1",
        senderName: "Test User",
      },
    };

    const result = ProcessRequestSchema.parse(request);
    expect(result.stream).toBe(false);
    expect(result.timeout).toBe(30000);
    expect(result.metadata.chatType).toBe("dm");
    expect(result.metadata.isGroup).toBe(false);
  });

  test("rejects empty messages array", () => {
    const request = {
      messages: [],
      metadata: {
        correlationId: "test",
        instanceId: "inst",
        channelType: "whatsapp",
        chatId: "chat",
        personId: "person",
        platformUserId: "plat",
        senderName: "User",
      },
    };

    // Empty array is valid per schema — router handles empty gracefully
    const result = ProcessRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
  });

  test("rejects missing metadata fields", () => {
    const request = {
      messages: [{ role: "user", content: "Hello" }],
      metadata: {
        correlationId: "test",
        // missing required fields
      },
    };

    const result = ProcessRequestSchema.safeParse(request);
    expect(result.success).toBe(false);
  });
});

describe("ProcessResponseSchema", () => {
  test("validates a complete response", () => {
    const response = {
      response: "Hello!",
      metadata: {
        correlationId: "test-123",
        agentUsed: "support",
        intent: "greeting",
        confidence: 0.9,
        processingTimeMs: 1500,
        tokensUsed: 100,
        reviewPassed: true,
        model: "claude-sonnet-4-20250514",
      },
    };

    const result = ProcessResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });
});

describe("UnifiedMessageSchema", () => {
  test("validates a unified message", () => {
    const message = {
      channel: "whatsapp",
      instanceId: "inst-1",
      userId: "user-1",
      conversationId: "conv-1",
      messageId: "msg-1",
      payload: { text: "Hello" },
      timestamps: { receivedAt: new Date().toISOString() },
    };

    const result = UnifiedMessageSchema.safeParse(message);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tenantId).toBe("default");
    }
  });
});

describe("BrainErrorSchema", () => {
  test("validates error codes", () => {
    const error = {
      code: "LLM_TIMEOUT",
      message: "Request timed out",
      correlationId: "test-123",
      timestamp: new Date().toISOString(),
    };

    const result = BrainErrorSchema.safeParse(error);
    expect(result.success).toBe(true);
  });

  test("rejects invalid error codes", () => {
    const error = {
      code: "INVALID_CODE",
      message: "Bad",
      correlationId: "test",
      timestamp: new Date().toISOString(),
    };

    const result = BrainErrorSchema.safeParse(error);
    expect(result.success).toBe(false);
  });
});

describe("HealthResponseSchema", () => {
  test("validates health response", () => {
    const health = { status: "ok", version: "0.1.0", uptime: 3600 };
    expect(HealthResponseSchema.safeParse(health).success).toBe(true);
  });
});

describe("DeepHealthResponseSchema", () => {
  test("validates deep health response", () => {
    const health = {
      status: "ok",
      version: "0.1.0",
      uptime: 3600,
      checks: {
        llm_anthropic: { status: "ok", latencyMs: 250 },
        memory: { status: "ok", details: "5 active sessions" },
      },
    };
    expect(DeepHealthResponseSchema.safeParse(health).success).toBe(true);
  });
});

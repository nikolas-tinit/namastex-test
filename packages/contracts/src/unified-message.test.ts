import { describe, expect, test } from "bun:test";
import {
  AgentDefinitionSchema,
  BrainErrorSchema,
  MetadataSchema,
  SessionStateSchema,
  UnifiedMessageSchema,
} from "./index.js";

describe("UnifiedMessage contract", () => {
  test("validates a complete unified message", () => {
    const msg = {
      tenantId: "tenant-1",
      channel: "whatsapp-baileys",
      instanceId: "inst-1",
      userId: "user-1",
      conversationId: "conv-1",
      messageId: "msg-1",
      payload: {
        text: "Hello world",
        attachments: [
          {
            type: "image",
            url: "https://example.com/img.jpg",
            mimeType: "image/jpeg",
            name: "photo.jpg",
          },
        ],
        metadata: { source: "test" },
      },
      intent: "greeting",
      agent: "support",
      result: {
        response: "Hi there!",
        status: "success",
        reviewPassed: true,
      },
      timestamps: {
        receivedAt: "2026-01-01T00:00:00Z",
        processedAt: "2026-01-01T00:00:01Z",
        respondedAt: "2026-01-01T00:00:02Z",
      },
    };

    const parsed = UnifiedMessageSchema.safeParse(msg);
    expect(parsed.success).toBe(true);
  });

  test('defaults tenantId to "default"', () => {
    const msg = {
      channel: "discord",
      instanceId: "i",
      userId: "u",
      conversationId: "c",
      messageId: "m",
      payload: { text: "hi" },
      timestamps: { receivedAt: new Date().toISOString() },
    };

    const parsed = UnifiedMessageSchema.safeParse(msg);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.tenantId).toBe("default");
    }
  });

  test("validates result status enum", () => {
    const validStatuses = ["success", "error", "fallback", "review_failed"];
    for (const status of validStatuses) {
      const msg = {
        channel: "test",
        instanceId: "i",
        userId: "u",
        conversationId: "c",
        messageId: "m",
        payload: { text: "x" },
        result: { response: "r", status, reviewPassed: true },
        timestamps: { receivedAt: new Date().toISOString() },
      };
      expect(UnifiedMessageSchema.safeParse(msg).success).toBe(true);
    }
  });
});

describe("AgentDefinition contract", () => {
  test("validates with all fields", () => {
    const def = {
      name: "custom-agent",
      description: "A custom agent",
      systemPrompt: "You are helpful.",
      model: "gpt-4o",
      temperature: 0.5,
      maxTokens: 4096,
      intents: ["custom", "special"],
      priority: 50,
      reviewRequired: false,
      fallbackAgent: "support",
    };

    const parsed = AgentDefinitionSchema.safeParse(def);
    expect(parsed.success).toBe(true);
  });

  test("applies defaults", () => {
    const def = {
      name: "min-agent",
      description: "Minimal",
      systemPrompt: "Help.",
      intents: ["general"],
    };

    const parsed = AgentDefinitionSchema.safeParse(def);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.temperature).toBe(0.7);
      expect(parsed.data.maxTokens).toBe(2048);
      expect(parsed.data.priority).toBe(100);
      expect(parsed.data.reviewRequired).toBe(true);
    }
  });
});

describe("Metadata contract", () => {
  test("validates with all required fields", () => {
    const meta = {
      correlationId: "c-1",
      instanceId: "i-1",
      channelType: "whatsapp-baileys",
      chatId: "chat-1",
      personId: "p-1",
      platformUserId: "plat-1",
      senderName: "Test User",
    };

    const parsed = MetadataSchema.safeParse(meta);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.chatType).toBe("dm");
      expect(parsed.data.isGroup).toBe(false);
    }
  });

  test("rejects missing required fields", () => {
    const meta = { correlationId: "c-1" };
    const parsed = MetadataSchema.safeParse(meta);
    expect(parsed.success).toBe(false);
  });
});

describe("BrainError contract", () => {
  test("validates all error codes", () => {
    const codes = [
      "INTENT_UNKNOWN",
      "AGENT_UNAVAILABLE",
      "LLM_ERROR",
      "LLM_TIMEOUT",
      "REVIEW_REJECTED",
      "SESSION_EXPIRED",
      "INVALID_REQUEST",
      "RATE_LIMITED",
      "INTERNAL_ERROR",
    ];

    for (const code of codes) {
      const err = {
        code,
        message: `Error: ${code}`,
        correlationId: "c-1",
        timestamp: new Date().toISOString(),
      };
      expect(BrainErrorSchema.safeParse(err).success).toBe(true);
    }
  });

  test("rejects unknown error codes", () => {
    const err = {
      code: "UNKNOWN_CODE",
      message: "test",
      correlationId: "c",
      timestamp: new Date().toISOString(),
    };
    expect(BrainErrorSchema.safeParse(err).success).toBe(false);
  });
});

describe("SessionState contract", () => {
  test("validates complete session", () => {
    const session = {
      sessionId: "sess-1",
      userId: "u-1",
      channelType: "discord",
      chatId: "chat-1",
      currentAgent: "support",
      currentIntent: "help",
      conversationSummary: "User asked for help.",
      facts: { name: "João", plan: "pro" },
      messageCount: 5,
      lastActivityAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    expect(SessionStateSchema.safeParse(session).success).toBe(true);
  });
});

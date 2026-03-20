import { describe, expect, test } from "bun:test";
import {
  WhatsAppInboundMessageSchema,
  WhatsAppOutboundMessageSchema,
  WhatsAppMediaSchema,
  ChannelProviderInfoSchema,
} from "./whatsapp.js";

describe("WhatsAppMediaSchema", () => {
  test("validates complete media object", () => {
    const media = {
      url: "https://example.com/image.jpg",
      mimeType: "image/jpeg",
      sha256: "abc123hash",
      fileSize: 102400,
      caption: "A photo",
    };

    const result = WhatsAppMediaSchema.safeParse(media);
    expect(result.success).toBe(true);
  });

  test("validates empty object (all fields optional)", () => {
    const result = WhatsAppMediaSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("validates partial media object", () => {
    const media = { url: "https://example.com/doc.pdf", mimeType: "application/pdf" };
    const result = WhatsAppMediaSchema.safeParse(media);
    expect(result.success).toBe(true);
  });
});

describe("WhatsAppInboundMessageSchema", () => {
  const validInbound = {
    provider: "twilio" as const,
    channel: "whatsapp" as const,
    userId: "+5511999999999",
    userPhone: "+5511999999999",
    conversationId: "whatsapp:+5511999999999",
    messageId: "msg-001",
    timestamp: new Date().toISOString(),
    messageType: "text" as const,
    text: "Hello",
  };

  test("validates correct inbound message", () => {
    const result = WhatsAppInboundMessageSchema.safeParse(validInbound);
    expect(result.success).toBe(true);
  });

  test("fills defaults for optional fields", () => {
    const result = WhatsAppInboundMessageSchema.parse(validInbound);
    expect(result.tenantId).toBe("default");
    expect(result.instanceId).toBe("default");
  });

  test("rejects invalid provider", () => {
    const invalid = { ...validInbound, provider: "invalid-provider" };
    const result = WhatsAppInboundMessageSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  test("accepts meta-cloud as provider", () => {
    const metaInbound = { ...validInbound, provider: "meta-cloud" as const };
    const result = WhatsAppInboundMessageSchema.safeParse(metaInbound);
    expect(result.success).toBe(true);
  });

  test("rejects invalid channel", () => {
    const invalid = { ...validInbound, channel: "telegram" };
    const result = WhatsAppInboundMessageSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  test("accepts all valid message types", () => {
    const types = ["text", "image", "audio", "video", "document", "location", "reaction", "unknown"] as const;
    for (const messageType of types) {
      const msg = { ...validInbound, messageType };
      const result = WhatsAppInboundMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    }
  });

  test("rejects missing required fields", () => {
    const { userId, ...missingUserId } = validInbound;
    const result = WhatsAppInboundMessageSchema.safeParse(missingUserId);
    expect(result.success).toBe(false);
  });

  test("validates with media attachment", () => {
    const withMedia = {
      ...validInbound,
      messageType: "image" as const,
      media: {
        url: "https://example.com/photo.jpg",
        mimeType: "image/jpeg",
      },
    };
    const result = WhatsAppInboundMessageSchema.safeParse(withMedia);
    expect(result.success).toBe(true);
  });

  test("validates with rawPayload and metadata", () => {
    const withExtras = {
      ...validInbound,
      rawPayload: { original: "data", nested: { key: "value" } },
      metadata: { profileName: "User", waId: "5511999999999" },
    };
    const result = WhatsAppInboundMessageSchema.safeParse(withExtras);
    expect(result.success).toBe(true);
  });
});

describe("WhatsAppOutboundMessageSchema", () => {
  const validOutbound = {
    to: "+5511999999999",
    text: "Hello!",
    provider: "twilio" as const,
  };

  test("validates correct outbound message", () => {
    const result = WhatsAppOutboundMessageSchema.safeParse(validOutbound);
    expect(result.success).toBe(true);
  });

  test("fills defaults for messageType and channel", () => {
    const result = WhatsAppOutboundMessageSchema.parse(validOutbound);
    expect(result.messageType).toBe("text");
    expect(result.channel).toBe("whatsapp");
  });

  test("accepts meta-cloud provider", () => {
    const meta = { ...validOutbound, provider: "meta-cloud" as const };
    const result = WhatsAppOutboundMessageSchema.safeParse(meta);
    expect(result.success).toBe(true);
  });

  test("validates with mediaUrl", () => {
    const withMedia = {
      ...validOutbound,
      messageType: "image" as const,
      mediaUrl: "https://example.com/image.jpg",
    };
    const result = WhatsAppOutboundMessageSchema.safeParse(withMedia);
    expect(result.success).toBe(true);
  });

  test("validates with replyToMessageId", () => {
    const withReply = {
      ...validOutbound,
      replyToMessageId: "wamid.reply123",
    };
    const result = WhatsAppOutboundMessageSchema.safeParse(withReply);
    expect(result.success).toBe(true);
  });

  test("rejects missing 'to' field", () => {
    const { to, ...missingTo } = validOutbound;
    const result = WhatsAppOutboundMessageSchema.safeParse(missingTo);
    expect(result.success).toBe(false);
  });

  test("rejects invalid provider", () => {
    const invalid = { ...validOutbound, provider: "invalid" };
    const result = WhatsAppOutboundMessageSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("ChannelProviderInfoSchema", () => {
  test("validates correct provider info", () => {
    const info = {
      name: "twilio",
      channel: "whatsapp",
      enabled: true,
      status: "connected" as const,
    };

    const result = ChannelProviderInfoSchema.safeParse(info);
    expect(result.success).toBe(true);
  });

  test("validates all status values", () => {
    for (const status of ["connected", "disconnected", "error"] as const) {
      const info = { name: "test", channel: "whatsapp", enabled: false, status };
      const result = ChannelProviderInfoSchema.safeParse(info);
      expect(result.success).toBe(true);
    }
  });

  test("rejects invalid status", () => {
    const info = { name: "test", channel: "whatsapp", enabled: true, status: "unknown" };
    const result = ChannelProviderInfoSchema.safeParse(info);
    expect(result.success).toBe(false);
  });

  test("rejects missing required fields", () => {
    const info = { name: "test", channel: "whatsapp" };
    const result = ChannelProviderInfoSchema.safeParse(info);
    expect(result.success).toBe(false);
  });
});

import { describe, expect, test } from "bun:test";
import type { WhatsAppInboundMessage } from "@namastex/contracts";
import { inboundToProcessRequest } from "./whatsapp-bridge.js";

describe("WhatsApp Bridge", () => {
  const baseInbound: WhatsAppInboundMessage = {
    tenantId: "default",
    provider: "twilio",
    channel: "whatsapp",
    instanceId: "inst-1",
    userId: "+5511999999999",
    userPhone: "+5511999999999",
    conversationId: "whatsapp:+5511999999999",
    messageId: "msg-001",
    timestamp: new Date().toISOString(),
    messageType: "text",
    text: "Hello from WhatsApp",
    metadata: {
      profileName: "Test User",
    },
  };

  describe("inboundToProcessRequest", () => {
    test("creates correct ProcessRequest from WhatsAppInboundMessage", () => {
      const request = inboundToProcessRequest(baseInbound);

      expect(request.messages).toHaveLength(1);
      expect(request.messages[0].role).toBe("user");
      expect(request.messages[0].content).toBe("Hello from WhatsApp");
      expect(request.metadata.instanceId).toBe("inst-1");
      expect(request.metadata.channelType).toBe("whatsapp");
      expect(request.metadata.chatId).toBe("whatsapp:+5511999999999");
      expect(request.metadata.chatType).toBe("dm");
      expect(request.metadata.personId).toBe("+5511999999999");
      expect(request.metadata.platformUserId).toBe("+5511999999999");
      expect(request.metadata.senderName).toBe("Test User");
      expect(request.metadata.isGroup).toBe(false);
      expect(request.metadata.messageId).toBe("msg-001");
      expect(request.metadata.correlationId).toBeTruthy();
      expect(request.stream).toBe(false);
      expect(request.timeout).toBe(30000);
    });

    test("uses [media message] fallback when text is undefined", () => {
      const mediaInbound: WhatsAppInboundMessage = {
        ...baseInbound,
        messageType: "image",
        text: undefined,
        media: {
          url: "https://example.com/image.jpg",
          mimeType: "image/jpeg",
        },
      };

      const request = inboundToProcessRequest(mediaInbound);
      expect(request.messages[0].content).toBe("[media message]");
    });

    test("uses text content when media message has caption", () => {
      const mediaWithCaption: WhatsAppInboundMessage = {
        ...baseInbound,
        messageType: "image",
        text: "Check this photo",
        media: {
          url: "https://example.com/image.jpg",
          mimeType: "image/jpeg",
          caption: "Check this photo",
        },
      };

      const request = inboundToProcessRequest(mediaWithCaption);
      expect(request.messages[0].content).toBe("Check this photo");
    });

    test("preserves metadata from inbound message", () => {
      const inboundWithMeta: WhatsAppInboundMessage = {
        ...baseInbound,
        instanceId: "custom-instance",
        conversationId: "whatsapp:custom-conv",
        userId: "+5511888888888",
        userPhone: "+5511888888888",
        messageId: "msg-custom-123",
        metadata: {
          profileName: "Custom User",
          waId: "5511888888888",
        },
      };

      const request = inboundToProcessRequest(inboundWithMeta);
      expect(request.metadata.instanceId).toBe("custom-instance");
      expect(request.metadata.chatId).toBe("whatsapp:custom-conv");
      expect(request.metadata.personId).toBe("+5511888888888");
      expect(request.metadata.platformUserId).toBe("+5511888888888");
      expect(request.metadata.senderName).toBe("Custom User");
      expect(request.metadata.messageId).toBe("msg-custom-123");
    });

    test("falls back to userPhone for senderName when profileName missing", () => {
      const noProfile: WhatsAppInboundMessage = {
        ...baseInbound,
        metadata: {},
      };

      const request = inboundToProcessRequest(noProfile);
      expect(request.metadata.senderName).toBe("+5511999999999");
    });

    test("generates unique correlationId for each call", () => {
      const req1 = inboundToProcessRequest(baseInbound);
      const req2 = inboundToProcessRequest(baseInbound);
      expect(req1.metadata.correlationId).not.toBe(req2.metadata.correlationId);
    });
  });
});

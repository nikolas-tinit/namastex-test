import { describe, expect, test } from "bun:test";
import { TwilioWhatsAppProvider } from "./twilio-provider.js";

const provider = new TwilioWhatsAppProvider();

describe("TwilioWhatsAppProvider", () => {
  describe("getProviderName", () => {
    test("returns 'twilio'", () => {
      expect(provider.getProviderName()).toBe("twilio");
    });
  });

  describe("getInfo", () => {
    test("returns correct structure", () => {
      const info = provider.getInfo();
      expect(info.name).toBe("twilio");
      expect(info.channel).toBe("whatsapp");
      expect(typeof info.enabled).toBe("boolean");
      expect(["connected", "disconnected", "error"]).toContain(info.status);
    });
  });

  describe("parseIncomingWebhook", () => {
    test("parses valid Twilio form data", async () => {
      const body = {
        From: "whatsapp:+5511999999999",
        To: "whatsapp:+14155238886",
        Body: "Hello from Twilio",
        MessageSid: "SM1234567890abcdef",
        NumMedia: "0",
        AccountSid: "AC1234567890",
        ProfileName: "Test User",
        WaId: "5511999999999",
      };

      const result = await provider.parseIncomingWebhook(body, {});
      expect(result).not.toBeNull();
      expect(result!.provider).toBe("twilio");
      expect(result!.channel).toBe("whatsapp");
      expect(result!.userPhone).toBe("+5511999999999");
      expect(result!.userId).toBe("+5511999999999");
      expect(result!.text).toBe("Hello from Twilio");
      expect(result!.messageId).toBe("SM1234567890abcdef");
      expect(result!.messageType).toBe("text");
      expect(result!.conversationId).toBe("whatsapp:+5511999999999");
      expect(result!.metadata?.twilioAccountSid).toBe("AC1234567890");
      expect(result!.metadata?.profileName).toBe("Test User");
      expect(result!.metadata?.waId).toBe("5511999999999");
    });

    test("returns null when From field is missing", async () => {
      const body = {
        To: "whatsapp:+14155238886",
        Body: "Hello",
        MessageSid: "SM123",
        NumMedia: "0",
      };

      const result = await provider.parseIncomingWebhook(body, {});
      expect(result).toBeNull();
    });

    test("returns null when From is empty whatsapp: prefix only", async () => {
      const body = {
        From: "whatsapp:",
        Body: "Hello",
        MessageSid: "SM123",
        NumMedia: "0",
      };

      const result = await provider.parseIncomingWebhook(body, {});
      expect(result).toBeNull();
    });

    test("parses media attachment", async () => {
      const body = {
        From: "whatsapp:+5511999999999",
        To: "whatsapp:+14155238886",
        Body: "Check this image",
        MessageSid: "SM_media_test",
        NumMedia: "1",
        MediaUrl0: "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/SM123/Media/ME123",
        MediaContentType0: "image/jpeg",
      };

      const result = await provider.parseIncomingWebhook(body, {});
      expect(result).not.toBeNull();
      expect(result!.messageType).toBe("image");
      expect(result!.media).toBeDefined();
      expect(result!.media!.url).toBe(body.MediaUrl0);
      expect(result!.media!.mimeType).toBe("image/jpeg");
      expect(result!.text).toBe("Check this image");
    });

    test("handles missing Body gracefully", async () => {
      const body = {
        From: "whatsapp:+5511999999999",
        MessageSid: "SM_no_body",
        NumMedia: "0",
      };

      const result = await provider.parseIncomingWebhook(body, {});
      expect(result).not.toBeNull();
      expect(result!.text).toBeUndefined();
    });
  });

  describe("validateSignature", () => {
    test("accepts request with x-twilio-signature header", () => {
      const valid = provider.validateSignature({}, {
        "x-twilio-signature": "some-signature-value",
      });
      expect(valid).toBe(true);
    });

    test("accepts request with x-api-key when no auth token configured", () => {
      // When authToken is empty (default in test env), requests with api key should pass
      const valid = provider.validateSignature({}, {
        "x-api-key": "brain-dev-key",
      });
      // Either accepted via api key or accepted because no authToken is configured
      expect(valid).toBe(true);
    });

    test("accepts request when no auth token is configured", () => {
      // When no authToken is set, signature validation is relaxed
      const valid = provider.validateSignature({}, {});
      expect(valid).toBe(true);
    });
  });

  describe("sendMessage", () => {
    test("returns error when credentials are not configured", async () => {
      const result = await provider.sendMessage({
        to: "+5511999999999",
        messageType: "text",
        text: "Hello",
        provider: "twilio",
        channel: "whatsapp",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Twilio credentials not configured");
    });
  });
});

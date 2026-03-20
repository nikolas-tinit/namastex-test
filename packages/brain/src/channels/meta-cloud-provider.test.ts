import { describe, expect, test } from "bun:test";
import { MetaCloudWhatsAppProvider } from "./meta-cloud-provider.js";

const provider = new MetaCloudWhatsAppProvider();

describe("MetaCloudWhatsAppProvider", () => {
  describe("getProviderName", () => {
    test("returns 'meta-cloud'", () => {
      expect(provider.getProviderName()).toBe("meta-cloud");
    });
  });

  describe("getInfo", () => {
    test("returns correct structure", () => {
      const info = provider.getInfo();
      expect(info.name).toBe("meta-cloud");
      expect(info.channel).toBe("whatsapp");
      expect(typeof info.enabled).toBe("boolean");
      expect(["connected", "disconnected", "error"]).toContain(info.status);
    });
  });

  describe("parseIncomingWebhook", () => {
    test("parses valid Meta Cloud API payload", async () => {
      const body = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "BIZ_ACCOUNT_ID",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "+14155238886",
                    phone_number_id: "PHONE_NUMBER_ID",
                  },
                  contacts: [
                    {
                      profile: { name: "Test User" },
                      wa_id: "5511999999999",
                    },
                  ],
                  messages: [
                    {
                      from: "5511999999999",
                      id: "wamid.HBgNNTUxMTk5OTk5OTk5ORUCABIYIDk",
                      timestamp: "1700000000",
                      type: "text",
                      text: { body: "Hello from Meta" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = await provider.parseIncomingWebhook(body, {});
      expect(result).not.toBeNull();
      expect(result!.provider).toBe("meta-cloud");
      expect(result!.channel).toBe("whatsapp");
      expect(result!.userPhone).toBe("5511999999999");
      expect(result!.userId).toBe("5511999999999");
      expect(result!.text).toBe("Hello from Meta");
      expect(result!.messageId).toBe("wamid.HBgNNTUxMTk5OTk5OTk5ORUCABIYIDk");
      expect(result!.messageType).toBe("text");
      expect(result!.conversationId).toBe("whatsapp:5511999999999");
      expect(result!.metadata?.profileName).toBe("Test User");
      expect(result!.metadata?.waId).toBe("5511999999999");
      expect(result!.metadata?.phoneNumberId).toBe("PHONE_NUMBER_ID");
    });

    test("returns null for status update (no messages)", async () => {
      const body = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "BIZ_ACCOUNT_ID",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "+14155238886",
                    phone_number_id: "PHONE_NUMBER_ID",
                  },
                  statuses: [
                    {
                      id: "wamid.status123",
                      status: "delivered",
                      timestamp: "1700000000",
                      recipient_id: "5511999999999",
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = await provider.parseIncomingWebhook(body, {});
      expect(result).toBeNull();
    });

    test("returns null for non-whatsapp object", async () => {
      const body = {
        object: "instagram",
        entry: [{ id: "123", changes: [] }],
      };

      const result = await provider.parseIncomingWebhook(body, {});
      expect(result).toBeNull();
    });

    test("parses image message with caption", async () => {
      const body = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "BIZ_ACCOUNT_ID",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "+14155238886",
                    phone_number_id: "PHONE_NUMBER_ID",
                  },
                  contacts: [
                    {
                      profile: { name: "Media User" },
                      wa_id: "5511888888888",
                    },
                  ],
                  messages: [
                    {
                      from: "5511888888888",
                      id: "wamid.media123",
                      timestamp: "1700000100",
                      type: "image",
                      image: {
                        mime_type: "image/jpeg",
                        sha256: "abc123hash",
                        caption: "Look at this!",
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = await provider.parseIncomingWebhook(body, {});
      expect(result).not.toBeNull();
      expect(result!.messageType).toBe("image");
      expect(result!.media).toBeDefined();
      expect(result!.media!.mimeType).toBe("image/jpeg");
      expect(result!.media!.sha256).toBe("abc123hash");
      expect(result!.media!.caption).toBe("Look at this!");
      expect(result!.text).toBe("Look at this!");
    });

    test("returns null for empty entries array", async () => {
      const body = {
        object: "whatsapp_business_account",
        entry: [],
      };

      const result = await provider.parseIncomingWebhook(body, {});
      expect(result).toBeNull();
    });
  });

  describe("verifyWebhook", () => {
    test("rejects when token does not match", () => {
      const result = provider.verifyWebhook({
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong-token",
        "hub.challenge": "challenge-string",
      });

      expect(result.valid).toBe(false);
      expect(result.challenge).toBeUndefined();
    });

    test("rejects when mode is not subscribe", () => {
      const result = provider.verifyWebhook({
        "hub.mode": "unsubscribe",
        "hub.verify_token": "",
        "hub.challenge": "challenge-string",
      });

      expect(result.valid).toBe(false);
    });
  });

  describe("validateSignature", () => {
    test("accepts request with x-hub-signature-256 header", () => {
      const valid = provider.validateSignature({}, {
        "x-hub-signature-256": "sha256=abc123",
      });
      expect(valid).toBe(true);
    });

    test("accepts request when no app secret is configured", () => {
      // When no appSecret is set (default in test env), signature validation is relaxed
      const valid = provider.validateSignature({}, {});
      expect(valid).toBe(true);
    });
  });

  describe("sendMessage", () => {
    test("returns error when credentials are not configured", async () => {
      const result = await provider.sendMessage({
        to: "5511999999999",
        messageType: "text",
        text: "Hello",
        provider: "meta-cloud",
        channel: "whatsapp",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Meta Cloud API credentials not configured");
    });
  });
});

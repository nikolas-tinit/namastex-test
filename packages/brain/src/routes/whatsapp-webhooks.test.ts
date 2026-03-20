import { describe, expect, test } from "bun:test";
import { app } from "../index.js";

describe("WhatsApp Webhooks", () => {
  describe("POST /webhooks/whatsapp/twilio", () => {
    test("accepts valid Twilio webhook payload", async () => {
      const body = {
        From: "whatsapp:+5511999999999",
        To: "whatsapp:+14155238886",
        Body: "Hello from Twilio test",
        MessageSid: "SM_test_webhook_123",
        NumMedia: "0",
        AccountSid: "AC_test_123",
        ProfileName: "Webhook Tester",
        WaId: "5511999999999",
      };

      const res = await app.request("/webhooks/whatsapp/twilio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "brain-dev-key",
        },
        body: JSON.stringify(body),
      });

      // 503 if WhatsApp is disabled (default in test env), 200 if enabled
      // The route returns TwiML XML on success or JSON error
      expect([200, 503]).toContain(res.status);
    });

    test("returns 503 when WhatsApp is not enabled", async () => {
      // In test env, WHATSAPP_ENABLED is not set, so it defaults to false
      const body = {
        From: "whatsapp:+5511999999999",
        Body: "Test",
        MessageSid: "SM_disabled_test",
        NumMedia: "0",
      };

      const res = await app.request("/webhooks/whatsapp/twilio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "brain-dev-key",
        },
        body: JSON.stringify(body),
      });

      // Should be 503 since WHATSAPP_ENABLED is not set in test env
      if (!process.env.WHATSAPP_ENABLED) {
        expect(res.status).toBe(503);
        const responseBody = (await res.json()) as { error: string };
        expect(responseBody.error).toBe("WhatsApp is not enabled");
      }
    });
  });

  describe("GET /webhooks/whatsapp/meta", () => {
    test("returns 403 for invalid verification token", async () => {
      const params = new URLSearchParams({
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong-token",
        "hub.challenge": "test-challenge-string",
      });

      const res = await app.request(`/webhooks/whatsapp/meta?${params.toString()}`);
      expect(res.status).toBe(403);

      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("Verification failed");
    });

    test("returns 403 when mode is not subscribe", async () => {
      const params = new URLSearchParams({
        "hub.mode": "unsubscribe",
        "hub.verify_token": "",
        "hub.challenge": "test-challenge",
      });

      const res = await app.request(`/webhooks/whatsapp/meta?${params.toString()}`);
      expect(res.status).toBe(403);
    });
  });

  describe("POST /webhooks/whatsapp/meta", () => {
    test("accepts valid Meta webhook payload", async () => {
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
                      profile: { name: "Webhook Tester" },
                      wa_id: "5511999999999",
                    },
                  ],
                  messages: [
                    {
                      from: "5511999999999",
                      id: "wamid.webhook_test_123",
                      timestamp: "1700000000",
                      type: "text",
                      text: { body: "Hello from Meta webhook test" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const res = await app.request("/webhooks/whatsapp/meta", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      // 503 if WhatsApp disabled, 200 if enabled
      expect([200, 503]).toContain(res.status);
    });

    test("returns 503 when WhatsApp is not enabled", async () => {
      const body = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "BIZ_ACCOUNT_ID",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: { phone_number_id: "PHONE_ID" },
                  messages: [
                    {
                      from: "5511999999999",
                      id: "wamid.test",
                      timestamp: "1700000000",
                      type: "text",
                      text: { body: "Test" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const res = await app.request("/webhooks/whatsapp/meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!process.env.WHATSAPP_ENABLED) {
        expect(res.status).toBe(503);
        const responseBody = (await res.json()) as { error: string };
        expect(responseBody.error).toBe("WhatsApp is not enabled");
      }
    });

    test("acknowledges status updates (no messages)", async () => {
      // Only test if WhatsApp is enabled; otherwise the 503 check is redundant
      if (process.env.WHATSAPP_ENABLED === "true") {
        const body = {
          object: "whatsapp_business_account",
          entry: [
            {
              id: "BIZ_ACCOUNT_ID",
              changes: [
                {
                  value: {
                    messaging_product: "whatsapp",
                    metadata: { phone_number_id: "PHONE_ID" },
                    statuses: [
                      {
                        id: "wamid.status",
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

        const res = await app.request("/webhooks/whatsapp/meta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        expect(res.status).toBe(200);
        const responseBody = (await res.json()) as { status: string };
        expect(responseBody.status).toBe("acknowledged");
      }
    });
  });
});

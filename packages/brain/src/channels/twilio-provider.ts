import type { ChannelProvider, WhatsAppInboundMessage, WhatsAppOutboundMessage, ChannelProviderInfo } from "@namastex/contracts";
import { createHmac, timingSafeEqual } from "node:crypto";
import { logger } from "../lib/logger.js";
import { whatsappConfig } from "./whatsapp-config.js";

/**
 * Twilio WhatsApp Provider
 *
 * Handles:
 * - Parsing incoming Twilio webhook payloads
 * - Validating Twilio request signatures
 * - Sending outbound messages via Twilio REST API
 */
export class TwilioWhatsAppProvider implements ChannelProvider {
  private log = logger.child({ provider: "twilio", channel: "whatsapp" });

  getProviderName(): string {
    return "twilio";
  }

  getInfo(): ChannelProviderInfo {
    const cfg = whatsappConfig.twilio;
    return {
      name: "twilio",
      channel: "whatsapp",
      enabled: whatsappConfig.enabled && whatsappConfig.provider === "twilio",
      status: cfg.accountSid && cfg.authToken ? "connected" : "disconnected",
    };
  }

  /**
   * Validate Twilio webhook signature.
   *
   * Twilio sends an X-Twilio-Signature header. For production, you should validate
   * using Twilio's signature validation algorithm. For now we do a basic auth token check.
   */
  validateSignature(body: unknown, headers: Record<string, string>): boolean {
    const signature = headers["x-twilio-signature"];

    // If no auth token configured, allow (dev mode)
    if (!whatsappConfig.twilio.authToken) return true;

    // If no signature, check for webhook secret fallback
    if (!signature) {
      const secret = headers["x-webhook-secret"] || headers["x-api-key"];
      return secret === whatsappConfig.twilio.webhookSecret || secret === whatsappConfig.twilio.authToken;
    }

    // Twilio signature validation requires the full webhook URL + sorted POST params
    const webhookUrl = whatsappConfig.webhookBaseUrl
      ? `${whatsappConfig.webhookBaseUrl}/webhooks/whatsapp/twilio`
      : "";

    if (!webhookUrl) {
      // Can't validate without knowing the URL, allow if signature present
      this.log.warn("WEBHOOK_BASE_URL not set, skipping Twilio signature validation");
      return true;
    }

    try {
      const data = body as Record<string, string>;
      // Sort POST params and append to URL
      let dataString = webhookUrl;
      const sortedKeys = Object.keys(data).sort();
      for (const key of sortedKeys) {
        dataString += key + (data[key] || "");
      }

      const expectedSignature = createHmac("sha1", whatsappConfig.twilio.authToken)
        .update(dataString)
        .digest("base64");

      if (signature.length !== expectedSignature.length) return false;
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch (err) {
      this.log.error("Twilio signature validation error", { error: err instanceof Error ? err.message : String(err) });
      return false;
    }
  }

  /**
   * Parse Twilio incoming webhook payload.
   *
   * Twilio sends form-encoded data with fields like:
   * - From: whatsapp:+5511999999999
   * - To: whatsapp:+14155238886
   * - Body: message text
   * - MessageSid: unique ID
   * - NumMedia: number of media attachments
   * - MediaUrl0, MediaContentType0, etc.
   */
  async parseIncomingWebhook(body: unknown, _headers: Record<string, string>): Promise<WhatsAppInboundMessage | null> {
    try {
      const data = body as Record<string, string>;

      const from = data.From || "";
      const userPhone = from.replace("whatsapp:", "");
      const messageBody = data.Body || "";
      const messageSid = data.MessageSid || crypto.randomUUID();
      const numMedia = Number.parseInt(data.NumMedia || "0", 10);

      if (!userPhone) {
        this.log.warn("Missing From field in Twilio webhook");
        return null;
      }

      const message: WhatsAppInboundMessage = {
        tenantId: whatsappConfig.defaultTenantId,
        provider: "twilio",
        channel: "whatsapp",
        instanceId: whatsappConfig.defaultInstanceId,
        userId: userPhone,
        userPhone,
        conversationId: `whatsapp:${userPhone}`,
        messageId: messageSid,
        timestamp: new Date().toISOString(),
        messageType: numMedia > 0 ? "image" : "text",
        text: messageBody || undefined,
        media: numMedia > 0
          ? {
              url: data.MediaUrl0,
              mimeType: data.MediaContentType0,
            }
          : undefined,
        rawPayload: data,
        metadata: {
          twilioAccountSid: data.AccountSid,
          profileName: data.ProfileName,
          waId: data.WaId,
        },
      };

      this.log.info("Parsed Twilio inbound message", {
        phone: userPhone,
        messageId: messageSid,
        messageType: message.messageType,
      });

      return message;
    } catch (err) {
      this.log.error("Failed to parse Twilio webhook", {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Send a message via Twilio WhatsApp API.
   */
  async sendMessage(message: WhatsAppOutboundMessage): Promise<{ success: boolean; providerMessageId?: string; error?: string }> {
    const cfg = whatsappConfig.twilio;

    if (!cfg.accountSid || !cfg.authToken) {
      return { success: false, error: "Twilio credentials not configured" };
    }

    const from = cfg.whatsappFrom.startsWith("whatsapp:")
      ? cfg.whatsappFrom
      : `whatsapp:${cfg.whatsappFrom}`;
    const to = message.to.startsWith("whatsapp:")
      ? message.to
      : `whatsapp:${message.to}`;

    const params = new URLSearchParams();
    params.set("From", from);
    params.set("To", to);

    if (message.text) {
      params.set("Body", message.text);
    }
    if (message.mediaUrl) {
      params.set("MediaUrl", message.mediaUrl);
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`;
    const auth = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64");

    let lastError = "";
    for (let attempt = 0; attempt <= whatsappConfig.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), whatsappConfig.sendTimeoutMs);

        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          const errBody = await res.text();
          lastError = `Twilio API error ${res.status}: ${errBody}`;
          this.log.error("Twilio send failed", { status: res.status, error: errBody, attempt });
          if (res.status >= 400 && res.status < 500) {
            return { success: false, error: lastError };
          }
          continue;
        }

        const result = await res.json() as { sid?: string };
        this.log.info("Message sent via Twilio", {
          to: message.to,
          messageSid: result.sid,
        });

        return { success: true, providerMessageId: result.sid };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        this.log.error("Twilio send error", { error: lastError, attempt });
        if (attempt < whatsappConfig.maxRetries) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }
    }

    return { success: false, error: lastError };
  }
}

export const twilioProvider = new TwilioWhatsAppProvider();

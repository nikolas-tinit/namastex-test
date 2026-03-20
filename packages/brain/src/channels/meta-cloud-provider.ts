import type { ChannelProvider, WhatsAppInboundMessage, WhatsAppOutboundMessage, ChannelProviderInfo } from "@namastex/contracts";
import { createHmac, timingSafeEqual } from "node:crypto";
import { logger } from "../lib/logger.js";
import { whatsappConfig } from "./whatsapp-config.js";

/**
 * Meta WhatsApp Cloud API Provider
 *
 * Handles:
 * - Webhook verification (GET challenge)
 * - Parsing incoming message webhooks
 * - Validating X-Hub-Signature-256
 * - Sending outbound messages via Graph API
 */
export class MetaCloudWhatsAppProvider implements ChannelProvider {
  private log = logger.child({ provider: "meta-cloud", channel: "whatsapp" });

  getProviderName(): string {
    return "meta-cloud";
  }

  getInfo(): ChannelProviderInfo {
    const cfg = whatsappConfig.meta;
    return {
      name: "meta-cloud",
      channel: "whatsapp",
      enabled: whatsappConfig.enabled && whatsappConfig.provider === "meta-cloud",
      status: cfg.accessToken && cfg.phoneNumberId ? "connected" : "disconnected",
    };
  }

  /**
   * Verify webhook challenge from Meta.
   * Meta sends GET with hub.mode, hub.verify_token, hub.challenge.
   */
  verifyWebhook(query: Record<string, string>): { valid: boolean; challenge?: string } {
    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    if (mode === "subscribe" && token === whatsappConfig.meta.verifyToken) {
      this.log.info("Meta webhook verification successful");
      return { valid: true, challenge };
    }

    this.log.warn("Meta webhook verification failed", { mode, tokenMatch: token === whatsappConfig.meta.verifyToken });
    return { valid: false };
  }

  /**
   * Validate X-Hub-Signature-256 header from Meta.
   */
  validateSignature(body: unknown, headers: Record<string, string>): boolean {
    const signature = headers["x-hub-signature-256"];
    if (!signature) {
      // Allow in dev if no app secret configured
      return !whatsappConfig.meta.appSecret;
    }

    if (!whatsappConfig.meta.appSecret) return true;

    try {
      const rawBody = typeof body === "string" ? body : JSON.stringify(body);
      const expectedSignature = `sha256=${createHmac("sha256", whatsappConfig.meta.appSecret).update(rawBody).digest("hex")}`;

      if (signature.length !== expectedSignature.length) return false;
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch (err) {
      this.log.error("Signature validation error", { error: err instanceof Error ? err.message : String(err) });
      return false;
    }
  }

  /**
   * Parse Meta Cloud API incoming webhook payload.
   *
   * Meta sends JSON with structure:
   * {
   *   object: "whatsapp_business_account",
   *   entry: [{
   *     id: "BUSINESS_ACCOUNT_ID",
   *     changes: [{
   *       value: {
   *         messaging_product: "whatsapp",
   *         metadata: { display_phone_number, phone_number_id },
   *         contacts: [{ profile: { name }, wa_id }],
   *         messages: [{ from, id, timestamp, type, text: { body } }]
   *       }
   *     }]
   *   }]
   * }
   */
  async parseIncomingWebhook(body: unknown, _headers: Record<string, string>): Promise<WhatsAppInboundMessage | null> {
    try {
      const data = body as Record<string, unknown>;

      if (data.object !== "whatsapp_business_account") {
        this.log.debug("Not a WhatsApp business account event, ignoring");
        return null;
      }

      const entries = data.entry as Array<Record<string, unknown>>;
      if (!entries || entries.length === 0) return null;

      const changes = entries[0].changes as Array<Record<string, unknown>>;
      if (!changes || changes.length === 0) return null;

      const value = changes[0].value as Record<string, unknown>;
      if (!value) return null;

      const messages = value.messages as Array<Record<string, unknown>>;
      if (!messages || messages.length === 0) {
        // This might be a status update, not a message
        this.log.debug("No messages in webhook payload (likely a status update)");
        return null;
      }

      const msg = messages[0];
      const contacts = value.contacts as Array<Record<string, unknown>>;
      const contact = contacts?.[0];
      const profile = contact?.profile as Record<string, string> | undefined;

      const from = msg.from as string;
      const messageId = msg.id as string;
      const timestamp = msg.timestamp as string;
      const msgType = msg.type as string;

      let text: string | undefined;
      let media: WhatsAppInboundMessage["media"];

      if (msgType === "text") {
        const textObj = msg.text as Record<string, string>;
        text = textObj?.body;
      } else if (["image", "audio", "video", "document"].includes(msgType)) {
        const mediaObj = msg[msgType] as Record<string, string>;
        media = {
          mimeType: mediaObj?.mime_type,
          sha256: mediaObj?.sha256,
          caption: mediaObj?.caption,
        };
        text = mediaObj?.caption;
      }

      const messageType = ["text", "image", "audio", "video", "document", "location", "reaction"].includes(msgType)
        ? msgType as WhatsAppInboundMessage["messageType"]
        : "unknown";

      const message: WhatsAppInboundMessage = {
        tenantId: whatsappConfig.defaultTenantId,
        provider: "meta-cloud",
        channel: "whatsapp",
        instanceId: whatsappConfig.defaultInstanceId,
        userId: from,
        userPhone: from,
        conversationId: `whatsapp:${from}`,
        messageId,
        timestamp: new Date(Number.parseInt(timestamp, 10) * 1000).toISOString(),
        messageType,
        text,
        media,
        rawPayload: data,
        metadata: {
          profileName: profile?.name,
          waId: (contact as Record<string, string>)?.wa_id,
          phoneNumberId: (value.metadata as Record<string, string>)?.phone_number_id,
        },
      };

      this.log.info("Parsed Meta Cloud inbound message", {
        phone: from,
        messageId,
        messageType,
      });

      return message;
    } catch (err) {
      this.log.error("Failed to parse Meta Cloud webhook", {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Send a message via Meta WhatsApp Cloud API.
   */
  async sendMessage(message: WhatsAppOutboundMessage): Promise<{ success: boolean; providerMessageId?: string; error?: string }> {
    const cfg = whatsappConfig.meta;

    if (!cfg.accessToken || !cfg.phoneNumberId) {
      return { success: false, error: "Meta Cloud API credentials not configured" };
    }

    const url = `https://graph.facebook.com/${cfg.apiVersion}/${cfg.phoneNumberId}/messages`;

    // Build message payload
    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to: message.to,
    };

    if (message.replyToMessageId) {
      payload.context = { message_id: message.replyToMessageId };
    }

    if (message.messageType === "text" || !message.mediaUrl) {
      payload.type = "text";
      payload.text = { body: message.text || "" };
    } else {
      payload.type = message.messageType;
      payload[message.messageType] = {
        link: message.mediaUrl,
        caption: message.text,
      };
    }

    let lastError = "";
    for (let attempt = 0; attempt <= whatsappConfig.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), whatsappConfig.sendTimeoutMs);

        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cfg.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          const errBody = await res.text();
          lastError = `Meta API error ${res.status}: ${errBody}`;
          this.log.error("Meta Cloud send failed", { status: res.status, error: errBody, attempt });
          if (res.status >= 400 && res.status < 500) {
            return { success: false, error: lastError };
          }
          continue;
        }

        const result = await res.json() as { messages?: Array<{ id: string }> };
        const providerMessageId = result.messages?.[0]?.id;

        this.log.info("Message sent via Meta Cloud API", {
          to: message.to,
          messageId: providerMessageId,
        });

        return { success: true, providerMessageId };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        this.log.error("Meta Cloud send error", { error: lastError, attempt });
        if (attempt < whatsappConfig.maxRetries) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }
    }

    return { success: false, error: lastError };
  }
}

export const metaCloudProvider = new MetaCloudWhatsAppProvider();

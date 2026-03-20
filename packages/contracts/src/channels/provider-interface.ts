import type { WhatsAppInboundMessage, WhatsAppOutboundMessage, ChannelProviderInfo } from "./whatsapp.js";

/**
 * Common interface for all channel providers (Twilio, Meta Cloud API, etc.).
 * Each provider must implement these methods to plug into the Omni layer.
 */
export interface ChannelProvider {
  /** Parse an incoming webhook request into a normalized inbound message. */
  parseIncomingWebhook(body: unknown, headers: Record<string, string>): Promise<WhatsAppInboundMessage | null>;

  /** Send an outbound message through this provider. */
  sendMessage(message: WhatsAppOutboundMessage): Promise<{ success: boolean; providerMessageId?: string; error?: string }>;

  /** Validate the webhook signature/authenticity. */
  validateSignature(body: unknown, headers: Record<string, string>): boolean;

  /** Return the provider name (e.g. "twilio", "meta-cloud"). */
  getProviderName(): string;

  /** Return provider status info. */
  getInfo(): ChannelProviderInfo;
}

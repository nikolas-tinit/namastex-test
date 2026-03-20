import type { ChannelProvider, WhatsAppOutboundMessage } from "@namastex/contracts";
import { logger } from "../lib/logger.js";
import { metaCloudProvider } from "./meta-cloud-provider.js";
import { twilioProvider } from "./twilio-provider.js";
import { whatsappConfig } from "./whatsapp-config.js";

/**
 * Manages channel providers. Selects the active provider based on config
 * and routes outbound messages to the correct provider.
 */
class ChannelManager {
  private providers = new Map<string, ChannelProvider>();

  constructor() {
    this.providers.set("twilio", twilioProvider);
    this.providers.set("meta-cloud", metaCloudProvider);
  }

  /** Get the currently active WhatsApp provider based on config. */
  getActiveProvider(): ChannelProvider | null {
    if (!whatsappConfig.enabled) return null;
    return this.providers.get(whatsappConfig.provider) || null;
  }

  /** Get a specific provider by name. */
  getProvider(name: string): ChannelProvider | null {
    return this.providers.get(name) || null;
  }

  /** Send a WhatsApp message using the configured provider. */
  async sendWhatsAppMessage(
    message: WhatsAppOutboundMessage,
  ): Promise<{ success: boolean; providerMessageId?: string; error?: string }> {
    const provider = this.providers.get(message.provider) || this.getActiveProvider();
    if (!provider) {
      return { success: false, error: "No WhatsApp provider available" };
    }

    logger.info("Sending WhatsApp message", {
      provider: provider.getProviderName(),
      to: message.to,
      messageType: message.messageType,
    });

    return provider.sendMessage(message);
  }

  /** Check if WhatsApp is enabled and configured. */
  isWhatsAppEnabled(): boolean {
    return whatsappConfig.enabled;
  }

  /** Get info about all registered providers. */
  getProvidersInfo() {
    return Array.from(this.providers.values()).map((p) => p.getInfo());
  }
}

export const channelManager = new ChannelManager();

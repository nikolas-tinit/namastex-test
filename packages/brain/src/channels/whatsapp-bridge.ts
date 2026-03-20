import type { ProcessRequest, WhatsAppInboundMessage, WhatsAppOutboundMessage } from "@namastex/contracts";
import { logger } from "../lib/logger.js";
import { processMessage } from "../orchestrator.js";
import { channelManager } from "./channel-manager.js";

/**
 * WhatsApp Bridge — connects WhatsApp inbound messages to the Brain pipeline
 * and sends back the response via the correct provider.
 *
 * Flow:
 * 1. WhatsApp inbound message (already normalized by provider)
 * 2. Convert to Brain ProcessRequest
 * 3. Process through orchestrator (router → agent → review)
 * 4. Convert response to WhatsApp outbound message
 * 5. Send via the correct provider
 */

const log = logger.child({ module: "whatsapp-bridge" });

/**
 * Convert a normalized WhatsApp inbound message to a Brain ProcessRequest.
 */
export function inboundToProcessRequest(inbound: WhatsAppInboundMessage): ProcessRequest {
  const correlationId = crypto.randomUUID();

  return {
    messages: [
      {
        role: "user" as const,
        content: inbound.text || "[media message]",
      },
    ],
    metadata: {
      correlationId,
      instanceId: inbound.instanceId,
      channelType: "whatsapp",
      chatId: inbound.conversationId,
      chatType: "dm",
      personId: inbound.userId,
      platformUserId: inbound.userPhone,
      senderName: (inbound.metadata?.profileName as string) || inbound.userPhone,
      isGroup: false,
      messageId: inbound.messageId,
    },
    stream: false,
    timeout: 30000,
  };
}

/**
 * Process a WhatsApp inbound message end-to-end:
 * parse → normalize → brain → respond.
 */
export async function handleWhatsAppMessage(
  inbound: WhatsAppInboundMessage,
): Promise<{ success: boolean; response?: string; error?: string }> {
  const startTime = Date.now();
  const correlationId = crypto.randomUUID();

  log.info("Processing WhatsApp message", {
    correlationId,
    provider: inbound.provider,
    phone: inbound.userPhone,
    messageId: inbound.messageId,
    messageType: inbound.messageType,
  });

  try {
    // 1. Convert to Brain ProcessRequest
    const request = inboundToProcessRequest(inbound);
    request.metadata.correlationId = correlationId;

    // 2. Process through the brain pipeline
    const brainResponse = await processMessage(request);

    log.info("Brain processed WhatsApp message", {
      correlationId,
      agent: brainResponse.metadata.agentUsed,
      intent: brainResponse.metadata.intent,
      processingTimeMs: brainResponse.metadata.processingTimeMs,
    });

    // 3. Build outbound message
    const outbound: WhatsAppOutboundMessage = {
      to: inbound.userPhone,
      messageType: "text",
      text: brainResponse.response,
      provider: inbound.provider,
      channel: "whatsapp",
      metadata: {
        correlationId,
        agentUsed: brainResponse.metadata.agentUsed,
        intent: brainResponse.metadata.intent,
      },
    };

    // 4. Send response back via WhatsApp
    const sendResult = await channelManager.sendWhatsAppMessage(outbound);

    const totalTime = Date.now() - startTime;
    if (sendResult.success) {
      log.info("WhatsApp response sent", {
        correlationId,
        phone: inbound.userPhone,
        providerMessageId: sendResult.providerMessageId,
        totalTimeMs: totalTime,
      });
    } else {
      log.error("Failed to send WhatsApp response", {
        correlationId,
        phone: inbound.userPhone,
        error: sendResult.error,
        totalTimeMs: totalTime,
      });
    }

    return {
      success: sendResult.success,
      response: brainResponse.response,
      error: sendResult.error,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("WhatsApp message processing failed", {
      correlationId,
      phone: inbound.userPhone,
      error: message,
      totalTimeMs: Date.now() - startTime,
    });

    return { success: false, error: message };
  }
}

import type { ProcessRequest } from "@namastex/contracts";

/**
 * Adapts Omni's agent trigger format to Brain's ProcessRequest.
 *
 * Omni's agent dispatcher sends triggers in its own format. This adapter
 * normalizes them to the Brain's expected contract.
 */
export class OmniToBrainAdapter {
  /**
   * Convert Omni agent trigger payload to Brain ProcessRequest.
   *
   * Omni sends: { messages, metadata, sessionData }
   * Brain expects: ProcessRequest (same shape, but we ensure normalization)
   */
  static adapt(omniPayload: {
    messages: Array<{ role: string; content: string; files?: Array<{ name: string; mimeType: string; url: string }> }>;
    metadata?: {
      correlationId?: string;
      instanceId?: string;
      channelType?: string;
      chatId?: string;
      chatType?: string;
      personId?: string;
      platformUserId?: string;
      senderName?: string;
      isGroup?: boolean;
      messageId?: string;
    };
    sessionData?: {
      sessionId?: string;
      context?: Record<string, unknown>;
    };
    stream?: boolean;
    timeout?: number;
  }): ProcessRequest {
    const meta = omniPayload.metadata || {};

    return {
      messages: omniPayload.messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
        files: m.files,
      })),
      metadata: {
        correlationId: meta.correlationId || crypto.randomUUID(),
        instanceId: meta.instanceId || "unknown",
        channelType: meta.channelType || "unknown",
        chatId: meta.chatId || "unknown",
        chatType: meta.chatType || "dm",
        personId: meta.personId || "unknown",
        platformUserId: meta.platformUserId || "unknown",
        senderName: meta.senderName || "Unknown User",
        isGroup: meta.isGroup || false,
        messageId: meta.messageId,
      },
      sessionData: omniPayload.sessionData
        ? {
            sessionId: omniPayload.sessionData.sessionId || "",
            context: omniPayload.sessionData.context || {},
          }
        : undefined,
      stream: omniPayload.stream || false,
      timeout: omniPayload.timeout || 30000,
    };
  }
}

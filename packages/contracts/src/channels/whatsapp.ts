import { z } from "zod";

// ============================================================
// WhatsApp Inbound Message Contract
// ============================================================

export const WhatsAppMediaSchema = z.object({
  url: z.string().optional(),
  mimeType: z.string().optional(),
  sha256: z.string().optional(),
  fileSize: z.number().optional(),
  caption: z.string().optional(),
});

export const WhatsAppInboundMessageSchema = z.object({
  tenantId: z.string().default("default"),
  provider: z.enum(["twilio", "meta-cloud"]),
  channel: z.literal("whatsapp"),
  instanceId: z.string().default("default"),
  userId: z.string(),
  userPhone: z.string(),
  conversationId: z.string(),
  messageId: z.string(),
  timestamp: z.string(),
  messageType: z.enum(["text", "image", "audio", "video", "document", "location", "reaction", "unknown"]),
  text: z.string().optional(),
  media: WhatsAppMediaSchema.optional(),
  rawPayload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================
// WhatsApp Outbound Message Contract
// ============================================================

export const WhatsAppOutboundMessageSchema = z.object({
  to: z.string(),
  messageType: z.enum(["text", "image", "audio", "video", "document"]).default("text"),
  text: z.string().optional(),
  mediaUrl: z.string().optional(),
  replyToMessageId: z.string().optional(),
  provider: z.enum(["twilio", "meta-cloud"]),
  channel: z.literal("whatsapp").default("whatsapp"),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================
// Channel Provider Interface Contract
// ============================================================

export const ChannelProviderInfoSchema = z.object({
  name: z.string(),
  channel: z.string(),
  enabled: z.boolean(),
  status: z.enum(["connected", "disconnected", "error"]),
});

// ============================================================
// Type exports
// ============================================================

export type WhatsAppMedia = z.infer<typeof WhatsAppMediaSchema>;
export type WhatsAppInboundMessage = z.infer<typeof WhatsAppInboundMessageSchema>;
export type WhatsAppOutboundMessage = z.infer<typeof WhatsAppOutboundMessageSchema>;
export type ChannelProviderInfo = z.infer<typeof ChannelProviderInfoSchema>;

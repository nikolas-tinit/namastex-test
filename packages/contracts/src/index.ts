import { z } from "zod";

// ============================================================
// Core Schemas
// ============================================================

export const AttachmentSchema = z.object({
  type: z.enum(["image", "audio", "video", "document"]),
  url: z.string(),
  mimeType: z.string(),
  name: z.string().optional(),
  transcription: z.string().optional(),
  description: z.string().optional(),
});

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  files: z
    .array(
      z.object({
        name: z.string(),
        mimeType: z.string(),
        url: z.string(),
      }),
    )
    .optional(),
});

export const MetadataSchema = z.object({
  correlationId: z.string(),
  instanceId: z.string(),
  channelType: z.string(),
  chatId: z.string(),
  chatType: z.string().default("dm"),
  personId: z.string(),
  platformUserId: z.string(),
  senderName: z.string(),
  isGroup: z.boolean().default(false),
  messageId: z.string().optional(),
});

export const SessionDataSchema = z.object({
  sessionId: z.string(),
  context: z.record(z.unknown()).default({}),
});

// ============================================================
// Process Request/Response
// ============================================================

export const ProcessRequestSchema = z.object({
  messages: z.array(ChatMessageSchema),
  metadata: MetadataSchema,
  sessionData: SessionDataSchema.optional(),
  stream: z.boolean().default(false),
  timeout: z.number().default(30000),
});

export const ProcessResponseMetadataSchema = z.object({
  correlationId: z.string(),
  agentUsed: z.string(),
  intent: z.string(),
  confidence: z.number(),
  processingTimeMs: z.number(),
  tokensUsed: z.number().default(0),
  reviewPassed: z.boolean(),
  model: z.string().optional(),
});

export const ProcessResponseSchema = z.object({
  response: z.string(),
  metadata: ProcessResponseMetadataSchema,
  sessionUpdate: z
    .object({
      context: z.record(z.unknown()),
    })
    .optional(),
});

// ============================================================
// Agent Definition
// ============================================================

export const AgentDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  systemPrompt: z.string(),
  model: z.string().optional(),
  temperature: z.number().default(0.7),
  maxTokens: z.number().default(2048),
  intents: z.array(z.string()),
  priority: z.number().default(100),
  reviewRequired: z.boolean().default(true),
  fallbackAgent: z.string().optional(),
});

// ============================================================
// Session State
// ============================================================

export const SessionStateSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  channelType: z.string(),
  chatId: z.string(),
  currentAgent: z.string().optional(),
  currentIntent: z.string().optional(),
  conversationSummary: z.string().optional(),
  facts: z.record(z.string()).default({}),
  messageCount: z.number().default(0),
  lastActivityAt: z.string(),
  createdAt: z.string(),
});

// ============================================================
// Errors
// ============================================================

export const BrainErrorSchema = z.object({
  code: z.enum([
    "INTENT_UNKNOWN",
    "AGENT_UNAVAILABLE",
    "LLM_ERROR",
    "LLM_TIMEOUT",
    "REVIEW_REJECTED",
    "SESSION_EXPIRED",
    "INVALID_REQUEST",
    "RATE_LIMITED",
    "INTERNAL_ERROR",
  ]),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  correlationId: z.string(),
  timestamp: z.string(),
});

// ============================================================
// Health
// ============================================================

export const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "unhealthy"]),
  version: z.string(),
  uptime: z.number(),
});

export const DeepHealthResponseSchema = HealthResponseSchema.extend({
  checks: z.record(
    z.object({
      status: z.enum(["ok", "error"]),
      latencyMs: z.number().optional(),
      details: z.string().optional(),
    }),
  ),
});

// ============================================================
// Unified Message
// ============================================================

export const UnifiedMessageSchema = z.object({
  tenantId: z.string().default("default"),
  channel: z.string(),
  instanceId: z.string(),
  userId: z.string(),
  conversationId: z.string(),
  messageId: z.string(),
  payload: z.object({
    text: z.string(),
    attachments: z.array(AttachmentSchema).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
  intent: z.string().optional(),
  agent: z.string().optional(),
  result: z
    .object({
      response: z.string(),
      status: z.enum(["success", "error", "fallback", "review_failed"]),
      reviewPassed: z.boolean(),
    })
    .optional(),
  timestamps: z.object({
    receivedAt: z.string(),
    processedAt: z.string().optional(),
    respondedAt: z.string().optional(),
  }),
});

// ============================================================
// Type exports
// ============================================================

export type Attachment = z.infer<typeof AttachmentSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type Metadata = z.infer<typeof MetadataSchema>;
export type SessionData = z.infer<typeof SessionDataSchema>;
export type ProcessRequest = z.infer<typeof ProcessRequestSchema>;
export type ProcessResponse = z.infer<typeof ProcessResponseSchema>;
export type ProcessResponseMetadata = z.infer<typeof ProcessResponseMetadataSchema>;
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;
export type SessionState = z.infer<typeof SessionStateSchema>;
export type BrainError = z.infer<typeof BrainErrorSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type DeepHealthResponse = z.infer<typeof DeepHealthResponseSchema>;
export type UnifiedMessage = z.infer<typeof UnifiedMessageSchema>;

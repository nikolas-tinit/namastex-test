import { describe, expect, test } from "bun:test";
import { ProcessRequestSchema, ProcessResponseSchema } from "@namastex/contracts";
import { BrainToOmniAdapter } from "./brain-to-omni.js";
import { OmniToBrainAdapter } from "./omni-to-brain.js";

/**
 * Tests the full data flow: Omni message → Brain request → Brain response → Omni response.
 * Does NOT require a running server — validates schema contracts and adapter correctness.
 */
describe("Full flow: Omni → Gateway → Brain → Gateway → Omni", () => {
  test("WhatsApp DM flow", () => {
    // Step 1: Omni sends a message event
    const omniEvent = {
      messages: [{ role: "user", content: "Olá, preciso de ajuda com meu pedido" }],
      metadata: {
        correlationId: "flow-test-1",
        instanceId: "whatsapp-prod-1",
        channelType: "whatsapp-baileys",
        chatId: "5511999888777@s.whatsapp.net",
        chatType: "dm",
        personId: "person-abc",
        platformUserId: "5511999888777@s.whatsapp.net",
        senderName: "Maria Silva",
        isGroup: false,
        messageId: "msg-wa-123",
      },
      sessionData: {
        sessionId: "sess-existing",
        context: { previousAgent: "support" },
      },
    };

    // Step 2: Gateway adapts Omni → Brain
    const brainRequest = OmniToBrainAdapter.adapt(omniEvent);

    // Step 3: Validate request matches Brain's contract
    const requestValidation = ProcessRequestSchema.safeParse(brainRequest);
    expect(requestValidation.success).toBe(true);

    // Step 4: Verify all metadata preserved
    expect(brainRequest.metadata.channelType).toBe("whatsapp-baileys");
    expect(brainRequest.metadata.senderName).toBe("Maria Silva");
    expect(brainRequest.metadata.personId).toBe("person-abc");
    expect(brainRequest.metadata.instanceId).toBe("whatsapp-prod-1");
    expect(brainRequest.sessionData?.sessionId).toBe("sess-existing");

    // Step 5: Simulate Brain response
    const brainResponse = {
      response: "Olá Maria! Claro, posso ajudar com seu pedido. Qual o número do pedido?",
      metadata: {
        correlationId: "flow-test-1",
        agentUsed: "support",
        intent: "help",
        confidence: 0.92,
        processingTimeMs: 1500,
        tokensUsed: 200,
        reviewPassed: true,
        model: "claude-sonnet-4-20250514",
      },
      sessionUpdate: {
        context: { currentAgent: "support", currentIntent: "help", messageCount: 1 },
      },
    };

    // Step 6: Validate Brain response matches contract
    const responseValidation = ProcessResponseSchema.safeParse(brainResponse);
    expect(responseValidation.success).toBe(true);

    // Step 7: Gateway adapts Brain → Omni
    const omniResponse = BrainToOmniAdapter.adapt(brainResponse);

    expect(omniResponse.response).toBe("Olá Maria! Claro, posso ajudar com seu pedido. Qual o número do pedido?");
    expect(omniResponse.metadata.agentUsed).toBe("support");
    expect(omniResponse.metadata.intent).toBe("help");
    expect(omniResponse.metadata.confidence).toBe(0.92);
    expect(omniResponse.metadata.reviewPassed).toBe(true);
    expect(omniResponse.sessionUpdate?.context.currentAgent).toBe("support");
  });

  test("Discord group flow", () => {
    const omniEvent = {
      messages: [{ role: "user", content: "Quanto custa o plano pro?" }],
      metadata: {
        channelType: "discord",
        instanceId: "discord-bot-1",
        chatId: "channel-123456",
        chatType: "group",
        personId: "person-xyz",
        platformUserId: "discord-user-789",
        senderName: "DevUser",
        isGroup: true,
      },
    };

    const brainRequest = OmniToBrainAdapter.adapt(omniEvent);
    const validation = ProcessRequestSchema.safeParse(brainRequest);
    expect(validation.success).toBe(true);

    expect(brainRequest.metadata.isGroup).toBe(true);
    expect(brainRequest.metadata.channelType).toBe("discord");
    expect(brainRequest.metadata.chatType).toBe("group");
  });

  test("Telegram flow with media", () => {
    const omniEvent = {
      messages: [
        {
          role: "user",
          content: "Veja este documento",
          files: [{ name: "contrato.pdf", mimeType: "application/pdf", url: "https://cdn.telegram.org/file/xxx" }],
        },
      ],
      metadata: {
        channelType: "telegram",
        instanceId: "tg-bot-1",
        chatId: "tg-chat-999",
        personId: "person-tg",
        platformUserId: "tg-user-111",
        senderName: "Carlos",
      },
    };

    const brainRequest = OmniToBrainAdapter.adapt(omniEvent);
    const validation = ProcessRequestSchema.safeParse(brainRequest);
    expect(validation.success).toBe(true);

    expect(brainRequest.messages[0].files).toHaveLength(1);
    expect(brainRequest.messages[0].files![0].name).toBe("contrato.pdf");
  });

  test("Minimal payload (no metadata) defaults gracefully", () => {
    const omniEvent = {
      messages: [{ role: "user", content: "hi" }],
    };

    const brainRequest = OmniToBrainAdapter.adapt(omniEvent);
    const validation = ProcessRequestSchema.safeParse(brainRequest);
    expect(validation.success).toBe(true);

    // All defaults should be applied
    expect(brainRequest.metadata.channelType).toBe("unknown");
    expect(brainRequest.metadata.senderName).toBe("Unknown User");
    expect(brainRequest.metadata.correlationId).toBeTruthy();
    expect(brainRequest.stream).toBe(false);
    expect(brainRequest.timeout).toBe(30000);
  });

  test("Simple adapter returns text-only", () => {
    const brainResponse = {
      response: "Resposta simples.",
      metadata: {
        correlationId: "c1",
        agentUsed: "support",
        intent: "unknown",
        confidence: 0.5,
        processingTimeMs: 100,
        tokensUsed: 10,
        reviewPassed: true,
      },
    };

    const simpleResponse = BrainToOmniAdapter.adaptSimple(brainResponse as any);
    expect(simpleResponse).toBe("Resposta simples.");
  });
});

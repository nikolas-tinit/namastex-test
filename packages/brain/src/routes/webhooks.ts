import { BrainToOmniAdapter, OmniToBrainAdapter } from "@namastex/gateway";
import { Hono } from "hono";
import { logger } from "../lib/logger.js";
import { processMessage } from "../orchestrator.js";

const webhooks = new Hono();

/**
 * Webhook endpoint for Omni to send message events to Brain.
 * This is the primary integration point — Omni's agent dispatcher
 * calls this endpoint when a message needs AI processing.
 */
webhooks.post("/webhooks/omni/message-received", async (c) => {
  const omniPayload = await c.req.json();
  const correlationId = c.req.header("x-correlation-id") || crypto.randomUUID();

  const log = logger.child({ correlationId, source: "webhook:omni" });
  log.info("Webhook received from Omni", {
    channel: omniPayload.metadata?.channelType,
    instanceId: omniPayload.metadata?.instanceId,
  });

  try {
    // Translate Omni format → Brain format
    const request = OmniToBrainAdapter.adapt(omniPayload);
    request.metadata.correlationId = correlationId;

    // Process through the full pipeline
    const brainResponse = await processMessage(request);

    // Translate Brain format → Omni format
    const omniResponse = BrainToOmniAdapter.adapt(brainResponse);

    log.info("Webhook processed", {
      agent: brainResponse.metadata.agentUsed,
      intent: brainResponse.metadata.intent,
      processingTimeMs: brainResponse.metadata.processingTimeMs,
    });

    return c.json(omniResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Webhook processing failed", { error: message });

    return c.json(
      {
        response: "",
        metadata: { error: message, correlationId },
        status: "error",
      },
      500,
    );
  }
});

export { webhooks };

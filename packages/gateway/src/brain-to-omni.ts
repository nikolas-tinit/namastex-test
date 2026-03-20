import type { ProcessResponse } from "@namastex/contracts";

/**
 * Adapts Brain's ProcessResponse to Omni's expected agent response format.
 *
 * Omni's agent dispatcher expects responses in a specific format. This adapter
 * converts the Brain's structured response to what Omni can consume.
 */
export class BrainToOmniAdapter {
  /**
   * Convert Brain ProcessResponse to Omni's expected format.
   *
   * Omni webhook provider expects either:
   * - A string (simple text response)
   * - An object with { response, metadata } for richer responses
   */
  static adapt(brainResponse: ProcessResponse): {
    response: string;
    metadata: Record<string, unknown>;
    sessionUpdate?: { context: Record<string, unknown> };
  } {
    return {
      response: brainResponse.response,
      metadata: {
        agentUsed: brainResponse.metadata.agentUsed,
        intent: brainResponse.metadata.intent,
        confidence: brainResponse.metadata.confidence,
        processingTimeMs: brainResponse.metadata.processingTimeMs,
        tokensUsed: brainResponse.metadata.tokensUsed,
        reviewPassed: brainResponse.metadata.reviewPassed,
        model: brainResponse.metadata.model,
      },
      sessionUpdate: brainResponse.sessionUpdate,
    };
  }

  /**
   * Extract just the text response (for simple webhook providers).
   */
  static adaptSimple(brainResponse: ProcessResponse): string {
    return brainResponse.response;
  }
}

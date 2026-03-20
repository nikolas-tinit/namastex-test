import type { ProcessRequest, ProcessResponse } from "@namastex/contracts";
import { BrainToOmniAdapter } from "./brain-to-omni.js";
import { OmniToBrainAdapter } from "./omni-to-brain.js";

interface GatewayConfig {
  brainBaseUrl: string;
  brainApiKey: string;
  timeoutMs?: number;
  maxRetries?: number;
}

interface GatewayResult {
  success: boolean;
  response?: string;
  metadata?: Record<string, unknown>;
  sessionUpdate?: { context: Record<string, unknown> };
  error?: string;
  retries: number;
}

/**
 * Gateway client that handles communication between Omni and Brain.
 * Includes retry logic, error handling, and adapter translation.
 */
export class GatewayClient {
  private config: Required<GatewayConfig>;

  constructor(config: GatewayConfig) {
    this.config = {
      timeoutMs: 30000,
      maxRetries: 2,
      ...config,
    };
  }

  /**
   * Send a message from Omni to Brain for processing.
   */
  async process(omniPayload: Parameters<typeof OmniToBrainAdapter.adapt>[0]): Promise<GatewayResult> {
    const request = OmniToBrainAdapter.adapt(omniPayload);
    let lastError = "";

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

        const res = await fetch(`${this.config.brainBaseUrl}/api/v1/process`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.config.brainApiKey,
            "x-correlation-id": request.metadata.correlationId,
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          const body = await res.text();
          lastError = `HTTP ${res.status}: ${body}`;
          if (res.status >= 400 && res.status < 500) {
            // Client error — don't retry
            return { success: false, error: lastError, retries: attempt };
          }
          continue; // Server error — retry
        }

        const brainResponse = (await res.json()) as ProcessResponse;
        const adapted = BrainToOmniAdapter.adapt(brainResponse);

        return {
          success: true,
          response: adapted.response,
          metadata: adapted.metadata,
          sessionUpdate: adapted.sessionUpdate,
          retries: attempt,
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt < this.config.maxRetries) {
          // Exponential backoff: 500ms, 1500ms
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }
    }

    return { success: false, error: lastError, retries: this.config.maxRetries };
  }

  /**
   * Check Brain health.
   */
  async healthCheck(): Promise<{ ok: boolean; details?: unknown }> {
    try {
      const res = await fetch(`${this.config.brainBaseUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return { ok: false };
      const data = await res.json();
      return { ok: true, details: data };
    } catch {
      return { ok: false };
    }
  }
}

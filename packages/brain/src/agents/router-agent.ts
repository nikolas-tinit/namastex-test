import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import { providerManager } from "../providers/provider-manager.js";
import type { AgentContext } from "./base-agent.js";

export interface RouteDecision {
  agent: string;
  intent: string;
  confidence: number;
  reasoning: string;
}

const ROUTER_SYSTEM_PROMPT = `You are an intent classifier and router. Analyze the user's message and determine:
1. The intent category
2. Which specialist agent should handle it
3. Your confidence level (0.0 to 1.0)

Available agents:
- support: General questions, FAQs, help requests, how-to, troubleshooting
- sales: Commercial inquiries, pricing, plans, purchasing, upgrades, business proposals
- ops: Operational tasks, status checks, system commands, automation triggers, reports
- support: (fallback) If unsure, route to support

Respond ONLY with a JSON object, no other text:
{
  "agent": "support|sales|ops",
  "intent": "brief intent label",
  "confidence": 0.0-1.0,
  "reasoning": "one sentence explanation"
}`;

export class RouterAgent {
  async route(context: AgentContext): Promise<RouteDecision> {
    const lastMessage = context.conversationHistory[context.conversationHistory.length - 1];
    if (!lastMessage) {
      return { agent: "support", intent: "empty", confidence: 0.5, reasoning: "No message content" };
    }

    try {
      const response = await providerManager.chat([{ role: "user", content: lastMessage.content }], {
        model: config.routerModel,
        systemPrompt: ROUTER_SYSTEM_PROMPT,
        temperature: 0.1,
        maxTokens: 256,
      });

      const parsed = JSON.parse(response.content.trim());
      const decision: RouteDecision = {
        agent: parsed.agent || "support",
        intent: parsed.intent || "unknown",
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
        reasoning: parsed.reasoning || "",
      };

      logger.info("Route decision", {
        correlationId: context.request.metadata.correlationId,
        agent: decision.agent,
        intent: decision.intent,
        confidence: decision.confidence,
      });

      return decision;
    } catch (err) {
      logger.warn("Router failed to parse LLM response, defaulting to support", {
        error: err instanceof Error ? err.message : String(err),
      });
      return { agent: "support", intent: "unknown", confidence: 0.3, reasoning: "Router parse error" };
    }
  }
}

export const routerAgent = new RouterAgent();

import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import { providerManager } from "../providers/provider-manager.js";

export interface ReviewResult {
  passed: boolean;
  issues: string[];
  score: number;
}

const REVIEW_SYSTEM_PROMPT = `You are a response quality reviewer. Evaluate the assistant's response against these criteria:

1. **Relevance**: Does it answer the user's question/request?
2. **Safety**: Does it avoid harmful, offensive, or inappropriate content?
3. **Accuracy**: Does it avoid making clearly false claims?
4. **Tone**: Is the tone appropriate for the context?
5. **Completeness**: Does it adequately address the query?

Respond ONLY with a JSON object:
{
  "passed": true/false,
  "score": 0.0-1.0,
  "issues": ["issue1", "issue2"] or []
}

Be lenient — only fail responses that are clearly problematic (harmful, completely off-topic, or factually dangerous). Most responses should pass.`;

export class ReviewAgent {
  async review(
    userMessage: string,
    agentResponse: string,
    context: { agent: string; intent: string; correlationId: string },
  ): Promise<ReviewResult> {
    if (!config.reviewEnabled) {
      return { passed: true, issues: [], score: 1.0 };
    }

    try {
      const response = await providerManager.chat(
        [
          {
            role: "user",
            content: `User message: "${userMessage}"\n\nAssistant response (from ${context.agent} agent, intent: ${context.intent}):\n"${agentResponse}"`,
          },
        ],
        {
          model: config.reviewModel,
          systemPrompt: REVIEW_SYSTEM_PROMPT,
          temperature: 0.1,
          maxTokens: 256,
        },
      );

      const parsed = JSON.parse(response.content.trim());
      const result: ReviewResult = {
        passed: parsed.passed !== false,
        score: Math.min(1, Math.max(0, parsed.score || 0.5)),
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      };

      logger.info("Review result", {
        correlationId: context.correlationId,
        passed: result.passed,
        score: result.score,
        issues: result.issues,
      });

      return result;
    } catch (err) {
      logger.warn("Review failed, passing by default", {
        correlationId: context.correlationId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { passed: true, issues: [], score: 0.5 };
    }
  }
}

export const reviewAgent = new ReviewAgent();

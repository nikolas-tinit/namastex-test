import OpenAI from "openai";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import type { ChatMessage, LLMOptions, LLMProvider, LLMResponse } from "./types.js";

export class OpenAIProvider implements LLMProvider {
  name = "openai";
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({ apiKey: config.openaiApiKey });
    }
    return this.client;
  }

  async chat(messages: ChatMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    const client = this.getClient();
    const model = options.model || "gpt-4o";

    const allMessages = [...messages];
    if (options.systemPrompt) {
      allMessages.unshift({ role: "system", content: options.systemPrompt });
    }

    const startTime = Date.now();

    const response = await client.chat.completions.create({
      model,
      max_tokens: options.maxTokens || 2048,
      temperature: options.temperature ?? 0.7,
      messages: allMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const content = response.choices[0]?.message?.content || "";
    const tokensUsed = response.usage?.total_tokens || 0;

    logger.debug("OpenAI response", {
      model,
      tokensUsed,
      durationMs: Date.now() - startTime,
      finishReason: response.choices[0]?.finish_reason,
    });

    return {
      content,
      model,
      tokensUsed,
      finishReason: response.choices[0]?.finish_reason || "unknown",
    };
  }

  async isAvailable(): Promise<boolean> {
    return !!config.openaiApiKey;
  }
}

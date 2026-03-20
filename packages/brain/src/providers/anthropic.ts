import Anthropic from "@anthropic-ai/sdk";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import type { ChatMessage, LLMOptions, LLMProvider, LLMResponse } from "./types.js";

export class AnthropicProvider implements LLMProvider {
  name = "anthropic";
  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({ apiKey: config.anthropicApiKey });
    }
    return this.client;
  }

  async chat(messages: ChatMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    const client = this.getClient();
    const model = options.model || config.defaultModel;

    const systemMessages = messages.filter((m) => m.role === "system");
    const chatMessages = messages.filter((m) => m.role !== "system");

    const systemPrompt = [options.systemPrompt, ...systemMessages.map((m) => m.content)].filter(Boolean).join("\n\n");

    const startTime = Date.now();

    const response = await client.messages.create({
      model,
      max_tokens: options.maxTokens || 2048,
      temperature: options.temperature ?? 0.7,
      system: systemPrompt || undefined,
      messages: chatMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const content = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as Anthropic.TextBlock).text)
      .join("");

    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    logger.debug("Anthropic response", {
      model,
      tokensUsed,
      durationMs: Date.now() - startTime,
      stopReason: response.stop_reason,
    });

    return {
      content,
      model,
      tokensUsed,
      finishReason: response.stop_reason || "unknown",
    };
  }

  async isAvailable(): Promise<boolean> {
    return !!config.anthropicApiKey;
  }
}

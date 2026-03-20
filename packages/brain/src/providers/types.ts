export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  timeoutMs?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  tokensUsed: number;
  finishReason: string;
}

export interface LLMProvider {
  name: string;
  chat(messages: ChatMessage[], options: LLMOptions): Promise<LLMResponse>;
  isAvailable(): Promise<boolean>;
}

import type { ProcessRequest } from '@namastex/contracts';
import type { SessionState } from '../memory/session-manager.js';
import type { LLMOptions } from '../providers/types.js';
import { providerManager } from '../providers/provider-manager.js';
import { logger } from '../lib/logger.js';

export interface AgentResult {
  response: string;
  intent: string;
  confidence: number;
  tokensUsed: number;
  model: string;
  metadata?: Record<string, unknown>;
}

export interface AgentContext {
  request: ProcessRequest;
  session: SessionState;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export abstract class BaseAgent {
  abstract name: string;
  abstract description: string;
  abstract systemPrompt: string;
  abstract intents: string[];

  model?: string;
  temperature = 0.7;
  maxTokens = 2048;
  reviewRequired = true;

  async execute(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();
    const log = logger.child({ agent: this.name, correlationId: context.request.metadata.correlationId });

    log.info('Agent executing');

    const systemPrompt = this.buildSystemPrompt(context);
    const messages = this.buildMessages(context);

    const options: LLMOptions = {
      model: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      systemPrompt,
    };

    const llmResponse = await providerManager.chat(messages, options);

    log.info('Agent completed', {
      tokensUsed: llmResponse.tokensUsed,
      durationMs: Date.now() - startTime,
    });

    return {
      response: llmResponse.content,
      intent: context.session.currentIntent || 'unknown',
      confidence: 0.8,
      tokensUsed: llmResponse.tokensUsed,
      model: llmResponse.model,
    };
  }

  protected buildSystemPrompt(context: AgentContext): string {
    const parts = [this.systemPrompt];

    if (context.session.conversationSummary) {
      parts.push(`\n## Conversation Summary\n${context.session.conversationSummary}`);
    }

    const facts = Object.entries(context.session.facts);
    if (facts.length > 0) {
      parts.push(`\n## Known Facts\n${facts.map(([k, v]) => `- ${k}: ${v}`).join('\n')}`);
    }

    const meta = context.request.metadata;
    parts.push(`\n## Context\n- Channel: ${meta.channelType}\n- User: ${meta.senderName}\n- Chat type: ${meta.chatType}`);

    return parts.join('\n');
  }

  protected buildMessages(context: AgentContext): Array<{ role: 'user' | 'assistant'; content: string }> {
    return context.conversationHistory;
  }
}

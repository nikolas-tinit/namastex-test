import { logger } from '../lib/logger.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import type { ChatMessage, LLMOptions, LLMProvider, LLMResponse } from './types.js';

export class ProviderManager {
  private providers: LLMProvider[] = [];
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    const anthropic = new AnthropicProvider();
    const openai = new OpenAIProvider();

    if (await anthropic.isAvailable()) {
      this.providers.push(anthropic);
      logger.info('LLM provider registered', { provider: 'anthropic' });
    }

    if (await openai.isAvailable()) {
      this.providers.push(openai);
      logger.info('LLM provider registered', { provider: 'openai' });
    }

    if (this.providers.length === 0) {
      logger.warn('No LLM providers available — set ANTHROPIC_API_KEY or OPENAI_API_KEY');
    }

    this.initialized = true;
  }

  async chat(messages: ChatMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    await this.init();

    for (const provider of this.providers) {
      try {
        return await provider.chat(messages, options);
      } catch (err) {
        logger.warn('LLM provider failed, trying next', {
          provider: provider.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    throw new Error('All LLM providers failed');
  }

  getAvailableProviders(): string[] {
    return this.providers.map(p => p.name);
  }

  hasProviders(): boolean {
    return this.providers.length > 0;
  }
}

// Singleton
export const providerManager = new ProviderManager();

export const config = {
  port: Number(process.env.BRAIN_PORT || 8890),
  host: process.env.BRAIN_HOST || '0.0.0.0',

  // API Keys
  brainApiKey: process.env.BRAIN_API_KEY || 'brain-dev-key',
  omniApiKey: process.env.OMNI_API_KEY || '',
  omniBaseUrl: process.env.OMNI_BASE_URL || 'http://localhost:8882',

  // LLM Providers
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',

  // Models
  defaultModel: process.env.BRAIN_DEFAULT_MODEL || 'claude-sonnet-4-20250514',
  routerModel: process.env.BRAIN_ROUTER_MODEL || 'claude-haiku-4-5-20251001',
  reviewModel: process.env.BRAIN_REVIEW_MODEL || 'claude-haiku-4-5-20251001',

  // Memory
  maxConversationHistory: Number(process.env.BRAIN_MAX_HISTORY || 20),
  sessionTtlMs: Number(process.env.BRAIN_SESSION_TTL_MS || 3600000), // 1h
  summarizeAfterMessages: Number(process.env.BRAIN_SUMMARIZE_AFTER || 20),

  // Timeouts
  llmTimeoutMs: Number(process.env.BRAIN_LLM_TIMEOUT_MS || 30000),
  processTimeoutMs: Number(process.env.BRAIN_PROCESS_TIMEOUT_MS || 45000),

  // Review
  reviewEnabled: process.env.BRAIN_REVIEW_ENABLED !== 'false',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Version
  version: '0.1.0',
};

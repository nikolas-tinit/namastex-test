import { Hono } from 'hono';
import { config } from '../lib/config.js';
import { providerManager } from '../providers/provider-manager.js';
import { sessionManager } from '../memory/session-manager.js';
import { agentRegistry } from '../agents/agent-registry.js';

const startedAt = Date.now();
const health = new Hono();

health.get('/health', (c) => {
  return c.json({
    status: 'ok',
    version: config.version,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
  });
});

health.get('/health/deep', async (c) => {
  const checks: Record<string, { status: 'ok' | 'error'; details?: string }> = {};

  // Check LLM providers
  const providers = providerManager.getAvailableProviders();
  for (const name of providers) {
    checks[`llm_${name}`] = { status: 'ok' };
  }
  if (providers.length === 0) {
    checks.llm = { status: 'error', details: 'No LLM providers configured' };
  }

  // Check memory
  const stats = sessionManager.getStats();
  checks.memory = { status: 'ok', details: `${stats.activeSessions} active sessions` };

  // Check agents
  const agents = agentRegistry.list();
  checks.agents = { status: 'ok', details: `${agents.length} agents registered` };

  const hasErrors = Object.values(checks).some(c => c.status === 'error');
  const status = hasErrors ? (providers.length === 0 ? 'unhealthy' : 'degraded') : 'ok';

  return c.json({
    status,
    version: config.version,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    checks,
  });
});

export { health };

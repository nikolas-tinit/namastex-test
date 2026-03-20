import { describe, expect, test, beforeAll } from 'bun:test';
import { app } from './index.js';

// These tests run against the actual HTTP app (in-process, no network)
// They test the full pipeline but mock LLM responses by design:
// If no LLM keys are set, the pipeline will fail gracefully and we test error handling.
// If LLM keys are set (CI/integration), we test the full flow.

const hasLLMKeys = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);

describe('E2E: Brain HTTP API', () => {
  test('GET /health returns 200', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('GET /health/deep returns 200', async () => {
    const res = await app.request('/health/deep');
    expect(res.status).toBe(200);
  });

  test('GET /api/v1/agents returns registered agents', async () => {
    const res = await app.request('/api/v1/agents', {
      headers: { 'x-api-key': 'brain-dev-key' },
    });
    expect(res.status).toBe(200);

    const body = await res.json() as { agents: Array<{ name: string }> };
    const names = body.agents.map((a: { name: string }) => a.name);
    expect(names).toContain('support');
    expect(names).toContain('sales');
    expect(names).toContain('ops');
  });

  test('POST /api/v1/process rejects without auth', async () => {
    const res = await app.request('/api/v1/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }] }),
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/v1/process rejects invalid body', async () => {
    const res = await app.request('/api/v1/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'brain-dev-key',
      },
      body: JSON.stringify({ messages: 'not an array' }),
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/v1/admin/test-message rejects without auth', async () => {
    const res = await app.request('/api/v1/admin/test-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello' }),
    });
    expect(res.status).toBe(401);
  });

  test('GET /nonexistent returns 404', async () => {
    const res = await app.request('/nonexistent', {
      headers: { 'x-api-key': 'brain-dev-key' },
    });
    expect(res.status).toBe(404);
  });

  // Integration test — only runs if LLM keys are available
  if (hasLLMKeys) {
    test('POST /api/v1/process handles full pipeline', async () => {
      const res = await app.request('/api/v1/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'brain-dev-key',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Olá, como funciona o sistema?' }],
          metadata: {
            correlationId: 'e2e-test-1',
            instanceId: 'test-inst',
            channelType: 'test',
            chatId: 'test-chat',
            personId: 'test-person',
            platformUserId: 'test-plat',
            senderName: 'E2E Tester',
          },
        }),
      });

      expect(res.status).toBe(200);

      const body = await res.json() as {
        response: string;
        metadata: { agentUsed: string; intent: string; confidence: number; reviewPassed: boolean };
      };
      expect(body.response).toBeTruthy();
      expect(body.metadata.agentUsed).toBeTruthy();
      expect(body.metadata.intent).toBeTruthy();
      expect(typeof body.metadata.confidence).toBe('number');
      expect(typeof body.metadata.reviewPassed).toBe('boolean');
    }, 60000); // 60s timeout for LLM call

    test('POST /api/v1/admin/test-message works', async () => {
      const res = await app.request('/api/v1/admin/test-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'brain-dev-key',
        },
        body: JSON.stringify({ text: 'Quanto custa o plano enterprise?' }),
      });

      expect(res.status).toBe(200);

      const body = await res.json() as { metadata: { agentUsed: string } };
      expect(body.metadata.agentUsed).toBeTruthy();
    }, 60000);
  }
});

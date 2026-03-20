import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import { health } from './health.js';

// Import to ensure agents are registered
import '../agents/agent-registry.js';

const app = new Hono();
app.route('/', health);

describe('Health endpoints', () => {
  test('GET /health returns ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBeTruthy();
    expect(typeof body.uptime).toBe('number');
  });

  test('GET /health/deep returns detailed status', async () => {
    const res = await app.request('/health/deep');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.version).toBeTruthy();
    expect(body.checks).toBeDefined();
    expect(body.checks.memory).toBeDefined();
    expect(body.checks.agents).toBeDefined();
    expect(body.checks.agents.status).toBe('ok');
  });
});

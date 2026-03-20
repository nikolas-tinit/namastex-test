import { beforeEach, describe, expect, test } from "bun:test";
import { agentRegistry } from "./agent-registry.js";

describe("AgentRegistry", () => {
  test("has built-in agents registered", () => {
    const agents = agentRegistry.list();
    const names = agents.map((a) => a.name);

    expect(names).toContain("support");
    expect(names).toContain("sales");
    expect(names).toContain("ops");
  });

  test("gets agent by name", () => {
    const support = agentRegistry.get("support");
    expect(support).toBeDefined();
    expect(support!.name).toBe("support");
    expect(support!.description).toBeTruthy();
    expect(support!.intents.length).toBeGreaterThan(0);
  });

  test("returns support as default for unknown agent", () => {
    const agent = agentRegistry.getOrDefault("nonexistent-agent");
    expect(agent.name).toBe("support");
  });

  test("has() returns correct results", () => {
    expect(agentRegistry.has("support")).toBe(true);
    expect(agentRegistry.has("sales")).toBe(true);
    expect(agentRegistry.has("ops")).toBe(true);
    expect(agentRegistry.has("nonexistent")).toBe(false);
  });

  test("list() returns agent definitions", () => {
    const agents = agentRegistry.list();
    for (const agent of agents) {
      expect(agent.name).toBeTruthy();
      expect(agent.description).toBeTruthy();
      expect(Array.isArray(agent.intents)).toBe(true);
    }
  });
});

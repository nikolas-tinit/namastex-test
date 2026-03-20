import { describe, expect, test } from "bun:test";
import { agentRegistry } from "./agent-registry.js";

describe("Agent routing and registry", () => {
  test("all required agents are registered", () => {
    expect(agentRegistry.has("support")).toBe(true);
    expect(agentRegistry.has("sales")).toBe(true);
    expect(agentRegistry.has("ops")).toBe(true);
  });

  test("getOrDefault falls back to support for unknown agents", () => {
    const agent = agentRegistry.getOrDefault("nonexistent");
    expect(agent.name).toBe("support");
  });

  test("getOrDefault returns the correct agent when found", () => {
    const agent = agentRegistry.getOrDefault("sales");
    expect(agent.name).toBe("sales");
  });

  test("listed agents have required fields", () => {
    const agents = agentRegistry.list();
    expect(agents.length).toBeGreaterThanOrEqual(3);

    for (const agent of agents) {
      expect(agent.name).toBeTruthy();
      expect(agent.description).toBeTruthy();
      expect(agent.intents.length).toBeGreaterThan(0);
    }
  });

  test("support agent handles general intents", () => {
    const agent = agentRegistry.get("support")!;
    expect(agent.intents).toContain("question");
    expect(agent.intents).toContain("help");
    expect(agent.intents).toContain("unknown");
    expect(agent.intents).toContain("greeting");
  });

  test("sales agent handles commercial intents", () => {
    const agent = agentRegistry.get("sales")!;
    expect(agent.intents).toContain("pricing");
    expect(agent.intents).toContain("plans");
    expect(agent.intents).toContain("purchase");
  });

  test("ops agent handles operational intents", () => {
    const agent = agentRegistry.get("ops")!;
    expect(agent.intents).toContain("status");
    expect(agent.intents).toContain("automation");
    expect(agent.intents).toContain("system");
  });

  test("all agents have reasonable temperature settings", () => {
    for (const agentDef of agentRegistry.list()) {
      const agent = agentRegistry.get(agentDef.name)!;
      expect(agent.temperature).toBeGreaterThanOrEqual(0);
      expect(agent.temperature).toBeLessThanOrEqual(1);
    }
  });
});

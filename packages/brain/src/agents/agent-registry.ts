import { logger } from "../lib/logger.js";
import type { BaseAgent } from "./base-agent.js";
import { opsAgent } from "./ops-agent.js";
import { salesAgent } from "./sales-agent.js";
import { supportAgent } from "./support-agent.js";

class AgentRegistry {
  private agents = new Map<string, BaseAgent>();

  register(agent: BaseAgent): void {
    this.agents.set(agent.name, agent);
    logger.info("Agent registered", { agent: agent.name });
  }

  get(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  getOrDefault(name: string): BaseAgent {
    return this.agents.get(name) || supportAgent;
  }

  list(): Array<{ name: string; description: string; intents: string[] }> {
    return Array.from(this.agents.values()).map((a) => ({
      name: a.name,
      description: a.description,
      intents: a.intents,
    }));
  }

  has(name: string): boolean {
    return this.agents.has(name);
  }
}

export const agentRegistry = new AgentRegistry();

// Register built-in agents
agentRegistry.register(supportAgent);
agentRegistry.register(salesAgent);
agentRegistry.register(opsAgent);

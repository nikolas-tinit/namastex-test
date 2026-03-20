import { Hono } from "hono";
import { agentRegistry } from "../agents/agent-registry.js";

const agents = new Hono();

agents.get("/api/v1/agents", (c) => {
  return c.json({
    agents: agentRegistry.list(),
  });
});

export { agents };

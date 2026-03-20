import type { ProcessRequest, ProcessResponse } from "@namastex/contracts";
import { agentRegistry } from "./agents/agent-registry.js";
import type { AgentContext } from "./agents/base-agent.js";
import { reviewAgent } from "./agents/review-agent.js";
import { routerAgent } from "./agents/router-agent.js";
import { logger } from "./lib/logger.js";
import { sessionManager } from "./memory/session-manager.js";

export async function processMessage(request: ProcessRequest): Promise<ProcessResponse> {
  const startTime = Date.now();
  const { metadata } = request;
  const log = logger.child({ correlationId: metadata.correlationId });

  log.info("Processing message", {
    channel: metadata.channelType,
    user: metadata.senderName,
    chatType: metadata.chatType,
  });

  // 1. Get or create session
  const session = sessionManager.getOrCreate(metadata.personId, metadata.channelType, metadata.chatId);

  // 2. Add incoming messages to session
  const lastUserMessage = request.messages[request.messages.length - 1];
  if (lastUserMessage && lastUserMessage.role === "user") {
    sessionManager.addMessage(session, "user", lastUserMessage.content);
  }

  // 3. Build conversation history
  const conversationHistory = sessionManager.getConversationHistory(session);

  // 4. Build agent context
  const context: AgentContext = {
    request,
    session,
    conversationHistory,
  };

  // 5. Route to appropriate agent
  const routeDecision = await routerAgent.route(context);
  session.currentAgent = routeDecision.agent;
  session.currentIntent = routeDecision.intent;

  // 6. Execute the selected agent
  const agent = agentRegistry.getOrDefault(routeDecision.agent);
  log.info("Dispatching to agent", { agent: agent.name, intent: routeDecision.intent });

  const agentResult = await agent.execute(context);

  // 7. Review gate
  let reviewPassed = true;
  if (agent.reviewRequired) {
    const userText = lastUserMessage?.content || "";
    const reviewResult = await reviewAgent.review(userText, agentResult.response, {
      agent: agent.name,
      intent: routeDecision.intent,
      correlationId: metadata.correlationId,
    });
    reviewPassed = reviewResult.passed;

    if (!reviewPassed) {
      log.warn("Review rejected response", { issues: reviewResult.issues });
      // On review failure, use a safe fallback response
      agentResult.response =
        "Desculpe, não consegui gerar uma resposta adequada. Posso tentar novamente ou transferir para um atendente humano. Como prefere?";
    }
  }

  // 8. Add response to session
  sessionManager.addMessage(session, "assistant", agentResult.response);

  const processingTimeMs = Date.now() - startTime;
  log.info("Message processed", {
    agent: agent.name,
    intent: routeDecision.intent,
    reviewPassed,
    processingTimeMs,
    tokensUsed: agentResult.tokensUsed,
  });

  // 9. Build response
  return {
    response: agentResult.response,
    metadata: {
      correlationId: metadata.correlationId,
      agentUsed: agent.name,
      intent: routeDecision.intent,
      confidence: routeDecision.confidence,
      processingTimeMs,
      tokensUsed: agentResult.tokensUsed,
      reviewPassed,
      model: agentResult.model,
    },
    sessionUpdate: {
      context: {
        currentAgent: session.currentAgent,
        currentIntent: session.currentIntent,
        facts: session.facts,
        messageCount: session.messageCount,
      },
    },
  };
}

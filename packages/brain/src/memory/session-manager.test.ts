import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { sessionManager } from "./session-manager.js";

describe("SessionManager", () => {
  beforeEach(() => {
    sessionManager.reset();
  });

  afterEach(() => {
    sessionManager.stop();
  });

  test("creates new session", () => {
    const session = sessionManager.getOrCreate("user-1", "whatsapp", "chat-1");

    expect(session.sessionId).toMatch(/^sess_/);
    expect(session.userId).toBe("user-1");
    expect(session.channelType).toBe("whatsapp");
    expect(session.chatId).toBe("chat-1");
    expect(session.messageCount).toBe(0);
    expect(session.messages).toHaveLength(0);
  });

  test("returns same session for same user/channel/chat", () => {
    const s1 = sessionManager.getOrCreate("user-1", "whatsapp", "chat-1");
    const s2 = sessionManager.getOrCreate("user-1", "whatsapp", "chat-1");

    expect(s1.sessionId).toBe(s2.sessionId);
  });

  test("creates different sessions for different users", () => {
    const s1 = sessionManager.getOrCreate("user-1", "whatsapp", "chat-1");
    const s2 = sessionManager.getOrCreate("user-2", "whatsapp", "chat-1");

    expect(s1.sessionId).not.toBe(s2.sessionId);
  });

  test("creates different sessions for different channels", () => {
    const s1 = sessionManager.getOrCreate("user-1", "whatsapp", "chat-1");
    const s2 = sessionManager.getOrCreate("user-1", "discord", "chat-1");

    expect(s1.sessionId).not.toBe(s2.sessionId);
  });

  test("adds messages and updates count", () => {
    const session = sessionManager.getOrCreate("user-1", "whatsapp", "chat-1");

    sessionManager.addMessage(session, "user", "Hello");
    sessionManager.addMessage(session, "assistant", "Hi there!");

    expect(session.messageCount).toBe(2);
    expect(session.messages).toHaveLength(2);
    expect(session.messages[0].role).toBe("user");
    expect(session.messages[0].content).toBe("Hello");
    expect(session.messages[1].role).toBe("assistant");
    expect(session.messages[1].content).toBe("Hi there!");
  });

  test("conversation history returns role and content only", () => {
    const session = sessionManager.getOrCreate("user-1", "whatsapp", "chat-1");

    sessionManager.addMessage(session, "user", "Hello");
    sessionManager.addMessage(session, "assistant", "Hi!");

    const history = sessionManager.getConversationHistory(session);
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({ role: "user", content: "Hello" });
    expect(history[1]).toEqual({ role: "assistant", content: "Hi!" });
  });

  test("updates session properties", () => {
    const session = sessionManager.getOrCreate("user-1", "whatsapp", "chat-1");

    sessionManager.updateSession(session, {
      currentAgent: "sales",
      currentIntent: "pricing",
      facts: { name: "João" },
    });

    expect(session.currentAgent).toBe("sales");
    expect(session.currentIntent).toBe("pricing");
    expect(session.facts.name).toBe("João");
  });

  test("getStats returns correct counts", () => {
    sessionManager.getOrCreate("user-1", "whatsapp", "chat-1");
    sessionManager.getOrCreate("user-2", "discord", "chat-2");

    const session = sessionManager.getOrCreate("user-1", "whatsapp", "chat-1");
    sessionManager.addMessage(session, "user", "Hello");

    const stats = sessionManager.getStats();
    expect(stats.activeSessions).toBe(2);
    expect(stats.totalMessages).toBe(1);
  });
});

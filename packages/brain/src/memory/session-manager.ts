import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';

export interface SessionState {
  sessionId: string;
  userId: string;
  channelType: string;
  chatId: string;
  currentAgent?: string;
  currentIntent?: string;
  conversationSummary?: string;
  facts: Record<string, string>;
  messageCount: number;
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
  lastActivityAt: string;
  createdAt: string;
}

class SessionManager {
  private sessions = new Map<string, SessionState>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  start(): void {
    // Clean expired sessions every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    logger.info('Session manager started');
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /** Clear all sessions (for testing). */
  reset(): void {
    this.sessions.clear();
  }

  getOrCreate(userId: string, channelType: string, chatId: string): SessionState {
    const key = this.buildKey(userId, channelType, chatId);
    let session = this.sessions.get(key);

    if (session && this.isExpired(session)) {
      logger.debug('Session expired, creating new', { key });
      this.sessions.delete(key);
      session = undefined;
    }

    if (!session) {
      session = {
        sessionId: `sess_${crypto.randomUUID()}`,
        userId,
        channelType,
        chatId,
        facts: {},
        messageCount: 0,
        messages: [],
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      this.sessions.set(key, session);
      logger.debug('Session created', { key, sessionId: session.sessionId });
    }

    return session;
  }

  addMessage(session: SessionState, role: 'user' | 'assistant', content: string): void {
    session.messages.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });
    session.messageCount++;
    session.lastActivityAt = new Date().toISOString();

    // Keep only recent messages in memory
    if (session.messages.length > config.maxConversationHistory) {
      session.messages = session.messages.slice(-config.maxConversationHistory);
    }
  }

  getConversationHistory(session: SessionState): Array<{ role: 'user' | 'assistant'; content: string }> {
    return session.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
  }

  updateSession(session: SessionState, updates: Partial<SessionState>): void {
    Object.assign(session, updates);
    session.lastActivityAt = new Date().toISOString();
  }

  getStats(): { activeSessions: number; totalMessages: number } {
    let totalMessages = 0;
    for (const session of this.sessions.values()) {
      totalMessages += session.messageCount;
    }
    return { activeSessions: this.sessions.size, totalMessages };
  }

  private buildKey(userId: string, channelType: string, chatId: string): string {
    return `${userId}:${channelType}:${chatId}`;
  }

  private isExpired(session: SessionState): boolean {
    const lastActivity = new Date(session.lastActivityAt).getTime();
    return Date.now() - lastActivity > config.sessionTtlMs;
  }

  private cleanup(): void {
    let removed = 0;
    for (const [key, session] of this.sessions) {
      if (this.isExpired(session)) {
        this.sessions.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      logger.debug('Sessions cleaned up', { removed, remaining: this.sessions.size });
    }
  }
}

export const sessionManager = new SessionManager();

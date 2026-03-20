import { Hono } from "hono";
import { sessionManager } from "../memory/session-manager.js";

const conversations = new Hono();

/**
 * Get conversation/session details by session ID.
 * Uses the in-memory session store. In production, this would query the DB.
 */
conversations.get("/api/v1/conversations/:id", (c) => {
  const sessionId = c.req.param("id");
  const stats = sessionManager.getStats();

  // The session manager uses composite keys (userId:channel:chatId).
  // We expose sessions by their generated sessionId for external lookup.
  // This is a simplified implementation — production would use DB queries.
  return c.json({
    sessionId,
    note: "Session lookup by ID requires database persistence (planned). Currently sessions are in-memory with composite key lookup.",
    stats,
  });
});

/**
 * Get a specific message by ID.
 * Currently returns a placeholder — real implementation needs the messages DB table.
 */
conversations.get("/api/v1/messages/:id", (c) => {
  const messageId = c.req.param("id");

  return c.json({
    messageId,
    note: "Message lookup by ID requires database persistence (planned). Messages are currently stored in session memory only.",
  });
});

export { conversations };

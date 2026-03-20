import { Hono } from "hono";
import { channelManager } from "../channels/channel-manager.js";
import { metaCloudProvider } from "../channels/meta-cloud-provider.js";
import { twilioProvider } from "../channels/twilio-provider.js";
import { whatsappConfig } from "../channels/whatsapp-config.js";
import { handleWhatsAppMessage } from "../channels/whatsapp-bridge.js";
import { logger } from "../lib/logger.js";

const whatsappWebhooks = new Hono();
const log = logger.child({ module: "whatsapp-webhooks" });

// ============================================================
// Twilio WhatsApp Webhook
// POST /webhooks/whatsapp/twilio
// ============================================================

whatsappWebhooks.post("/webhooks/whatsapp/twilio", async (c) => {
  if (!whatsappConfig.enabled) {
    return c.json({ error: "WhatsApp is not enabled" }, 503);
  }

  const correlationId = c.get("correlationId") || crypto.randomUUID();
  log.info("Twilio WhatsApp webhook received", { correlationId });

  // Parse body — Twilio sends application/x-www-form-urlencoded
  let body: Record<string, string>;
  const contentType = c.req.header("content-type") || "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await c.req.parseBody();
    body = Object.fromEntries(
      Object.entries(formData).map(([k, v]) => [k, String(v)]),
    );
  } else {
    body = await c.req.json();
  }

  // Validate signature
  const headers: Record<string, string> = {};
  for (const [key, value] of c.req.raw.headers.entries()) {
    headers[key.toLowerCase()] = value;
  }

  if (!twilioProvider.validateSignature(body, headers)) {
    log.warn("Twilio webhook signature validation failed", { correlationId });
    return c.json({ error: "Invalid signature" }, 403);
  }

  // Parse inbound message
  const inbound = await twilioProvider.parseIncomingWebhook(body, headers);
  if (!inbound) {
    return c.json({ error: "Could not parse webhook payload" }, 400);
  }

  // Process async — Twilio expects a fast response
  // We respond with TwiML (empty) and process in background
  const processingPromise = handleWhatsAppMessage(inbound).catch((err) => {
    log.error("Background WhatsApp processing failed", {
      correlationId,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  // For Twilio, we can respond with empty TwiML to acknowledge
  // The actual response is sent via the API
  c.header("Content-Type", "text/xml");

  // Store the promise so tests can await it if needed
  (c as unknown as Record<string, unknown>).__processingPromise = processingPromise;

  return c.body("<Response></Response>");
});

// ============================================================
// Meta WhatsApp Cloud API Webhooks
// GET  /webhooks/whatsapp/meta  — webhook verification
// POST /webhooks/whatsapp/meta  — incoming messages
// ============================================================

whatsappWebhooks.get("/webhooks/whatsapp/meta", (c) => {
  const query: Record<string, string> = {};
  for (const [key, value] of new URL(c.req.url).searchParams.entries()) {
    query[key] = value;
  }

  const result = metaCloudProvider.verifyWebhook(query);
  if (result.valid && result.challenge) {
    // Meta expects the challenge string as plain text response
    return c.text(result.challenge);
  }

  return c.json({ error: "Verification failed" }, 403);
});

whatsappWebhooks.post("/webhooks/whatsapp/meta", async (c) => {
  if (!whatsappConfig.enabled) {
    return c.json({ error: "WhatsApp is not enabled" }, 503);
  }

  const correlationId = c.get("correlationId") || crypto.randomUUID();
  log.info("Meta Cloud WhatsApp webhook received", { correlationId });

  const rawBody = await c.req.text();
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  // Validate signature using raw body for proper HMAC calculation
  const headers: Record<string, string> = {};
  for (const [key, value] of c.req.raw.headers.entries()) {
    headers[key.toLowerCase()] = value;
  }

  if (!metaCloudProvider.validateSignature(rawBody, headers)) {
    log.warn("Meta webhook signature validation failed", { correlationId });
    return c.json({ error: "Invalid signature" }, 403);
  }

  // Parse inbound message
  const inbound = await metaCloudProvider.parseIncomingWebhook(body, headers);
  if (!inbound) {
    // Meta sends status updates too — acknowledge them without error
    return c.json({ status: "acknowledged" });
  }

  // Process async — Meta expects fast 200 response
  const processingPromise = handleWhatsAppMessage(inbound).catch((err) => {
    log.error("Background WhatsApp processing failed", {
      correlationId,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  (c as unknown as Record<string, unknown>).__processingPromise = processingPromise;

  return c.json({ status: "received" });
});

export { whatsappWebhooks };

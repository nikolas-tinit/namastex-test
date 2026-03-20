export const whatsappConfig = {
  enabled: process.env.WHATSAPP_ENABLED === "true",
  provider: (process.env.WHATSAPP_PROVIDER || "twilio") as "twilio" | "meta-cloud",

  // Twilio
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM || "",
    webhookSecret: process.env.TWILIO_WEBHOOK_SECRET || "",
  },

  // Meta Cloud API
  meta: {
    enabled: process.env.META_WHATSAPP_ENABLED === "true",
    appSecret: process.env.META_APP_SECRET || "",
    verifyToken: process.env.META_VERIFY_TOKEN || "",
    accessToken: process.env.META_ACCESS_TOKEN || "",
    phoneNumberId: process.env.META_PHONE_NUMBER_ID || "",
    businessAccountId: process.env.META_BUSINESS_ACCOUNT_ID || "",
    apiVersion: process.env.META_API_VERSION || "v21.0",
  },

  // General
  webhookBaseUrl: process.env.WEBHOOK_BASE_URL || "",
  defaultTenantId: process.env.DEFAULT_TENANT_ID || "default",
  defaultInstanceId: process.env.DEFAULT_INSTANCE_ID || "default",

  // Outbound
  sendTimeoutMs: Number(process.env.WHATSAPP_SEND_TIMEOUT_MS || 10000),
  maxRetries: Number(process.env.WHATSAPP_MAX_RETRIES || 2),
};

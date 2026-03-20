# Arquitetura — Integração WhatsApp

## Visão Geral

A integração WhatsApp do NamasteX segue o padrão **Provider Abstraction Layer**, onde cada provedor (Twilio, Meta Cloud API) implementa uma interface comum (`ChannelProvider`). Um `ChannelManager` gerencia os provedores, e um `WhatsApp Bridge` conecta as mensagens recebidas ao pipeline de orquestração do Brain.

---

## Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────────┐
│                         WHATSAPP CLOUD                              │
│   ┌──────────────────┐         ┌──────────────────────┐            │
│   │ Twilio Platform  │         │ Meta Cloud API       │            │
│   │ (WhatsApp Sandbox│         │ (WhatsApp Business)  │            │
│   │  ou Business)    │         │                      │            │
│   └────────┬─────────┘         └──────────┬───────────┘            │
└────────────┼──────────────────────────────┼────────────────────────┘
             │ POST webhook                  │ POST webhook
             │ (form-encoded)                │ (JSON)
             ▼                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BRAIN — WEBHOOK ROUTES (Hono)                    │
│                                                                     │
│   POST /webhooks/whatsapp/twilio    GET/POST /webhooks/whatsapp/meta│
│   ┌────────────────────────┐        ┌──────────────────────────┐   │
│   │ Parse form-encoded     │        │ GET: verify challenge    │   │
│   │ Validate signature     │        │ POST: parse JSON         │   │
│   │ Respond TwiML vazio    │        │ Validate signature       │   │
│   │ Process em background  │        │ Respond 200 rápido       │   │
│   └───────────┬────────────┘        │ Process em background    │   │
│               │                      └────────────┬─────────────┘   │
└───────────────┼───────────────────────────────────┼─────────────────┘
                │                                    │
                ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PROVIDERS (Camada de Abstração)                   │
│                                                                     │
│   ┌──────────────────────┐     ┌───────────────────────────┐       │
│   │ TwilioWhatsApp       │     │ MetaCloudWhatsApp         │       │
│   │ Provider             │     │ Provider                  │       │
│   │                      │     │                           │       │
│   │ • parseIncoming()    │     │ • parseIncoming()         │       │
│   │ • sendMessage()      │     │ • sendMessage()           │       │
│   │ • validateSignature()│     │ • validateSignature()     │       │
│   │ • getInfo()          │     │ • verifyWebhook()         │       │
│   └──────────┬───────────┘     │ • getInfo()               │       │
│              │                  └─────────────┬─────────────┘       │
│              │    implements ChannelProvider   │                     │
│              └──────────────┬─────────────────┘                     │
│                             ▼                                       │
│              ┌──────────────────────────┐                           │
│              │ ChannelManager           │                           │
│              │                          │                           │
│              │ • getActiveProvider()    │                           │
│              │ • sendWhatsAppMessage() │                           │
│              │ • getProvidersInfo()    │                           │
│              │ • isWhatsAppEnabled()   │                           │
│              └────────────┬─────────────┘                           │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    WHATSAPP BRIDGE                                   │
│                                                                     │
│   ┌────────────────────────────────────────────────────────────┐    │
│   │ handleWhatsAppMessage(inbound)                             │    │
│   │                                                            │    │
│   │ 1. inboundToProcessRequest() — converte para Brain format │    │
│   │ 2. processMessage(request)   — pipeline do Brain          │    │
│   │ 3. Build WhatsAppOutboundMessage                           │    │
│   │ 4. channelManager.sendWhatsAppMessage(outbound)            │    │
│   └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BRAIN PIPELINE (Orchestrator)                     │
│                                                                     │
│   ProcessRequest → Intent Classification → Agent Router             │
│   → Agent Execution → Review Gate → ProcessResponse                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Fluxo de Dados

### Mensagem Recebida (Inbound)

```
WhatsApp User
    │
    │  envia mensagem
    ▼
Provedor (Twilio / Meta)
    │
    │  dispara webhook HTTP
    ▼
Webhook Route (Hono)
    │
    │  1. Extrai body (form-encoded ou JSON)
    │  2. Monta headers normalizados
    │  3. Chama provider.validateSignature()
    │  4. Chama provider.parseIncomingWebhook()
    │  5. Retorna resposta rápida ao provedor
    │  6. Chama handleWhatsAppMessage() em background
    ▼
WhatsApp Bridge
    │
    │  1. inboundToProcessRequest() converte:
    │     WhatsAppInboundMessage → ProcessRequest
    │     - text → messages[0].content
    │     - userPhone → metadata.platformUserId
    │     - conversationId → metadata.chatId
    │     - provider profileName → metadata.senderName
    │
    │  2. processMessage(request) executa pipeline Brain
    │
    │  3. Monta WhatsAppOutboundMessage:
    │     - to: userPhone
    │     - text: brainResponse.response
    │     - provider: inbound.provider
    │
    │  4. channelManager.sendWhatsAppMessage(outbound)
    ▼
Channel Manager
    │
    │  seleciona provider pelo nome
    ▼
Provider.sendMessage()
    │
    │  Twilio: POST https://api.twilio.com/.../Messages.json
    │  Meta:   POST https://graph.facebook.com/v21.0/{phoneNumberId}/messages
    ▼
WhatsApp User recebe resposta
```

### Estrutura da Mensagem Normalizada (Inbound)

```typescript
WhatsAppInboundMessage {
  tenantId: "default"              // multi-tenant futuro
  provider: "twilio" | "meta-cloud"
  channel: "whatsapp"
  instanceId: "default"
  userId: "+5511999999999"         // número do usuário
  userPhone: "+5511999999999"
  conversationId: "whatsapp:+5511999999999"
  messageId: "SMxxxxxxx"           // ID do provedor
  timestamp: "2026-03-20T..."
  messageType: "text" | "image" | "audio" | ...
  text: "Olá, preciso de ajuda"
  media?: { url, mimeType, sha256, caption }
  rawPayload: { ... }             // payload original do provedor
  metadata: { profileName, waId, ... }
}
```

### Estrutura da Mensagem de Saída (Outbound)

```typescript
WhatsAppOutboundMessage {
  to: "+5511999999999"
  messageType: "text"
  text: "Olá! Como posso ajudar?"
  mediaUrl?: "https://..."
  replyToMessageId?: "wamid.xxx"  // para reply (só Meta)
  provider: "twilio" | "meta-cloud"
  channel: "whatsapp"
  metadata: { correlationId, agentUsed, intent }
}
```

---

## Camada de Abstração — Provider Interface

A interface `ChannelProvider` define o contrato que cada provedor deve implementar:

```typescript
interface ChannelProvider {
  parseIncomingWebhook(body: unknown, headers: Record<string, string>)
    : Promise<WhatsAppInboundMessage | null>;

  sendMessage(message: WhatsAppOutboundMessage)
    : Promise<{ success: boolean; providerMessageId?: string; error?: string }>;

  validateSignature(body: unknown, headers: Record<string, string>)
    : boolean;

  getProviderName(): string;
  getInfo(): ChannelProviderInfo;
}
```

**Arquivo**: `packages/contracts/src/channels/provider-interface.ts`

Cada provedor implementa essa interface com as especificidades de sua API:

| Aspecto | Twilio | Meta Cloud API |
|---------|--------|----------------|
| Formato do webhook | `application/x-www-form-urlencoded` | `application/json` |
| Campo do remetente | `From: whatsapp:+55...` | `entry[].changes[].value.messages[].from` |
| Campo da mensagem | `Body` | `entry[].changes[].value.messages[].text.body` |
| ID da mensagem | `MessageSid` | `entry[].changes[].value.messages[].id` |
| Assinatura | `X-Twilio-Signature` (HMAC-SHA1) | `X-Hub-Signature-256` (HMAC-SHA256) |
| Envio de resposta | POST REST API (Basic Auth) | POST Graph API (Bearer Token) |
| Verificação de webhook | N/A | GET com `hub.mode=subscribe` |

---

## Schemas Zod (Contratos)

Os schemas vivem em `packages/contracts/src/channels/whatsapp.ts` e são exportados pelo `@namastex/contracts`.

### WhatsAppMediaSchema

```
{
  url?: string
  mimeType?: string
  sha256?: string
  fileSize?: number
  caption?: string
}
```

### WhatsAppInboundMessageSchema

Campos obrigatórios: `userId`, `userPhone`, `conversationId`, `messageId`, `timestamp`, `messageType`
Campos com default: `tenantId` ("default"), `instanceId` ("default"), `channel` ("whatsapp")
Campos opcionais: `text`, `media`, `rawPayload`, `metadata`
Enum `provider`: `"twilio"` | `"meta-cloud"`
Enum `messageType`: `"text"` | `"image"` | `"audio"` | `"video"` | `"document"` | `"location"` | `"reaction"` | `"unknown"`

### WhatsAppOutboundMessageSchema

Campos obrigatórios: `to`, `provider`
Campos com default: `messageType` ("text"), `channel` ("whatsapp")
Campos opcionais: `text`, `mediaUrl`, `replyToMessageId`, `metadata`

### ChannelProviderInfoSchema

```
{
  name: string
  channel: string
  enabled: boolean
  status: "connected" | "disconnected" | "error"
}
```

---

## Configuração

Toda a configuração é centralizada em `packages/brain/src/channels/whatsapp-config.ts` e lida via variáveis de ambiente:

| Variável | Tipo | Default | Descrição |
|----------|------|---------|-----------|
| `WHATSAPP_ENABLED` | boolean | `false` | Habilita/desabilita canal WhatsApp |
| `WHATSAPP_PROVIDER` | string | `"twilio"` | Provedor ativo: `"twilio"` ou `"meta-cloud"` |
| `TWILIO_ACCOUNT_SID` | string | `""` | SID da conta Twilio |
| `TWILIO_AUTH_TOKEN` | string | `""` | Token de autenticação Twilio |
| `TWILIO_WHATSAPP_FROM` | string | `""` | Número WhatsApp de envio (Twilio) |
| `TWILIO_WEBHOOK_SECRET` | string | `""` | Secret para validação de webhooks |
| `META_APP_SECRET` | string | `""` | App Secret do Meta Developer |
| `META_VERIFY_TOKEN` | string | `""` | Token de verificação do webhook Meta |
| `META_ACCESS_TOKEN` | string | `""` | Access Token permanente da Meta |
| `META_PHONE_NUMBER_ID` | string | `""` | ID do número de telefone na Meta |
| `META_BUSINESS_ACCOUNT_ID` | string | `""` | ID da conta business |
| `META_API_VERSION` | string | `"v21.0"` | Versão da Graph API |
| `WEBHOOK_BASE_URL` | string | `""` | URL base para webhooks |
| `DEFAULT_TENANT_ID` | string | `"default"` | Tenant padrão |
| `DEFAULT_INSTANCE_ID` | string | `"default"` | Instância padrão |
| `WHATSAPP_SEND_TIMEOUT_MS` | number | `10000` | Timeout de envio (ms) |
| `WHATSAPP_MAX_RETRIES` | number | `2` | Número máximo de tentativas |

---

## Conexão com o Brain

### Roteamento no Hono

O `index.ts` do Brain monta as rotas de webhook WhatsApp junto com todas as outras rotas:

```
app.route("/", whatsappWebhooks);
```

### Middleware de Autenticação

Os paths dos webhooks WhatsApp (`/webhooks/whatsapp/twilio`, `/webhooks/whatsapp/meta`) são excluídos do `authMiddleware` padrão. Cada provedor faz sua própria validação de assinatura.

### Health Check

O endpoint `/health/deep` verifica o status do canal WhatsApp:
- Se `WHATSAPP_ENABLED=true`, reporta o status de cada provedor habilitado
- Se `WHATSAPP_ENABLED=false`, reporta `"WhatsApp disabled"` como status ok

### Endpoint de Canais

O endpoint `GET /api/v1/channels` lista todos os canais, incluindo:
- Status do provedor WhatsApp ativo
- Lista de todos os provedores registrados e seus status
- Canais suportados via Omni (Baileys, Discord, Telegram)

---

## Mapa de Arquivos

```
packages/
├── contracts/src/
│   ├── index.ts                          # Re-exporta schemas e tipos WhatsApp
│   └── channels/
│       ├── whatsapp.ts                   # Schemas Zod: Inbound, Outbound, Media, ProviderInfo
│       └── provider-interface.ts         # Interface ChannelProvider
│
└── brain/src/
    ├── index.ts                          # Monta whatsappWebhooks no app Hono
    ├── channels/
    │   ├── whatsapp-config.ts            # Configuração centralizada (env vars)
    │   ├── twilio-provider.ts            # Implementação TwilioWhatsAppProvider
    │   ├── meta-cloud-provider.ts        # Implementação MetaCloudWhatsAppProvider
    │   ├── whatsapp-bridge.ts            # Ponte: inbound → Brain → outbound
    │   └── channel-manager.ts            # Gerenciador de provedores
    ├── routes/
    │   ├── whatsapp-webhooks.ts          # Endpoints Hono para webhooks
    │   ├── channels.ts                   # GET /api/v1/channels
    │   └── health.ts                     # Health check com status WhatsApp
    └── middleware/
        └── auth.ts                       # Bypass auth para webhooks WhatsApp
```

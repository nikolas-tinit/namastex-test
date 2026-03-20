# Fluxo End-to-End — WhatsApp

Descrição completa do fluxo de uma mensagem WhatsApp desde o recebimento até a resposta, com referências a cada arquivo do código-fonte.

---

## Diagrama de Sequência

```
Usuário        WhatsApp       Provedor        Brain             LLM
(celular)      (app)          (Twilio/Meta)   (localhost:3000)  (OpenAI/Anthropic)
  │               │               │               │               │
  │──"Oi"────────→│               │               │               │
  │               │──webhook POST→│               │               │
  │               │               │──HTTP POST───→│               │
  │               │               │               │               │
  │               │               │  ┌────────────┤               │
  │               │               │  │ 1. Auth    │               │
  │               │               │  │ 2. Parse   │               │
  │               │               │  │ 3. Valida  │               │
  │               │               │←─┤ 4. Resp.   │               │
  │               │               │  │    rápida   │               │
  │               │               │  │            │               │
  │               │               │  │ (background)│               │
  │               │               │  │ 5. Bridge  │               │
  │               │               │  │ 6. Convert │               │
  │               │               │  │ 7. Process │──chat()──────→│
  │               │               │  │            │←─response─────│
  │               │               │  │ 8. Review  │──review()────→│
  │               │               │  │            │←─approved─────│
  │               │               │  │ 9. Send    │               │
  │               │               │  │            │               │
  │               │               │←─┤ API call   │               │
  │               │←──────────────│  └────────────┘               │
  │←──"Resposta"──│               │               │               │
```

---

## Etapas Detalhadas

### Etapa 1 — Webhook Recebido

**Arquivo**: `packages/brain/src/routes/whatsapp-webhooks.ts`

Quando uma mensagem chega no WhatsApp do usuário, o provedor (Twilio ou Meta) dispara um HTTP POST para o Brain.

**Twilio** (POST `/webhooks/whatsapp/twilio`):
- Content-Type: `application/x-www-form-urlencoded`
- Campos: `From=whatsapp:+5511...`, `Body=Oi`, `MessageSid=SM...`, `NumMedia=0`

**Meta** (POST `/webhooks/whatsapp/meta`):
- Content-Type: `application/json`
- Estrutura: `{ object: "whatsapp_business_account", entry: [{ changes: [{ value: { messages: [...] } }] }] }`

### Etapa 2 — Middleware de Autenticação

**Arquivo**: `packages/brain/src/middleware/auth.ts`

Os paths `/webhooks/whatsapp/twilio` e `/webhooks/whatsapp/meta` estão na lista `PROVIDER_AUTH_PATHS` e passam direto pelo `authMiddleware`. A autenticação é delegada para cada provedor via validação de assinatura.

### Etapa 3 — Validação de Assinatura

**Arquivos**:
- `packages/brain/src/channels/twilio-provider.ts` → `validateSignature()`
- `packages/brain/src/channels/meta-cloud-provider.ts` → `validateSignature()`

O webhook route extrai os headers e chama `provider.validateSignature(body, headers)`:
- **Twilio**: verifica `X-Twilio-Signature` (atualmente permissivo em dev)
- **Meta**: verifica `X-Hub-Signature-256` (atualmente permissivo em dev)

Se a validação falhar, retorna HTTP 403.

### Etapa 4 — Parse da Mensagem

**Arquivos**:
- `packages/brain/src/channels/twilio-provider.ts` → `parseIncomingWebhook()`
- `packages/brain/src/channels/meta-cloud-provider.ts` → `parseIncomingWebhook()`

O provedor converte o payload nativo para o formato normalizado `WhatsAppInboundMessage`:

```typescript
{
  tenantId: "default",
  provider: "twilio",           // ou "meta-cloud"
  channel: "whatsapp",
  instanceId: "default",
  userId: "+5511999999999",
  userPhone: "+5511999999999",
  conversationId: "whatsapp:+5511999999999",
  messageId: "SM123456",        // ou "wamid.xxx"
  timestamp: "2026-03-20T...",
  messageType: "text",
  text: "Oi",
  rawPayload: { ... },
  metadata: { profileName: "João", waId: "5511999999999" }
}
```

**Schema**: `packages/contracts/src/channels/whatsapp.ts` → `WhatsAppInboundMessageSchema`

### Etapa 5 — Resposta Rápida ao Provedor

**Arquivo**: `packages/brain/src/routes/whatsapp-webhooks.ts`

Antes de processar a mensagem pelo Brain (que pode levar 10-30s), o webhook retorna uma resposta imediata:
- **Twilio**: responde com TwiML vazio `<Response></Response>` (Content-Type: `text/xml`)
- **Meta**: responde com `{ status: "received" }` (HTTP 200)

O processamento continua em background via `handleWhatsAppMessage(inbound).catch(...)`.

### Etapa 6 — Conversão para ProcessRequest

**Arquivo**: `packages/brain/src/channels/whatsapp-bridge.ts` → `inboundToProcessRequest()`

A mensagem normalizada é convertida para o formato que o Brain entende (`ProcessRequest`):

```typescript
{
  messages: [{ role: "user", content: "Oi" }],
  metadata: {
    correlationId: "uuid-gerado",
    instanceId: "default",
    channelType: "whatsapp",
    chatId: "whatsapp:+5511999999999",
    chatType: "dm",
    personId: "+5511999999999",
    platformUserId: "+5511999999999",
    senderName: "João",         // ou o número se profileName não estiver disponível
    isGroup: false,
    messageId: "SM123456"
  },
  stream: false,
  timeout: 30000
}
```

**Schema**: `packages/contracts/src/index.ts` → `ProcessRequestSchema`

### Etapa 7 — Pipeline do Brain

**Arquivo**: `packages/brain/src/orchestrator.ts` → `processMessage()`

O `ProcessRequest` passa pelo pipeline completo do Brain:

1. **Load Context**: carrega sessão e histórico da conversa
2. **Classify Intent**: LLM classifica a intenção da mensagem
3. **Route to Agent**: `RouterAgent` seleciona o agente especialista (Support, Sales, Ops)
4. **Execute Agent**: agente gera resposta usando LLM com contexto
5. **Review Gate**: `ReviewAgent` valida a resposta (relevância, segurança, tom)
6. **Update Memory**: atualiza sessão com novo contexto

O resultado é um `ProcessResponse`:

```typescript
{
  response: "Olá! Como posso ajudar você hoje?",
  metadata: {
    correlationId: "uuid",
    agentUsed: "support",
    intent: "greeting",
    confidence: 0.95,
    processingTimeMs: 2500,
    tokensUsed: 350,
    reviewPassed: true
  }
}
```

### Etapa 8 — Construção da Mensagem de Saída

**Arquivo**: `packages/brain/src/channels/whatsapp-bridge.ts` → `handleWhatsAppMessage()`

A resposta do Brain é convertida para `WhatsAppOutboundMessage`:

```typescript
{
  to: "+5511999999999",
  messageType: "text",
  text: "Olá! Como posso ajudar você hoje?",
  provider: "twilio",          // mesmo provedor do inbound
  channel: "whatsapp",
  metadata: {
    correlationId: "uuid",
    agentUsed: "support",
    intent: "greeting"
  }
}
```

### Etapa 9 — Envio da Resposta

**Arquivos**:
- `packages/brain/src/channels/channel-manager.ts` → `sendWhatsAppMessage()`
- `packages/brain/src/channels/twilio-provider.ts` → `sendMessage()`
- `packages/brain/src/channels/meta-cloud-provider.ts` → `sendMessage()`

O `ChannelManager` roteia para o provedor correto, que faz a chamada HTTP:

**Twilio**:
```
POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json
Authorization: Basic {base64(SID:Token)}
Content-Type: application/x-www-form-urlencoded
Body: From=whatsapp:+14155238886&To=whatsapp:+5511999999999&Body=Olá!...
```

**Meta Cloud API**:
```
POST https://graph.facebook.com/v21.0/{phoneNumberId}/messages
Authorization: Bearer {accessToken}
Content-Type: application/json
Body: { messaging_product: "whatsapp", to: "5511999999999", type: "text", text: { body: "Olá!..." } }
```

Ambos implementam retry com backoff exponencial (até `WHATSAPP_MAX_RETRIES` tentativas) e timeout configurável (`WHATSAPP_SEND_TIMEOUT_MS`).

### Etapa 10 — Usuário Recebe Resposta

A mensagem chega no WhatsApp do usuário via o provedor. O tempo total (webhook recebido → resposta enviada) é logado como `totalTimeMs`.

---

## Como Testar Localmente

### Opção 1 — Com ngrok (teste real)

```bash
# Terminal 1: Brain
cd packages/brain && bun run dev

# Terminal 2: ngrok
ngrok http 3000

# Configure a URL do ngrok no provedor (Twilio ou Meta)
# Envie uma mensagem do WhatsApp
```

### Opção 2 — Com curl (teste simulado)

#### Simular Twilio

```bash
curl -X POST http://localhost:3000/webhooks/whatsapp/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp%3A%2B5511999999999&Body=Oi%20tudo%20bem&MessageSid=SM_TEST_123&NumMedia=0&ProfileName=Teste"
```

#### Simular Meta Cloud API

```bash
curl -X POST http://localhost:3000/webhooks/whatsapp/meta \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "BIZ_123",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": { "display_phone_number": "15551234567", "phone_number_id": "PN_123" },
          "contacts": [{ "profile": { "name": "Teste" }, "wa_id": "5511999999999" }],
          "messages": [{
            "from": "5511999999999",
            "id": "wamid.TEST123",
            "timestamp": "1710000000",
            "type": "text",
            "text": { "body": "Oi, tudo bem?" }
          }]
        },
        "field": "messages"
      }]
    }]
  }'
```

### Opção 3 — Verificar endpoints de status

```bash
# Health básico
curl http://localhost:3000/health

# Health detalhado com status WhatsApp
curl http://localhost:3000/health/deep

# Lista de canais
curl -H "x-api-key: SUA_API_KEY" http://localhost:3000/api/v1/channels
```

---

## Como Debugar

### Logs Estruturados

O Brain usa logging estruturado com child loggers por módulo. Os logs relevantes para WhatsApp são:

| Logger | Módulo | O que mostra |
|--------|--------|-------------|
| `provider: "twilio"` | Twilio provider | Parse de webhook, envio de mensagem |
| `provider: "meta-cloud"` | Meta provider | Parse de webhook, envio de mensagem |
| `module: "whatsapp-bridge"` | Bridge | Processamento E2E, tempos |
| `module: "whatsapp-webhooks"` | Routes | Recebimento de webhooks |

### Variável LOG_LEVEL

Configure `LOG_LEVEL=debug` no `.env` para ver logs mais detalhados, incluindo:
- Payloads raw recebidos
- Status updates ignorados (Meta)
- Detalhes de tentativas de envio

### ngrok Inspector

O ngrok fornece um inspector web em `http://127.0.0.1:4040` que mostra:
- Todas as requisições HTTP recebidas
- Headers e body de cada request
- Response status e body
- Replay de requests (útil para re-testar)

### Verificar Provedor Ativo

```bash
curl http://localhost:3000/health/deep | jq '.checks'
```

---

## Troubleshooting — Problemas Comuns

### Mensagem chega mas não é processada

**Sintoma**: Log mostra "webhook received" mas não "Processing WhatsApp message"

**Causas possíveis**:
1. `parseIncomingWebhook()` retornou `null` — verifique o formato do payload
2. Para Meta: pode ser um status update (não uma mensagem) — isso é esperado
3. Validação de assinatura falhou — verifique logs para "signature validation failed"

### Brain processa mas não envia resposta

**Sintoma**: Log mostra "Brain processed WhatsApp message" mas depois "Failed to send"

**Causas possíveis**:
1. Credenciais do provedor inválidas ou não configuradas
2. Token Meta expirado (tokens temporários duram 24h)
3. Timeout na chamada API do provedor (`WHATSAPP_SEND_TIMEOUT_MS`)
4. Número de destino inválido ou não registrado no WhatsApp

### Resposta demora muito (> 30s)

**Sintoma**: Mensagem é processada mas a resposta chega com grande delay

**Causas possíveis**:
1. LLM provider lento — verifique `processingTimeMs` nos logs
2. Múltiplos retries no envio — verifique logs do provider para erros
3. Pipeline de Review adicionando latência — considere `FEATURE_AGENT_REVIEW=false` para testes

### Webhook Meta não verifica

**Sintoma**: Meta Developer Portal mostra erro ao verificar webhook

**Causas possíveis**:
1. Brain não está rodando ou não é acessível via ngrok
2. `META_VERIFY_TOKEN` no `.env` diferente do configurado no portal
3. URL do webhook incorreta (deve ser `/webhooks/whatsapp/meta`)
4. ngrok expirou ou mudou de URL

### Erro "No WhatsApp provider available"

**Sintoma**: Log mostra "No WhatsApp provider available" ao tentar enviar

**Causas possíveis**:
1. `WHATSAPP_ENABLED=false` no `.env`
2. `WHATSAPP_PROVIDER` com valor inválido (deve ser `twilio` ou `meta-cloud`)
3. O provedor na mensagem outbound não corresponde a nenhum registrado

### Mensagem de mídia não processada

**Sintoma**: Usuário envia imagem/áudio e recebe resposta genérica

**Causa**: A implementação atual identifica o tipo de mídia mas não processa o conteúdo. O texto enviado ao Brain é `"[media message]"` quando não há texto/caption na mensagem de mídia. Isso é uma limitação conhecida.

---

## Referência de Arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `packages/contracts/src/channels/whatsapp.ts` | Schemas Zod (Inbound, Outbound, Media) |
| `packages/contracts/src/channels/provider-interface.ts` | Interface ChannelProvider |
| `packages/contracts/src/index.ts` | Re-exporta tipos e schemas |
| `packages/brain/src/channels/whatsapp-config.ts` | Configuração centralizada via env |
| `packages/brain/src/channels/twilio-provider.ts` | Provider Twilio |
| `packages/brain/src/channels/meta-cloud-provider.ts` | Provider Meta Cloud API |
| `packages/brain/src/channels/channel-manager.ts` | Gerenciador de provedores |
| `packages/brain/src/channels/whatsapp-bridge.ts` | Ponte inbound → Brain → outbound |
| `packages/brain/src/routes/whatsapp-webhooks.ts` | Endpoints webhook Hono |
| `packages/brain/src/routes/channels.ts` | GET /api/v1/channels |
| `packages/brain/src/routes/health.ts` | Health check com status WhatsApp |
| `packages/brain/src/middleware/auth.ts` | Bypass auth para webhooks |
| `packages/brain/src/index.ts` | Montagem das rotas no app |
| `.env.example` | Template de variáveis de ambiente |

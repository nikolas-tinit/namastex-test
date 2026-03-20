# Namastex Test

Integração entre uma camada de **Brain/Orchestrator** inspirada no Genie e uma camada de **Gateway/Contracts** para conexão com um hub omnichannel como o Omni.

## Visão geral

O projeto está organizado como um monorepo Bun/TypeScript com três pacotes principais:

- `@namastex/brain`: API Hono, orquestração, agentes, memória de sessão e integração com LLMs.
- `@namastex/contracts`: contratos compartilhados com Zod para requests, responses, health e mensagem unificada.
- `@namastex/gateway`: adapters Omni → Brain e Brain → Omni.

## O que já está implementado

### Brain

- API HTTP com Hono
- Middleware de autenticação, correlação, logging e tratamento de erro
- Orquestrador principal em `packages/brain/src/orchestrator.ts`
- Agentes iniciais:
  - `router-agent`
  - `support-agent`
  - `sales-agent`
  - `ops-agent`
  - `review-agent`
- Session manager em memóriaa
- Providers para Anthropic e OpenAI
- Endpoints administrativos e operacionais

### Gateway

- `OmniToBrainAdapter`
- `BrainToOmniAdapter`
- Cliente de integração

### Contracts

- `ProcessRequest`
- `ProcessResponse`
- `UnifiedMessage`
- `SessionState`
- contratos de health check e erros

### WhatsApp (ponta a ponta)

- Suporte a **Twilio** e **Meta WhatsApp Cloud API** como providers
- Escolha de provider por variável de ambiente (`WHATSAPP_PROVIDER`)
- Interface `ChannelProvider` genérica para extensibilidade
- Channel Manager para roteamento automático
- WhatsApp Bridge conectando webhook → Omni contracts → Brain pipeline → resposta
- Webhook async (responde 200 imediatamente, processa em background)
- Validação de assinatura HMAC-SHA256 (Meta) e HMAC-SHA1 (Twilio)
- Retry com backoff exponencial no envio outbound
- Health check com status do provider WhatsApp

### Documentação

A pasta `docs/` cobre:

- diagnóstico do Genie
- diagnóstico do Omni
- estratégia de integração
- arquitetura alvo
- eventos e contratos
- roadmap técnico
- observabilidade
- operação local e produção
- **diagnóstico WhatsApp**
- **arquitetura WhatsApp**
- **setup Twilio**
- **setup Meta Cloud API**
- **fluxo end-to-end WhatsApp**

## Estrutura

```text
.
├── docs/
├── packages/
│   ├── brain/
│   │   └── src/
│   │       ├── agents/          # Router, Support, Sales, Ops, Review
│   │       ├── channels/        # WhatsApp providers, bridge, config
│   │       ├── lib/             # Config, logger
│   │       ├── memory/          # Session manager
│   │       ├── middleware/      # Auth, CORS, correlation, error handler
│   │       ├── providers/       # LLM providers (Anthropic, OpenAI)
│   │       └── routes/          # HTTP endpoints
│   ├── contracts/               # Zod schemas compartilhados
│   │   └── src/channels/        # WhatsApp contracts
│   └── gateway/                 # Adapters Omni ↔ Brain
├── Dockerfile
├── docker-compose.yml
├── Makefile
└── package.json
```

## Endpoints atuais

### Health

- `GET /health`
- `GET /health/deep`

### Processamento

- `POST /api/v1/process`
- `POST /webhooks/omni/message-received`

### WhatsApp Webhooks

- `POST /webhooks/whatsapp/twilio` — Webhook do Twilio
- `GET /webhooks/whatsapp/meta` — Verificação do webhook Meta
- `POST /webhooks/whatsapp/meta` — Mensagens recebidas via Meta Cloud API

### Administração

- `POST /api/v1/admin/test-message`
- `GET /api/v1/agents`
- `GET /api/v1/channels`
- `GET /api/v1/conversations/:id`
- `GET /api/v1/messages/:id`

## Como rodar

### Pré-requisitos

- Bun
- Node.js apenas se quiser ferramentas auxiliares
- variáveis de ambiente para provedores LLM, se desejar respostas reais

### Instalação

```bash
bun install
```

### Desenvolvimento

```bash
make dev
```

ou

```bash
bun --watch packages/brain/src/index.ts
```

### Testes

```bash
make test
```

### Lint

```bash
make lint
```

### Typecheck

```bash
make typecheck
```

### Docker

```bash
docker compose up -d --build
```

## Variáveis de ambiente esperadas

Crie um `.env` na raiz com base no `.env.example`. Variáveis essenciais:

```env
# Brain
BRAIN_HOST=0.0.0.0
BRAIN_PORT=8890
BRAIN_API_KEY=brain-dev-key

# LLM (pelo menos uma)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# WhatsApp (opcional — para ativar canal real)
WHATSAPP_ENABLED=true
WHATSAPP_PROVIDER=twilio          # ou "meta-cloud"
WEBHOOK_BASE_URL=https://xxx.ngrok.io

# Twilio (se WHATSAPP_PROVIDER=twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Meta Cloud API (se WHATSAPP_PROVIDER=meta-cloud)
META_APP_SECRET=xxxxxxxx
META_VERIFY_TOKEN=meu-token-secreto
META_ACCESS_TOKEN=EAAxxxxxxxx
META_PHONE_NUMBER_ID=123456789
```

Consulte `.env.example` para a lista completa.

## Exemplo rápido

### Teste administrativo

```bash
curl -X POST http://localhost:8890/api/v1/admin/test-message \
  -H "Content-Type: application/json" \
  -H "x-api-key: brain-dev-key" \
  -d '{"text": "Olá, como funciona o sistema?"}'
```

### Webhook Omni

```bash
curl -X POST http://localhost:8890/webhooks/omni/message-received \
  -H "Content-Type: application/json" \
  -H "x-api-key: brain-dev-key" \
  -d '{
    "messages": [{"role": "user", "content": "Olá, preciso de ajuda"}],
    "metadata": {
      "channelType": "whatsapp-baileys",
      "instanceId": "test",
      "chatId": "5511999@s.whatsapp.net",
      "personId": "person-1",
      "platformUserId": "5511999@s.whatsapp.net",
      "senderName": "Test User"
    }
  }'
```

## WhatsApp — Quick Start

1. Configure as variáveis no `.env` (veja acima)
2. Inicie o servidor: `make dev`
3. Exponha com ngrok: `ngrok http 8890`
4. Configure o webhook URL no Twilio ou Meta:
   - Twilio: `https://xxx.ngrok.io/webhooks/whatsapp/twilio`
   - Meta: `https://xxx.ngrok.io/webhooks/whatsapp/meta`
5. Envie uma mensagem pelo WhatsApp e receba a resposta do agente

Documentação detalhada em:
- `docs/11-whatsapp-setup-twilio.md`
- `docs/12-whatsapp-setup-meta-cloud.md`
- `docs/13-whatsapp-fluxo-e2e.md`

## Validação do estado atual

### O que está alinhado com o objetivo

- separação clara entre brain, gateway e contracts
- pipeline completo Omni → Gateway → Brain → Agent → Response
- WhatsApp real via Twilio ou Meta Cloud API (ponta a ponta)
- agentes de suporte, vendas e operações com roteamento inteligente
- review gate para validação de respostas
- contrato compartilhado tipado com Zod
- health checks com status de providers
- testes unitários e de integração
- documentação completa


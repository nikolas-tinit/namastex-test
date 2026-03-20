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

## Estrutura

```text
.
├── docs/
├── packages/
│   ├── brain/
│   ├── contracts/
│   └── gateway/
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

Crie um `.env` na raiz com base nestes campos:

```env
BRAIN_HOST=0.0.0.0
BRAIN_PORT=8890
BRAIN_API_KEY=brain-dev-key
OMNI_API_KEY=
OMNI_BASE_URL=http://localhost:8882
OMNI_WEBHOOK_SECRET=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
BRAIN_DEFAULT_MODEL=claude-sonnet-4-20250514
BRAIN_ROUTER_MODEL=claude-haiku-4-5-20251001
BRAIN_REVIEW_MODEL=claude-haiku-4-5-20251001
BRAIN_MAX_HISTORY=20
BRAIN_SESSION_TTL_MS=3600000
BRAIN_SUMMARIZE_AFTER=20
BRAIN_LLM_TIMEOUT_MS=30000
BRAIN_PROCESS_TIMEOUT_MS=45000
BRAIN_REVIEW_ENABLED=true
LOG_LEVEL=info
```

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

## Validação do estado atual

### O que está alinhado com o objetivo

- separação clara entre brain, gateway e contracts
- pipeline básico Omni → Gateway → Brain → Agent → Response
- agentes iniciais implementados
- contrato compartilhado tipado com Zod
- health checks e rota de teste administrativo
- documentação inicial sólida


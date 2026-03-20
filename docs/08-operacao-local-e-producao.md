# Operação Local e Produção

## Pré-requisitos

- **Bun** 1.1.42+ (`curl -fsSL https://bun.sh/install | bash`)
- **API key** de pelo menos um LLM provider (Anthropic ou OpenAI)
- **Omni v2** rodando localmente (para integração completa)

---

## Setup Local — Brain (Standalone)

### 1. Instalar dependências
```bash
cd /srv/projects/namastex
bun install
```

### 2. Configurar ambiente
```bash
cp .env.example .env
# Edite .env e configure pelo menos ANTHROPIC_API_KEY ou OPENAI_API_KEY
```

### 3. Iniciar em modo desenvolvimento
```bash
make dev
# ou
bun --watch packages/brain/src/index.ts
```

### 4. Verificar saúde
```bash
make health
# ou
curl http://localhost:8890/health
```

### 5. Enviar mensagem de teste
```bash
make test-message
# ou
curl -X POST http://localhost:8890/api/v1/admin/test-message \
  -H "Content-Type: application/json" \
  -H "x-api-key: brain-dev-key" \
  -d '{"text": "Olá, como funciona o sistema?"}'
```

---

## Setup Local — Com Omni

### 1. Setup do Omni
```bash
cd omni
bun install
cp .env.example .env
# Configure DATABASE_URL, NATS_URL, etc.
make dev
# ou bun run dev
```

### 2. Registrar Brain como provider no Omni
Via CLI do Omni ou API:
```bash
# Via API do Omni
curl -X POST http://localhost:8882/api/v2/providers \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_OMNI_API_KEY" \
  -d '{
    "name": "Genie Brain",
    "schema": "webhook",
    "baseUrl": "http://localhost:8890/api/v1/process",
    "apiKey": "brain-dev-key",
    "defaultStream": false,
    "defaultTimeout": 30,
    "supportsStreaming": false,
    "description": "NamasteX orchestration brain"
  }'
```

### 3. Associar provider a uma instância
```bash
# Via API do Omni — vincular o provider ao instance de WhatsApp/Discord/etc
curl -X PATCH http://localhost:8882/api/v2/instances/{instanceId} \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_OMNI_API_KEY" \
  -d '{
    "agentProviderId": "{providerId}"
  }'
```

### 4. Testar fluxo ponta a ponta
1. Envie uma mensagem pelo canal conectado (WhatsApp, Discord, etc.)
2. O Omni recebe, normaliza e despacha para o Brain via webhook
3. O Brain classifica intenção, roteia para agente, gera resposta
4. A resposta volta pelo canal

---

## Testes

```bash
# Todos os testes
make test
# ou
bun test packages/contracts/src/ packages/gateway/src/ packages/brain/src/

# Testes específicos
bun test packages/brain/src/agents/
bun test packages/brain/src/memory/
bun test packages/gateway/src/
bun test packages/contracts/src/
```

---

## Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `make install` | Instalar dependências |
| `make dev` | Brain em dev mode (hot reload) |
| `make start` | Brain em produção |
| `make test` | Rodar testes |
| `make typecheck` | Verificação de tipos |
| `make lint` | Linting |
| `make health` | Health check |
| `make health-deep` | Health check detalhado |
| `make agents` | Listar agentes |
| `make test-message` | Enviar mensagem de teste |
| `make test-sales` | Testar roteamento para sales |
| `make test-ops` | Testar roteamento para ops |

---

## Produção

### Variáveis de Ambiente Obrigatórias
```
BRAIN_API_KEY=<strong-random-key>
ANTHROPIC_API_KEY=sk-ant-...
```

### Variáveis Recomendadas
```
LOG_LEVEL=info
BRAIN_REVIEW_ENABLED=true
BRAIN_LLM_TIMEOUT_MS=30000
```

### Deploy com PM2
```bash
pm2 start "bun packages/brain/src/index.ts" --name brain
pm2 save
```

### Deploy com Docker (futuro)
```dockerfile
FROM oven/bun:1.1.42
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/ packages/
RUN bun install --production
EXPOSE 8890
CMD ["bun", "packages/brain/src/index.ts"]
```

### Checklist de Produção
- [ ] API key forte e única para BRAIN_API_KEY
- [ ] ANTHROPIC_API_KEY configurada
- [ ] LOG_LEVEL=info (não debug)
- [ ] BRAIN_REVIEW_ENABLED=true
- [ ] Health check configurado no load balancer
- [ ] PM2 ou container com restart automático
- [ ] Monitoramento de logs configurado
- [ ] Backup strategy para sessões (futuro: persistência em DB)

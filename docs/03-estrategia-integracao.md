# Estratégia de Integração — Genie + Omni

## Decisão Arquitetural Principal

**Omni** permanece como plataforma principal (comunicação, eventos, persistência, API).
**Genie Brain** é um novo serviço de orquestração que implementa os conceitos do Genie como backend.

### Por que não usar o Genie CLI diretamente?

O Genie é um CLI que orquestra panes tmux. Transformá-lo em backend web requer reescrita completa. Em vez disso, extraímos seus **conceitos valiosos** (skills, roles, pipeline, review gates, council) e os implementamos como um serviço que se integra nativamente com o Omni.

---

## O Que Fica Onde

### Omni (Camada de Comunicação)
- Recepção de mensagens de todos os canais
- Normalização de mensagens
- Publicação de eventos (NATS JetStream)
- Persistência de mensagens e conversas
- Identity graph (Person + PlatformIdentity)
- Envio de respostas pelos canais
- Access control e rate limiting
- Media processing (transcrição, visão)
- API REST pública
- Dashboard web
- Agent provider registry
- Automations engine

### Genie Brain (Camada de Orquestração)
- Classificação de intenção
- Roteamento para agentes especializados
- Execução de agentes (Router, Support, Sales, Ops, Review)
- Memória de conversa e contexto
- Pipeline de decisão
- Review gate (validação de respostas)
- Provider fallback (OpenAI → Anthropic → webhook)
- Logs estruturados e observabilidade
- Configuração de agentes e comportamentos

### Gateway (Camada de Integração)
- Adapter Omni → Brain (traduz eventos Omni para formato interno)
- Adapter Brain → Omni (traduz respostas para formato Omni)
- Health checks cruzados
- Retry e circuit breaker

---

## Comunicação Entre Sistemas

### Fluxo Principal
```
Canal → Omni (message.received) → Agent Dispatcher → HTTP POST → Gateway → Brain
Brain → classifica intenção → seleciona agente → gera resposta
Brain → HTTP Response → Gateway → Omni → sendMessage → Canal
```

### Protocolo de Comunicação

**Síncrono (HTTP)**: O Omni já suporta agent providers via webhook. O Brain se registra como um provider webhook no Omni.

**Payload de entrada** (Omni → Brain):
```typescript
{
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    files?: Array<{ name: string; mimeType: string; url: string }>;
  }>;
  metadata: {
    correlationId: string;
    instanceId: string;
    channelType: string;
    chatId: string;
    personId: string;
    platformUserId: string;
    senderName: string;
    chatType: string;
    isGroup: boolean;
  };
  sessionData?: {
    sessionId: string;
    context: Record<string, unknown>;
  };
}
```

**Payload de saída** (Brain → Omni):
```typescript
{
  response: string;
  metadata: {
    agentUsed: string;
    intent: string;
    confidence: number;
    processingTimeMs: number;
    tokensUsed?: number;
    reviewPassed: boolean;
  };
  sessionUpdate?: {
    context: Record<string, unknown>;
  };
}
```

**Streaming**: Suporte a SSE (Server-Sent Events) quando `stream: true`.

---

## Contratos e Eventos

### Eventos Consumidos pelo Brain (via webhook)
- `message.received` → trigger principal
- `media.processed` → quando mídia é transcrita/descrita
- `session.reset` → limpar contexto

### Eventos que o Brain pode emitir (via API do Omni)
- Mensagens de resposta (POST /messages/send)
- Atualizações de sessão
- Métricas de agente

### Contrato Único de Mensagem

```typescript
interface UnifiedMessage {
  // Identificação
  tenantId: string;           // multi-tenant futuro
  channel: string;            // whatsapp | discord | telegram
  instanceId: string;         // instância Omni
  userId: string;             // personId do Omni
  conversationId: string;     // chatId do Omni
  messageId: string;          // id da mensagem

  // Conteúdo
  payload: {
    text: string;
    attachments?: Attachment[];
    metadata?: Record<string, unknown>;
  };

  // Processamento
  intent?: string;
  agent?: string;
  result?: {
    response: string;
    status: 'success' | 'error' | 'fallback' | 'review_failed';
    reviewPassed: boolean;
  };

  // Timestamps
  receivedAt: string;
  processedAt?: string;
  respondedAt?: string;
}
```

---

## Autenticação e Autorização

### Brain → Omni
- API key do Omni (já existente) para enviar respostas
- Scopes necessários: `messages:write`, `chats:read`, `persons:read`

### Omni → Brain
- API key compartilhada configurada como `BRAIN_API_KEY`
- Header `x-api-key` em todas as requests

### Futuro
- JWT tokens para multi-tenant
- OAuth2 para integrações externas
- RBAC para admin dashboard

---

## Versionamento

### API do Brain
- Versionada via path prefix: `/api/v1/`
- Breaking changes incrementam versão major
- Compatibilidade backwards por 1 versão

### Contratos
- Zod schemas compartilhados no package `@namastex/contracts`
- Schemas versionados junto com a API
- Testes de contrato automatizados

### Integração
- Omni referencia Brain por URL configurável (env `BRAIN_BASE_URL`)
- Brain referencia Omni por URL configurável (env `OMNI_BASE_URL`)
- Health checks cruzados verificam compatibilidade

---

## Extensibilidade

### Adicionar novo agente
1. Criar classe que implementa `BaseAgent` no Brain
2. Registrar no `AgentRegistry`
3. Configurar regras de roteamento

### Adicionar novo canal
1. Criar plugin no Omni (extends `BaseChannelPlugin`)
2. Nenhuma mudança no Brain necessária (normalização no Omni)

### Adicionar novo LLM provider
1. Criar adapter que implementa `LLMProvider` no Brain
2. Configurar via env ou admin API

### Adicionar nova automação
1. Usar Automations engine do Omni
2. Ou criar novo agente no Brain para lógica complexa

---

## Diagrama de Integração

```
┌──────────────────────────────────────────────────────────────────┐
│                        CANAIS EXTERNOS                          │
│  WhatsApp   Discord   Telegram   Slack   Webchat   API          │
└──────┬─────────┬─────────┬────────┬────────┬────────┬───────────┘
       │         │         │        │        │        │
       ▼         ▼         ▼        ▼        ▼        ▼
┌──────────────────────────────────────────────────────────────────┐
│                         OMNI v2                                  │
│  ┌─────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ Channel     │  │ Event    │  │ Identity │  │ Message      │ │
│  │ Plugins     │→ │ Bus      │→ │ Graph    │  │ Store        │ │
│  └─────────────┘  │ (NATS)   │  └──────────┘  └──────────────┘ │
│                    └────┬─────┘                                   │
│                         │ agent.dispatch                         │
│                    ┌────▼─────┐                                   │
│                    │ Agent    │                                   │
│                    │Dispatcher│──── webhook POST ────┐           │
│                    └──────────┘                      │           │
└─────────────────────────────────────────────────────┼───────────┘
                                                      │
                                                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                      GATEWAY / BRIDGE                            │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────────┐  │
│  │ Omni→Brain     │  │ Brain→Omni     │  │ Health / Retry    │  │
│  │ Adapter        │  │ Adapter        │  │ Circuit Breaker   │  │
│  └────────┬───────┘  └───────▲────────┘  └───────────────────┘  │
└───────────┼──────────────────┼──────────────────────────────────┘
            │                  │
            ▼                  │
┌──────────────────────────────────────────────────────────────────┐
│                       GENIE BRAIN                                │
│  ┌──────────┐  ┌───────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ Intent   │→ │ Agent     │→ │ Agent     │→ │ Review       │  │
│  │Classifier│  │ Router    │  │ Executor  │  │ Gate         │  │
│  └──────────┘  └───────────┘  └───────────┘  └──────┬───────┘  │
│                                                      │          │
│  ┌──────────┐  ┌───────────┐  ┌───────────┐         │          │
│  │ Memory   │  │ LLM       │  │ Session   │         │          │
│  │ Manager  │  │ Providers │  │ Manager   │◄────────┘          │
│  └──────────┘  └───────────┘  └───────────┘                    │
└──────────────────────────────────────────────────────────────────┘
```

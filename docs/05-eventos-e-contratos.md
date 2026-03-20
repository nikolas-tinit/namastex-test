# Eventos e Contratos

## Eventos do Fluxo Principal

### 1. message.received (Omni → NATS)
Emitido quando uma mensagem chega de qualquer canal.
```typescript
{
  eventType: 'message.received',
  metadata: {
    correlationId: string,
    instanceId: string,
    channelType: 'whatsapp-baileys' | 'discord' | 'telegram' | 'slack',
    personId: string,
    platformIdentityId: string,
  },
  payload: {
    messageId: string,
    chatId: string,
    chatType: 'dm' | 'group',
    senderPlatformUserId: string,
    senderDisplayName: string,
    messageType: 'text' | 'image' | 'audio' | 'video' | 'document',
    textContent: string,
    transcription?: string,
    imageDescription?: string,
    hasMedia: boolean,
    mediaUrl?: string,
    replyToMessageId?: string,
    quotedText?: string,
    mentions?: Array<{ platformUserId: string; displayName: string }>,
    platformTimestamp: string,
  }
}
```

### 2. Agent Dispatch (Omni → Brain via HTTP)
O agent dispatcher do Omni faz POST para o Brain.

**Request** `POST /api/v1/process`:
```typescript
{
  // Mensagens no formato chat (histórico recente)
  messages: Array<{
    role: 'user' | 'assistant',
    content: string,
    files?: Array<{
      name: string,
      mimeType: string,
      url: string,
    }>,
  }>,

  // Metadata do contexto
  metadata: {
    correlationId: string,
    instanceId: string,
    channelType: string,
    chatId: string,
    chatType: string,
    personId: string,
    platformUserId: string,
    senderName: string,
    isGroup: boolean,
    messageId: string,
  },

  // Sessão existente (se houver)
  sessionData?: {
    sessionId: string,
    context: Record<string, unknown>,
  },

  // Opções
  stream?: boolean,
  timeout?: number,
}
```

**Response** (sync):
```typescript
{
  response: string,
  metadata: {
    correlationId: string,
    agentUsed: string,
    intent: string,
    confidence: number,
    processingTimeMs: number,
    tokensUsed: number,
    reviewPassed: boolean,
    model: string,
  },
  sessionUpdate?: {
    context: Record<string, unknown>,
  },
}
```

**Response** (stream, SSE):
```
event: delta
data: {"content": "Olá! "}

event: delta
data: {"content": "Como posso "}

event: delta
data: {"content": "ajudar?"}

event: done
data: {"metadata": {"agentUsed": "support", "intent": "greeting", ...}}
```

### 3. message.sent (Omni interno)
Emitido quando Omni envia resposta pelo canal.

---

## Contratos Compartilhados

### UnifiedMessage
```typescript
interface UnifiedMessage {
  tenantId: string;
  channel: string;
  instanceId: string;
  userId: string;
  conversationId: string;
  messageId: string;
  payload: {
    text: string;
    attachments?: Array<{
      type: 'image' | 'audio' | 'video' | 'document';
      url: string;
      mimeType: string;
      name?: string;
      transcription?: string;
      description?: string;
    }>;
    metadata?: Record<string, unknown>;
  };
  intent?: string;
  agent?: string;
  result?: {
    response: string;
    status: 'success' | 'error' | 'fallback' | 'review_failed';
    reviewPassed: boolean;
  };
  timestamps: {
    receivedAt: string;
    processedAt?: string;
    respondedAt?: string;
  };
}
```

### AgentDefinition
```typescript
interface AgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  intents: string[];        // intents que este agente pode resolver
  priority: number;         // ordem de preferência (menor = maior prioridade)
  reviewRequired: boolean;  // se precisa passar pelo ReviewAgent
  fallbackAgent?: string;   // agente fallback se este falhar
}
```

### SessionState
```typescript
interface SessionState {
  sessionId: string;
  userId: string;
  channelType: string;
  chatId: string;
  currentAgent?: string;
  currentIntent?: string;
  conversationSummary?: string;
  facts: Record<string, string>;  // fatos extraídos (nome, email, etc)
  messageCount: number;
  lastActivityAt: string;
  createdAt: string;
}
```

### ProcessResult
```typescript
interface ProcessResult {
  success: boolean;
  response: string;
  agent: string;
  intent: string;
  confidence: number;
  reviewPassed: boolean;
  error?: string;
  processingTimeMs: number;
  tokensUsed: number;
}
```

---

## Error Contracts

```typescript
interface BrainError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  correlationId: string;
  timestamp: string;
}

// Error codes:
// INTENT_UNKNOWN     - não conseguiu classificar intenção
// AGENT_UNAVAILABLE  - agente selecionado não está disponível
// LLM_ERROR          - erro na chamada ao LLM
// LLM_TIMEOUT        - timeout na chamada ao LLM
// REVIEW_REJECTED    - review gate rejeitou a resposta
// SESSION_EXPIRED    - sessão expirou
// INVALID_REQUEST    - request malformado
// RATE_LIMITED       - rate limit atingido
// INTERNAL_ERROR     - erro interno não classificado
```

---

## Health Check Contract

**GET /health**
```typescript
{ status: 'ok', version: string, uptime: number }
```

**GET /health/deep**
```typescript
{
  status: 'ok' | 'degraded' | 'unhealthy',
  version: string,
  uptime: number,
  checks: {
    llm_anthropic: { status: 'ok' | 'error', latencyMs: number },
    llm_openai: { status: 'ok' | 'error', latencyMs: number },
    memory: { status: 'ok' | 'error', sessionsActive: number },
    agents: { status: 'ok', count: number },
  }
}
```

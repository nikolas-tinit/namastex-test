# Observabilidade

## Logs Estruturados

Todos os logs são emitidos em formato JSON via stdout, compatível com qualquer coletor (PM2, Datadog, ELK, etc).

### Formato
```json
{
  "timestamp": "2026-03-20T10:30:00.000Z",
  "level": "info",
  "message": "Message processed",
  "service": "brain",
  "correlationId": "uuid",
  "agent": "support",
  "intent": "greeting",
  "processingTimeMs": 1200,
  "tokensUsed": 150
}
```

### Campos padrão
| Campo | Descrição |
|-------|-----------|
| `timestamp` | ISO 8601 |
| `level` | debug, info, warn, error |
| `message` | Descrição do evento |
| `service` | "brain" |
| `correlationId` | ID de rastreamento ponta a ponta |

### Configuração
- `LOG_LEVEL=debug|info|warn|error` (default: info)
- Em desenvolvimento, use `LOG_LEVEL=debug` para ver detalhes de LLM

---

## Correlation ID & Trace ID

Toda request HTTP recebe automaticamente:
- `x-correlation-id`: Propaga desde o Omni ou gera novo
- `x-trace-id`: ID único da request

Ambos são retornados nos headers de resposta e incluídos em todos os logs do pipeline.

---

## Health Checks

### GET /health (Shallow)
Verifica se o serviço está respondendo.
```json
{ "status": "ok", "version": "0.1.0", "uptime": 3600 }
```

### GET /health/deep
Verifica todos os subsistemas.
```json
{
  "status": "ok|degraded|unhealthy",
  "version": "0.1.0",
  "uptime": 3600,
  "checks": {
    "llm_anthropic": { "status": "ok" },
    "llm_openai": { "status": "ok" },
    "memory": { "status": "ok", "details": "5 active sessions" },
    "agents": { "status": "ok", "details": "3 agents registered" }
  }
}
```

---

## Métricas (Futuro)

Planejado para Sprint 2:
- `brain_requests_total` (counter) — total de requests por agente/status
- `brain_request_duration_ms` (histogram) — latência por agente
- `brain_tokens_used_total` (counter) — tokens consumidos por provider
- `brain_sessions_active` (gauge) — sessões ativas
- `brain_review_rejections_total` (counter) — respostas rejeitadas

---

## Error Handling

Todos os erros são capturados pelo middleware `errorHandler`:
- Erros internos → HTTP 500 + log com stack trace
- Erros de validação → HTTP 400 + detalhes do Zod
- Erros de auth → HTTP 401
- Erros de LLM → HTTP 500 + tentativa de fallback

### Códigos de Erro
| Código | HTTP | Descrição |
|--------|------|-----------|
| INVALID_REQUEST | 400 | Body malformado |
| UNAUTHORIZED | 401 | API key inválida |
| INTENT_UNKNOWN | 500 | Router não classificou |
| AGENT_UNAVAILABLE | 500 | Agente não encontrado |
| LLM_ERROR | 500 | Falha no LLM provider |
| LLM_TIMEOUT | 500 | Timeout na chamada LLM |
| REVIEW_REJECTED | 200 | Resposta rejeitada (fallback enviado) |
| INTERNAL_ERROR | 500 | Erro genérico |

---

## Retry Policy

### Gateway → Brain
- Max retries: 2
- Backoff: exponencial (500ms, 1500ms)
- Client errors (4xx): não retenta
- Server errors (5xx): retenta
- Timeout: configurável (default 30s)

### LLM Provider Fallback
- Anthropic falha → tenta OpenAI
- OpenAI falha → erro
- Sem retry dentro do mesmo provider (evita custos duplicados)

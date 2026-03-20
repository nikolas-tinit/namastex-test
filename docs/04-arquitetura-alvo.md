# Arquitetura Alvo — NamasteX

## Visão Macro

```
A. Entrada         B. Eventos          C. Orquestração      D. Agentes
┌──────────┐      ┌──────────┐        ┌──────────┐         ┌──────────┐
│ WhatsApp │─┐    │ NATS     │        │ Intent   │    ┌───→│ Router   │
│ Discord  │─┤    │ JetStream│        │Classifier│    │    │ Support  │
│ Telegram │─┼───→│          │───────→│          │───→│    │ Sales    │
│ Slack    │─┤    │ Normalize│        │ Dispatch │    │    │ Ops      │
│ Webchat  │─┤    │ Dedupe   │        │ Pipeline │    └───→│ Review   │
│ API      │─┘    │ Persist  │        │ Review   │         └──────────┘
└──────────┘      └──────────┘        └──────────┘

E. LLM Providers   F. Memória           G. Admin
┌──────────┐      ┌──────────┐         ┌──────────┐
│ Anthropic│      │ Conversa │         │ Logs     │
│ OpenAI   │      │ Sessão   │         │ Tracing  │
│ Webhook  │      │ Contexto │         │ Health   │
│ Fallback │      │ Cache    │         │ Config   │
└──────────┘      └──────────┘         └──────────┘
```

---

## A. Camada de Entrada (Omni)

**Responsabilidade**: Receber mensagens de qualquer canal e normalizá-las.

| Canal | Tecnologia | Status |
|-------|-----------|--------|
| WhatsApp | Baileys (channel-whatsapp) | Produção |
| Discord | discord.js (channel-discord) | Produção |
| Telegram | grammy (channel-telegram) | Produção |
| Slack | Bolt SDK (channel-slack) | Em desenvolvimento |
| Webchat | Futuro (channel-webchat) | Planejado |
| API externa | REST endpoint | Planejado |

**Fluxo**:
1. Canal recebe mensagem nativa
2. Plugin normaliza para `OutgoingMessage`
3. Deduplicação (LRU cache)
4. Access control (blocklist/allowlist)
5. Emissão de evento `message.received` no NATS
6. Persistência na tabela `messages`
7. Identity resolution (platformUserId → personId)

---

## B. Camada de Eventos e Mensageria (Omni)

**Responsabilidade**: Hub de eventos com garantia de entrega.

**Tecnologia**: NATS JetStream

**Eventos principais do fluxo**:
```
message.received      → mensagem chegou de um canal
media.processed       → mídia transcrita/descrita
agent.dispatch        → request enviado ao brain
agent.task.completed  → brain respondeu
message.sent          → resposta enviada pelo canal
```

**Garantias**:
- Ack-based processing (confirmação após handler)
- Dead letter queue para falhas
- Replay por janela de tempo
- Idempotência via deduplicação de messageId

---

## C. Camada de Orquestração (Brain)

**Responsabilidade**: Decidir o que fazer com cada mensagem.

**Pipeline de processamento**:
```
Request recebido
    │
    ▼
┌─────────────────┐
│ Load Context    │  ← memória, sessão, histórico
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Classify Intent │  ← LLM classifica intenção
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Route to Agent  │  ← RouterAgent seleciona especialista
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Execute Agent   │  ← Agente gera resposta com contexto
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Review Gate     │  ← ReviewAgent valida antes de enviar
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Update Memory   │  ← Persiste contexto atualizado
└────────┬────────┘
         │
         ▼
Response enviado
```

**Modos de execução**:
- **Síncrono**: Request-response HTTP (< 30s)
- **Streaming**: SSE para respostas longas
- **Assíncrono**: Webhook callback para jobs longos (futuro)

---

## D. Camada de Agentes (Brain)

### RouterAgent
- Classifica intenção da mensagem
- Seleciona agente especialista
- Pode fazer sub-routing para questões compostas

### SupportAgent
- Responde dúvidas gerais
- Usa histórico da conversa
- Pode escalar para humano

### SalesAgent
- Responde questões comerciais
- Tom consultivo
- Sugere próximos passos e CTA

### OpsAgent
- Executa rotinas operacionais
- Retorna status estruturado
- Pode acionar automações do Omni

### ReviewAgent
- Valida respostas de outros agentes
- Checa:
  - Relevância (resposta condiz com pergunta?)
  - Segurança (sem informação sensível?)
  - Tom (adequado ao contexto?)
  - Completude (responde a pergunta?)
- Pode rejeitar e pedir re-generation

### Extensão futura
- AutomationAgent (executa workflows)
- SchedulerAgent (agenda tarefas)
- AnalyticsAgent (gera relatórios)

---

## E. Camada de LLM Providers (Brain)

```typescript
interface LLMProvider {
  name: string;
  chat(messages: ChatMessage[], options: LLMOptions): Promise<LLMResponse>;
  stream(messages: ChatMessage[], options: LLMOptions): AsyncGenerator<string>;
  isAvailable(): Promise<boolean>;
}
```

| Provider | Modelo Padrão | Uso |
|----------|--------------|-----|
| Anthropic | claude-sonnet-4-20250514 | Agentes principais |
| OpenAI | gpt-4o | Fallback |
| Webhook | Configurável | Provider genérico |

**Fallback chain**: Anthropic → OpenAI → Webhook → erro

---

## F. Camada de Memória e Estado (Brain + Omni DB)

### Memória de Conversa
- Últimas N mensagens da conversa (janela deslizante)
- Armazenada na tabela `messages` do Omni

### Resumo Contextual
- Resumo gerado periodicamente (a cada 20 mensagens)
- Armazenado como metadata na sessão

### Estado da Sessão
- Dados do agente atual (intent, agent, step)
- Armazenado na tabela `agentSessions` do Omni

### Memória Operacional
- Fatos extraídos da conversa (nome, preferências)
- Armazenado como JSON na sessão

### Cache
- LLM responses para queries idênticas (TTL curto)
- In-memory no Brain (Map com TTL)

---

## G. Camada Administrativa

### Já existente no Omni
- Dashboard web (React)
- API REST para configuração
- Event history e dead letters
- Instance management
- Agent provider config

### A ser adicionado
- Logs estruturados do Brain (JSON via stdout)
- Tracing com correlation_id
- Health checks do Brain
- Métricas de agentes (tempo, tokens, taxa de sucesso)
- Configuração de agentes via API

---

## Diagrama de Sequência — Fluxo Completo

```
Usuário    WhatsApp    Omni         NATS        Brain         LLM
  │           │         │            │            │             │
  │──msg────→│          │            │            │             │
  │           │──event──→│            │            │             │
  │           │         │──persist───→│            │             │
  │           │         │──publish───→│            │             │
  │           │         │            │──dispatch──→│             │
  │           │         │            │            │──context────→│
  │           │         │            │            │←─────────────│
  │           │         │            │            │──classify───→│
  │           │         │            │            │←─intent──────│
  │           │         │            │            │──generate───→│
  │           │         │            │            │←─response────│
  │           │         │            │            │──review─────→│
  │           │         │            │            │←─approved────│
  │           │         │            │←─response──│             │
  │           │         │←─send──────│            │             │
  │           │←─reply──│            │            │             │
  │←──msg─────│         │            │            │             │
```

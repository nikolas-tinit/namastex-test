# Roadmap Técnico

## Fase Atual — MVP Funcional

### Sprint 1: Integração Base
- [x] Diagnóstico dos repositórios
- [x] Documentação de arquitetura
- [x] Contratos e eventos definidos
- [x] Brain service com pipeline básico
- [x] Agent Gateway entre Omni e Brain
- [x] 5 agentes iniciais (Router, Support, Sales, Ops, Review)
- [x] Memória de conversa (in-memory com TTL)
- [x] API endpoints do Brain (process, agents, admin, webhooks, channels, conversations)
- [x] Health checks (shallow + deep)
- [x] Observabilidade básica (logs JSON, correlationId, traceId)
- [x] Testes (66 tests — contracts, adapters, agents, flow, webhooks, E2E)
- [x] Setup local (.env.example, Makefile, Dockerfile, docker-compose)
- [x] Webhook endpoint para Omni (POST /webhooks/omni/message-received)

### Sprint 2: Robustez (próximo)
- [x] Provider fallback automático (Anthropic → OpenAI)
- [x] Retry com backoff exponencial (gateway client)
- Circuit breaker
- Rate limiting por usuário
- Métricas Prometheus
- Dashboard de agentes no Omni UI
- Testes de carga

### Sprint 3: Inteligência (futuro)
- Memória de longo prazo
- Resumo contextual automático
- Extração de fatos da conversa
- Agent chaining (multi-step)
- Automações via OpsAgent
- Integração com ferramentas externas
- A/B testing de prompts

### Sprint 4: Escala (futuro)
- Multi-tenant
- Horizontal scaling do Brain
- Cache distribuído (Redis)
- Queue para jobs assíncronos
- Analytics e reporting
- Custom agent builder (low-code)
- Marketplace de agentes

---

## Decisões Técnicas

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Comunicação Omni↔Brain | HTTP webhook | Omni já suporta; simples e funcional |
| Runtime do Brain | Bun | Consistência com Omni; performance |
| Framework HTTP Brain | Hono | Consistência com Omni; leve |
| Memória de sessão | In-memory + Omni DB | Simplicidade para MVP; Omni já tem sessions |
| LLM SDK | @anthropic-ai/sdk + openai | SDKs oficiais; tipados |
| Validação | Zod | Consistência com ambos os projetos |
| Testes | bun:test | Consistência com ambos os projetos |
| Logs | JSON stdout | Padrão 12-factor; PM2 coleta |

# Diagnóstico — Omni

## Visão Geral

**Omni v2** (`omni-v2` v2.260317.3) é uma plataforma omnichannel de mensageria event-driven, construída como monorepo TypeScript. Fornece API unificada para enviar/receber mensagens em WhatsApp, Discord, Telegram e Slack com integração nativa de agentes AI.

Tagline: *"One API, Every Channel"*

## Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Linguagem | TypeScript |
| Runtime | Bun 1.1.42 |
| HTTP Server | Hono 4.6.17 |
| API Framework | tRPC 11.0 + OpenAPI |
| Database | PostgreSQL 17 (pgserve embedded) |
| ORM | Drizzle 0.38.4 |
| Event Bus | NATS JetStream 2.29.3 |
| Validação | Zod 3.24.1 |
| Frontend | React + Vite + Tailwind |
| Monorepo | Turborepo 2.3.3 + Bun workspaces |
| Observabilidade | Sentry 10.43 + Prometheus |
| Process Manager | PM2 |

## Padrão Arquitetural

Monolito modular event-driven com plugin architecture para canais. Todos os state changes emitem eventos via NATS JetStream.

## Pontos Fortes

1. **Arquitetura event-driven madura**: NATS JetStream com dead letter queue, replay, payload store
2. **Plugin system para canais**: `BaseChannelPlugin` extensível (WhatsApp, Discord, Telegram, Slack, A2A)
3. **Identity graph**: Person + PlatformIdentity unifica usuários across channels
4. **Agent system completo**: Providers, sessions, routing, streaming, tasks — tudo built-in
5. **API REST completa**: 25+ namespaces de endpoints com OpenAPI
6. **Schema DB robusto**: 2475 linhas de schema Drizzle com JSONB flexível
7. **Multi-provider agents**: Agno, Claude Code, OpenClaw, Webhook, A2A, **Genie** (já suportado!)
8. **Automations engine**: Rules-based event-driven workflows
9. **Media processing**: Transcrição, visão, extração de documentos
10. **SDKs auto-gerados**: TypeScript, Python, Go
11. **CLI completo**: `omni` CLI para operações
12. **Dashboard web**: React UI para administração

## Lacunas Identificadas

1. **Orquestração de agentes limitada**: Agent dispatch é 1:1 (mensagem → um provider). Falta orquestração multi-agente
2. **Sem roteamento por intenção**: Não classifica intenção antes de despachar para agente
3. **Sem review gate**: Respostas de agentes vão direto para o canal sem validação
4. **Sem memória operacional**: Sessions existem mas sem resumo contextual ou memória de longo prazo
5. **Sem pipeline de decisão**: Falta camada de planejamento entre receber mensagem e responder
6. **Agent fallback limitado**: Se um provider falha, não há fallback automático para outro
7. **Sem supervisor agent**: Falta agente que valide qualidade das respostas

## Componentes Existentes e Maduros

| Componente | Status | Qualidade |
|-----------|--------|-----------|
| Channel plugins | Produção | Alta |
| Event bus (NATS) | Produção | Alta |
| Agent dispatcher | Funcional | Média — falta orquestração |
| Agent providers | Funcional | Alta — extensível |
| Agent sessions | Funcional | Média — falta memória rica |
| Database schema | Produção | Alta |
| API REST | Produção | Alta |
| Identity graph | Produção | Alta |
| Media processing | Funcional | Média |
| Automations | Funcional | Média |
| Access control | Funcional | Alta |
| Health/metrics | Funcional | Média |

## Provider Schema "genie" Já Existente

O Omni **já tem** um provider schema chamado `genie` na tabela `agentProviders`. Isso indica que a integração entre os dois sistemas já foi planejada. O schema suporta:
- `baseUrl` para endpoint do Genie
- `schemaConfig` para configuração específica
- Streaming e timeout configuráveis

## Riscos Técnicos

1. **Complexidade do schema**: 2475 linhas de schema é muito para manter
2. **Dependência de pgserve embedded**: Pode ter limitações em produção de alto volume
3. **NATS como single point of failure**: Se NATS cair, toda comunicação para
4. **Baileys (WhatsApp)**: Biblioteca não-oficial, pode quebrar com updates do WhatsApp
5. **Event explosion**: 84 tipos de eventos podem gerar volume massivo

## Conclusão

O Omni é a **base técnica ideal** para a solução omnichannel. Já possui infraestrutura madura para canais, eventos, agentes e API. O que falta é a **camada de inteligência**: orquestração multi-agente, classificação de intenção, review gates, e memória operacional — exatamente o que o Genie conceitualmente oferece.

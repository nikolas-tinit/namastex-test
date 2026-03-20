# Diagnóstico — Genie

## Visão Geral

**Genie** (`@automagik/genie` v3.260318.7) é um toolkit CLI de terminal colaborativo para workflows humano + IA. Converte ideias vagas em PRs entregues através de orquestração colaborativa de agentes AI.

Tagline: *"Wishes in, PRs out"*

## Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Linguagem | TypeScript 5.8 |
| Runtime | Bun 1.3.10+ |
| CLI Framework | Commander.js 12.1 |
| Validação | Zod 3.25 |
| Terminal | tmux (multiplexação de panes) |
| Estado | JSON files no disco (com file locking) |
| LLM Providers | Claude Code CLI + Codex CLI |
| Testes | bun:test |
| Linting | Biome 1.9.4 |

## Padrão Arquitetural

Monolito CLI com command handlers modulares e biblioteca compartilhada. **Não é um servidor web** — toda interação é via comandos shell e tmux.

## Pontos Fortes

1. **Sistema de agentes bem definido**: Roles built-in (engineer, reviewer, qa, fix, refactor, trace, docs, learn) + council de 10 especialistas
2. **Pipeline de wishes estruturado**: brainstorm → wish → work → review → ship
3. **Skills como prompts markdown**: Sistema extensível de skills (brainstorm, wish, work, review, refine, brain, council, etc.)
4. **Isolamento via worktrees**: Cada agente trabalha em worktree git separado
5. **Estado com file locking**: Mutex baseado em arquivo para concorrência segura
6. **Messaging inter-agentes**: Mailbox + team chat (JSONL)
7. **State machine para wishes**: blocked → ready → in_progress → done com dependências
8. **Provider-agnostic**: Adapter pattern para Claude Code e Codex

## Lacunas Identificadas

1. **Sem API REST**: Não expõe endpoints HTTP — impossível integrar via webhook/API
2. **Sem banco de dados**: Todo estado é JSON no disco — não escala para multi-tenant
3. **Sem event bus**: Polling baseado em leitura de logs, não pub/sub real
4. **Sem autenticação**: Segurança via permissões de filesystem
5. **Sem suporte a canais de comunicação**: Focado exclusivamente em terminal/tmux
6. **Sem observabilidade**: Sem métricas, tracing, ou logs estruturados
7. **Dependência do tmux**: Agentes são panes tmux — não funciona como serviço
8. **Sem chamadas LLM diretas**: Delega tudo ao Claude Code CLI
9. **Single-tenant por design**: Um usuário, uma máquina

## Componentes Reutilizáveis

| Componente | Status | Reutilizável? |
|-----------|--------|--------------|
| Sistema de Skills (prompts) | Maduro | Sim — prompts markdown são portáveis |
| Definições de agentes/roles | Maduro | Sim — conceitos de roles são valiosos |
| State machine de wishes | Funcional | Parcialmente — lógica adaptável |
| File locking | Funcional | Não — será substituído por DB |
| Provider adapters | Funcional | Não — específico para CLIs |
| Pipeline brainstorm→ship | Conceitual | Sim — workflow é valioso |
| Council (multi-critic) | Maduro | Sim — padrão de validação cruzada |

## Riscos Técnicos

1. **Genie não é um serviço**: Transformá-lo em backend requer reescrita significativa
2. **Dependência de tmux**: Toda orquestração é baseada em panes de terminal
3. **Estado efêmero**: JSON files não suportam queries complexas
4. **Sem idempotência**: Operações de estado não são idempotentes
5. **Acoplamento ao Claude Code CLI**: Sem abstração para chamar LLMs diretamente

## Conclusão

O Genie é valioso como **fonte de conceitos e padrões**, não como backend direto. Seus skills, definições de agentes, pipeline de wishes e padrão de review gates são altamente reutilizáveis como inspiração arquitetural. A implementação técnica (tmux, JSON files, CLI-only) precisa ser reimplementada como serviço.

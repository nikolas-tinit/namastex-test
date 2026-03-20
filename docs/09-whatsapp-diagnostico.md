# Diagnóstico — Integração WhatsApp

## Visão Geral

A integração WhatsApp do NamasteX permite que o Brain receba e responda mensagens do WhatsApp de forma direta, sem depender do Omni como intermediário. O sistema suporta dois provedores (Twilio e Meta Cloud API) através de uma camada de abstração que permite trocar de provedor sem alterar a lógica de negócio.

## Status Atual

| Componente | Status | Observação |
|-----------|--------|------------|
| Contratos Zod (inbound/outbound) | Implementado | `@namastex/contracts` |
| Interface `ChannelProvider` | Implementado | Contrato comum para provedores |
| Provider Twilio | Implementado | Envio e recepção completos |
| Provider Meta Cloud API | Implementado | Envio e recepção completos |
| Channel Manager | Implementado | Seleção automática de provedor |
| WhatsApp Bridge | Implementado | Ponte inbound → Brain → outbound |
| Webhook Routes (Hono) | Implementado | Endpoints POST/GET para ambos provedores |
| Configuração centralizada | Implementado | `whatsapp-config.ts` via env vars |
| Auth middleware (bypass para webhooks) | Implementado | Webhooks WhatsApp passam pelo auth do provedor |
| Health check com status de canal | Implementado | `/health/deep` reporta status WhatsApp |
| Endpoint `/api/v1/channels` | Implementado | Lista provedores e status |

## O Que Foi Implementado

### 1. Camada de Contratos (`@namastex/contracts`)

- **`WhatsAppInboundMessageSchema`**: Define a estrutura normalizada de uma mensagem recebida, incluindo `tenantId`, `provider`, `channel`, `userId`, `userPhone`, `conversationId`, `messageId`, `timestamp`, `messageType` (text, image, audio, video, document, location, reaction, unknown), `text`, `media` e `rawPayload`.
- **`WhatsAppOutboundMessageSchema`**: Define a estrutura de uma mensagem a ser enviada, incluindo `to`, `messageType`, `text`, `mediaUrl`, `replyToMessageId` e `provider`.
- **`ChannelProviderInfoSchema`**: Status de cada provedor (name, channel, enabled, status).
- **`ChannelProvider` interface**: Contrato que todo provedor deve implementar (`parseIncomingWebhook`, `sendMessage`, `validateSignature`, `getProviderName`, `getInfo`).

### 2. Provedores

- **TwilioWhatsAppProvider**: Recebe webhooks `application/x-www-form-urlencoded` do Twilio, extrai campos como `From`, `Body`, `MessageSid`, `NumMedia`, `MediaUrl0`. Envia mensagens via REST API do Twilio com autenticação Basic (AccountSID + AuthToken).
- **MetaCloudWhatsAppProvider**: Recebe webhooks JSON da Meta Cloud API, faz parsing da estrutura `entry[].changes[].value.messages[]`. Suporta verificação de webhook (`hub.mode=subscribe`). Envia mensagens via Graph API com Bearer token. Suporta reply com `context.message_id`.

### 3. Infraestrutura

- **ChannelManager**: Singleton que registra os provedores e roteia mensagens de saída para o provedor correto baseado na configuração (`WHATSAPP_PROVIDER`).
- **WhatsApp Bridge**: Converte `WhatsAppInboundMessage` em `ProcessRequest` do Brain, executa o pipeline completo (orchestrator → router → agent → review) e envia a resposta de volta pelo provedor correto.
- **Webhook Routes**: Endpoints Hono com processamento assíncrono (resposta rápida ao provedor + processamento em background).

### 4. Segurança

- Webhooks WhatsApp são excluídos do `authMiddleware` padrão do Brain — cada provedor faz sua própria validação de assinatura.
- Twilio: valida `X-Twilio-Signature` (placeholder para validação HMAC completa).
- Meta: valida `X-Hub-Signature-256` (placeholder para validação HMAC-SHA256 completa).

## Decisões Arquiteturais

### 1. Integração Direta vs. Via Omni

A integração WhatsApp foi implementada **diretamente no Brain**, não passando pelo Omni. Isso significa que o Brain pode funcionar como servidor WhatsApp independente.

**Justificativa**: Permite deploy e teste do Brain isoladamente, sem precisar do Omni rodando. Quando o Omni estiver ativo, as mensagens WhatsApp podem chegar tanto via Omni (canais Baileys) quanto diretamente (Twilio/Meta Cloud API).

### 2. Provedor como Abstração

Em vez de acoplar a lógica ao Twilio ou Meta, foi criada uma interface `ChannelProvider` que ambos implementam. Isso permite:
- Trocar de provedor via variável de ambiente (`WHATSAPP_PROVIDER`)
- Adicionar novos provedores sem alterar o bridge ou as rotas
- Testar com mocks facilmente

### 3. Processamento Assíncrono nos Webhooks

Tanto Twilio quanto Meta exigem resposta rápida nos webhooks (< 5s). O processamento pelo Brain pode levar 10-30s (chamadas a LLMs). Por isso, os webhooks respondem imediatamente e processam a mensagem em background.

- Twilio: retorna TwiML vazio `<Response></Response>` e envia a resposta depois via API REST.
- Meta: retorna `{ status: "received" }` e envia a resposta depois via Graph API.

### 4. Schemas Compartilhados

Os contratos Zod vivem no package `@namastex/contracts`, garantindo que Brain e futuros consumidores usem as mesmas validações e tipos TypeScript.

## Limitações Conhecidas

### Validação de Assinatura Incompleta

Ambos os provedores têm validação de assinatura com TODOs para implementação completa:
- Twilio: falta validação HMAC usando `X-Twilio-Signature` conforme [documentação Twilio](https://www.twilio.com/docs/usage/security#validating-requests).
- Meta: falta validação HMAC-SHA256 usando `X-Hub-Signature-256` com `META_APP_SECRET`.

Em desenvolvimento, as requisições são aceitas mesmo sem assinatura válida.

### Sem Suporte a Templates (Meta)

A Meta Cloud API exige uso de templates para iniciar conversas (mensagens outbound fora da janela de 24h). A implementação atual só envia mensagens de texto livres, que funcionam apenas dentro da janela de conversa.

### Sem Download de Mídia

Mensagens de mídia (imagem, áudio, vídeo) são identificadas e registradas, mas o conteúdo da mídia não é baixado nem processado (transcrição de áudio, análise de imagem).

### Single-Provider Ativo

Apenas um provedor WhatsApp pode estar ativo por vez (`WHATSAPP_PROVIDER=twilio` ou `meta-cloud`). Não há suporte para múltiplos provedores simultâneos.

### Sem Persistência de Mensagens

As mensagens WhatsApp não são persistidas em banco de dados pelo Brain. O histórico depende da sessão em memória do `SessionManager`. Se o Brain reiniciar, o contexto da conversa é perdido.

### Sem Rate Limiting por Usuário

Não há rate limiting específico para mensagens WhatsApp por número de telefone. Um usuário pode enviar muitas mensagens e gerar muitas chamadas LLM.

### Sem Retry no Bridge

O `whatsapp-bridge.ts` não implementa retry caso o pipeline do Brain falhe. Se uma chamada LLM falhar, a mensagem fica sem resposta. O retry existe apenas no envio da mensagem de saída (dentro dos provedores).

## Conclusão

A integração WhatsApp está funcional para o fluxo completo de recepção e resposta de mensagens de texto, com ambos os provedores (Twilio e Meta Cloud API). As principais pendências são hardening de segurança (validação de assinatura) e features avançadas (templates, mídia, persistência). A arquitetura é extensível e bem abstraída, facilitando evolução futura.

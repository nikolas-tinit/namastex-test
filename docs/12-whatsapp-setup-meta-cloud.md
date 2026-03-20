# Setup WhatsApp — Meta Cloud API

Guia passo-a-passo para configurar a Meta WhatsApp Cloud API como provedor WhatsApp no NamasteX Brain.

---

## Pré-requisitos

- Node.js 18+ ou Bun 1.3+
- NamasteX Brain rodando localmente (porta 3000 por padrão)
- Uma conta Meta Developer (Facebook)
- ngrok ou similar para expor o servidor local à internet

---

## Passo 1 — Criar Conta de Desenvolvedor Meta

1. Acesse [developers.facebook.com](https://developers.facebook.com/)
2. Faça login com sua conta Facebook
3. Se for a primeira vez, aceite os termos de desenvolvedor e configure seu perfil

---

## Passo 2 — Criar App no Meta Developer Portal

1. No dashboard Meta Developer, clique em **"Create App"**
2. Selecione **"Other"** como caso de uso e clique em **"Next"**
3. Selecione **"Business"** como tipo de app
4. Preencha:
   - **App name**: `NamasteX WhatsApp` (ou o nome que preferir)
   - **App contact email**: seu e-mail
   - **Business Account**: selecione ou crie uma Business Account
5. Clique em **"Create App"**

---

## Passo 3 — Adicionar WhatsApp ao App

1. No painel do app, procure **"WhatsApp"** na lista de produtos
2. Clique em **"Set up"** no card do WhatsApp
3. O Meta irá provisionar automaticamente:
   - Um **número de teste** para desenvolvimento
   - Um **Phone Number ID**
   - Um **WhatsApp Business Account ID**
4. Anote esses valores — você os encontra em **WhatsApp** → **API Setup** no menu lateral

---

## Passo 4 — Gerar Access Token

### Token Temporário (desenvolvimento)

1. Em **WhatsApp** → **API Setup**, há um **Temporary access token**
2. Clique em **"Generate"** para criar um token
3. **Atenção**: este token expira em 24 horas

### Token Permanente (recomendado)

Para não precisar renovar o token diariamente:

1. Vá em **App Settings** → **Basic**
2. Anote o **App ID** e **App Secret**
3. Crie um System User no Business Manager:
   - Acesse [business.facebook.com/settings/system-users](https://business.facebook.com/settings/system-users)
   - Clique em **"Add"** → crie um System User com role **Admin**
   - Clique em **"Generate New Token"**
   - Selecione o app e as permissões: `whatsapp_business_management`, `whatsapp_business_messaging`
   - O token gerado não expira

---

## Passo 5 — Enviar Número de Teste para WhatsApp de Teste

1. Em **WhatsApp** → **API Setup** → **Send and receive messages**
2. Na seção **"To"**, adicione seu número de telefone de teste
3. Clique em **"Send Message"** para enviar a mensagem de teste padrão (template `hello_world`)
4. Verifique que recebeu a mensagem no seu WhatsApp

---

## Passo 6 — Configurar Variáveis de Ambiente

Copie o `.env.example` para `.env` (se ainda não fez) e configure:

```bash
cp .env.example .env
```

Edite o `.env`:

```bash
############################################
# WhatsApp
############################################
WHATSAPP_ENABLED=true
WHATSAPP_PROVIDER=meta-cloud

# Meta WhatsApp Cloud API
META_WHATSAPP_ENABLED=true
META_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
META_VERIFY_TOKEN=meu-token-de-verificacao-secreto
META_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
META_PHONE_NUMBER_ID=123456789012345
META_BUSINESS_ACCOUNT_ID=123456789012345
META_API_VERSION=v21.0
```

**Notas**:
- `META_APP_SECRET`: encontrado em **App Settings** → **Basic** → **App Secret** (clique em "Show")
- `META_VERIFY_TOKEN`: uma string que **você escolhe** — será usada para verificar o webhook
- `META_ACCESS_TOKEN`: o token temporário ou permanente gerado no Passo 4
- `META_PHONE_NUMBER_ID`: encontrado em **WhatsApp** → **API Setup**
- `META_BUSINESS_ACCOUNT_ID`: encontrado em **WhatsApp** → **API Setup**
- `META_API_VERSION`: versão da Graph API (mantenha `v21.0` ou use a mais recente)

---

## Passo 7 — Expor Servidor Local com ngrok

O Meta precisa enviar webhooks para uma URL pública HTTPS.

1. Instale o ngrok: [ngrok.com/download](https://ngrok.com/download)

2. Inicie o túnel:

```bash
ngrok http 3000
```

3. Anote a URL HTTPS, exemplo: `https://a1b2c3d4.ngrok-free.app`

---

## Passo 8 — Iniciar o Brain

```bash
cd packages/brain
bun run dev
```

Verifique que está rodando:

```bash
curl http://localhost:3000/health/deep
```

Deve mostrar:
```json
{
  "status": "ok",
  "checks": {
    "channel_meta-cloud": {
      "status": "ok",
      "details": "whatsapp via meta-cloud: connected"
    }
  }
}
```

---

## Passo 9 — Configurar Webhook no Meta Developer Portal

1. No painel do app Meta, vá em **WhatsApp** → **Configuration**
2. Na seção **Webhook**, clique em **"Edit"**
3. Preencha:
   - **Callback URL**: `https://a1b2c3d4.ngrok-free.app/webhooks/whatsapp/meta`
   - **Verify token**: o mesmo valor que você colocou em `META_VERIFY_TOKEN` no `.env`
4. Clique em **"Verify and save"**

O que acontece nesse momento:
- A Meta faz um **GET** para sua URL com `hub.mode=subscribe`, `hub.verify_token=seu-token` e `hub.challenge=xxxx`
- O Brain (via `MetaCloudWhatsAppProvider.verifyWebhook()`) valida o token e retorna o challenge
- Se tudo der certo, o webhook é verificado com sucesso

5. Após verificar, na seção **Webhook fields**, clique em **"Manage"**
6. Assine o campo **"messages"** — isso garante que o Meta envie notificações de mensagens recebidas

---

## Passo 10 — Testar Recepção de Mensagens

1. No seu WhatsApp pessoal, envie uma mensagem para o número de teste do Meta
2. Observe os logs do Brain:

```
[INFO] Meta Cloud WhatsApp webhook received { correlationId: "..." }
[INFO] Parsed Meta Cloud inbound message { phone: "5511...", messageId: "wamid.xxx", messageType: "text" }
[INFO] Processing WhatsApp message { provider: "meta-cloud", phone: "5511...", ... }
[INFO] Brain processed WhatsApp message { agent: "...", intent: "...", ... }
[INFO] Message sent via Meta Cloud API { to: "5511...", messageId: "wamid.xxx" }
[INFO] WhatsApp response sent { phone: "5511...", totalTimeMs: ... }
```

3. Você deve receber a resposta do Brain no WhatsApp

---

## Teste Rápido com curl

### Simular Verificação de Webhook

```bash
curl "http://localhost:3000/webhooks/whatsapp/meta?hub.mode=subscribe&hub.verify_token=meu-token-de-verificacao-secreto&hub.challenge=teste123"
```

Resposta esperada: `teste123`

### Simular Mensagem Recebida

```bash
curl -X POST http://localhost:3000/webhooks/whatsapp/meta \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "123456789",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "15551234567",
            "phone_number_id": "123456789012345"
          },
          "contacts": [{
            "profile": { "name": "Teste User" },
            "wa_id": "5511999999999"
          }],
          "messages": [{
            "from": "5511999999999",
            "id": "wamid.test123",
            "timestamp": "1710000000",
            "type": "text",
            "text": { "body": "Oi, preciso de ajuda!" }
          }]
        },
        "field": "messages"
      }]
    }]
  }'
```

Resposta esperada:
```json
{ "status": "received" }
```

---

## Troubleshooting

### Verificação do webhook falha

- Certifique-se de que o Brain está rodando e acessível via ngrok
- Verifique se o `META_VERIFY_TOKEN` no `.env` é exatamente igual ao que você colocou no Meta Developer Portal
- Teste o endpoint de verificação localmente com curl (ver seção de testes acima)
- Verifique os logs do Brain para mensagens de erro

### Status updates chegam mas mensagens não

- No Meta Developer Portal, verifique se o campo **"messages"** está assinado nos Webhook fields
- Status updates (entrega, leitura) são ignorados pelo provider — isso é comportamento esperado

### Erro 503 "WhatsApp is not enabled"

- Certifique-se de que `WHATSAPP_ENABLED=true` no `.env`
- Certifique-se de que `WHATSAPP_PROVIDER=meta-cloud` no `.env`
- Reinicie o Brain após alterar o `.env`

### Mensagem recebida mas sem resposta

- Verifique se `META_ACCESS_TOKEN` está válido (tokens temporários expiram em 24h)
- Verifique se `META_PHONE_NUMBER_ID` está correto
- Verifique se há pelo menos um LLM provider configurado
- Verifique os logs para erros da Graph API (status 400/401)

### Erro "Meta Cloud API credentials not configured"

- Verifique se `META_ACCESS_TOKEN` e `META_PHONE_NUMBER_ID` estão preenchidos
- Reinicie o Brain

### Token expirado (erro 401 na Graph API)

- Gere um novo token temporário no Meta Developer Portal
- Ou configure um token permanente via System User (ver Passo 4)

### Mensagem não chega ao número de teste

- Apenas números adicionados na seção "To" do API Setup podem receber mensagens em modo de desenvolvimento
- Adicione seu número e envie primeiro a mensagem de template para iniciar a conversa
- A Meta só permite envio de mensagens livres dentro da janela de 24h após a última mensagem do usuário

---

## Diferenças em Relação ao Twilio

| Aspecto | Twilio | Meta Cloud API |
|---------|--------|----------------|
| Configuração | Mais simples (sandbox pronto) | Mais passos (Developer Portal) |
| Token | Não expira (Auth Token) | Temporário expira em 24h |
| Webhook verification | Não necessária | GET challenge obrigatória |
| Formato do webhook | Form-encoded | JSON |
| Custo | Pay-per-message | Gratuito até limite |
| Números de teste | Sandbox compartilhado | Número próprio de teste |
| Para produção | Mais caro, mais simples | Mais barato, mais complexo |

---

## Próximos Passos

- Para produção, solicite aprovação do número WhatsApp Business na Meta
- Implemente validação completa do `X-Hub-Signature-256` (HMAC-SHA256)
- Configure templates para mensagens outbound fora da janela de 24h
- Configure `WEBHOOK_BASE_URL` com a URL permanente do servidor

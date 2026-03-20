# Setup WhatsApp — Twilio

Guia passo-a-passo para configurar o Twilio como provedor WhatsApp no NamasteX Brain.

---

## Pré-requisitos

- Node.js 18+ ou Bun 1.3+
- NamasteX Brain rodando localmente (porta 3000 por padrão)
- Uma conta Twilio (pode ser trial/gratuita para testes)
- ngrok ou similar para expor o servidor local à internet

---

## Passo 1 — Criar Conta no Twilio

1. Acesse [twilio.com/try-twilio](https://www.twilio.com/try-twilio) e crie uma conta gratuita
2. Verifique seu e-mail e número de telefone
3. No dashboard do Twilio, anote:
   - **Account SID**: visível no canto superior direito (começa com `AC...`)
   - **Auth Token**: clique para revelar, ao lado do Account SID

---

## Passo 2 — Ativar WhatsApp Sandbox

O Twilio oferece um **WhatsApp Sandbox** para desenvolvimento, que não requer aprovação da Meta.

1. No console Twilio, vá em **Messaging** → **Try it out** → **Send a WhatsApp message**
2. Ou acesse diretamente: [console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn)
3. O Twilio mostrará um número de sandbox (geralmente `+14155238886`) e um código de ativação
4. No seu WhatsApp pessoal, envie a mensagem de ativação (exemplo: `join <código>`) para o número do sandbox
5. Você verá uma confirmação de que está conectado ao sandbox

**Importante**: O sandbox Twilio requer que cada número de teste envie a mensagem de ativação. Em produção, você usaria um número aprovado pela Meta.

---

## Passo 3 — Configurar Variáveis de Ambiente

Copie o `.env.example` para `.env` (se ainda não fez) e configure as variáveis do Twilio:

```bash
cp .env.example .env
```

Edite o `.env` com os valores da sua conta:

```bash
############################################
# WhatsApp
############################################
WHATSAPP_ENABLED=true
WHATSAPP_PROVIDER=twilio

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_WEBHOOK_SECRET=uma-chave-secreta-qualquer
```

**Notas**:
- `TWILIO_ACCOUNT_SID`: seu Account SID do dashboard Twilio
- `TWILIO_AUTH_TOKEN`: seu Auth Token do dashboard Twilio
- `TWILIO_WHATSAPP_FROM`: o número do sandbox (com prefixo `whatsapp:`)
- `TWILIO_WEBHOOK_SECRET`: uma string qualquer que você definir (para segurança extra em dev)

---

## Passo 4 — Expor Servidor Local com ngrok

O Twilio precisa enviar webhooks para uma URL pública. Use o ngrok para criar um túnel:

1. Instale o ngrok: [ngrok.com/download](https://ngrok.com/download)

2. Inicie o túnel apontando para a porta do Brain:

```bash
ngrok http 3000
```

3. O ngrok mostrará uma URL pública, exemplo:

```
Forwarding  https://a1b2c3d4.ngrok-free.app → http://localhost:3000
```

4. Anote a URL HTTPS (exemplo: `https://a1b2c3d4.ngrok-free.app`)

**Dica**: Use `ngrok http 3000 --domain=seu-subdominio.ngrok-free.app` se tiver uma conta ngrok para manter a URL fixa.

---

## Passo 5 — Configurar Webhook URL no Twilio

1. No console Twilio, vá em **Messaging** → **Try it out** → **Send a WhatsApp message**
2. Na seção **Sandbox Settings** (ou acesse diretamente a configuração do sandbox)
3. No campo **"When a message comes in"**, coloque:

```
https://a1b2c3d4.ngrok-free.app/webhooks/whatsapp/twilio
```

4. Certifique-se de que o método está como **HTTP POST**
5. Clique em **Save**

---

## Passo 6 — Iniciar o Brain

Certifique-se de que o Brain está rodando:

```bash
cd packages/brain
bun run dev
```

Ou, da raiz do projeto:

```bash
bun run dev --filter=brain
```

Verifique que o Brain iniciou corretamente:

```bash
curl http://localhost:3000/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "version": "...",
  "uptime": ...
}
```

Verifique o status do canal WhatsApp:

```bash
curl http://localhost:3000/health/deep
```

Deve mostrar algo como:
```json
{
  "status": "ok",
  "checks": {
    "channel_twilio": {
      "status": "ok",
      "details": "whatsapp via twilio: connected"
    }
  }
}
```

---

## Passo 7 — Testar Recepção de Mensagens

1. No seu WhatsApp pessoal, envie uma mensagem para o número do sandbox Twilio (o mesmo que você ativou no Passo 2)
2. Observe os logs do Brain — você deve ver:

```
[INFO] Twilio WhatsApp webhook received { correlationId: "..." }
[INFO] Parsed Twilio inbound message { phone: "+55...", messageId: "SM...", messageType: "text" }
[INFO] Processing WhatsApp message { provider: "twilio", phone: "+55...", ... }
[INFO] Brain processed WhatsApp message { agent: "...", intent: "...", ... }
[INFO] Message sent via Twilio { to: "+55...", messageSid: "SM..." }
[INFO] WhatsApp response sent { phone: "+55...", totalTimeMs: ... }
```

3. Você deve receber a resposta do Brain no WhatsApp

---

## Passo 8 — Verificar no Terminal do ngrok

O ngrok mostra as requisições recebidas em seu dashboard local:

```
http://127.0.0.1:4040
```

Acesse essa URL no navegador para ver:
- As requisições POST que chegam do Twilio
- Os headers e body de cada requisição
- O status da resposta

---

## Teste Rápido com curl

Você pode simular um webhook do Twilio localmente (sem ngrok):

```bash
curl -X POST http://localhost:3000/webhooks/whatsapp/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp%3A%2B5511999999999&Body=Oi%2C%20tudo%20bem%3F&MessageSid=SM123456&NumMedia=0&AccountSid=ACxxx&ProfileName=Teste&WaId=5511999999999"
```

Resposta esperada:
```xml
<Response></Response>
```

O processamento acontece em background — verifique os logs para ver o resultado.

---

## Troubleshooting

### Webhook não chega

- Verifique se o ngrok está rodando e apontando para a porta correta
- Verifique se a URL no Twilio tem o path correto: `/webhooks/whatsapp/twilio`
- Verifique se o Brain está rodando na porta 3000
- Tente acessar `https://sua-url-ngrok.app/health` no navegador para confirmar que o túnel funciona

### Erro 503 "WhatsApp is not enabled"

- Certifique-se de que `WHATSAPP_ENABLED=true` no seu `.env`
- Reinicie o Brain após alterar o `.env`

### Erro 403 "Invalid signature"

- Em desenvolvimento, isso normalmente não acontece (a validação é permissiva)
- Se acontecer, verifique se `TWILIO_AUTH_TOKEN` está correto

### Mensagem recebida mas sem resposta

- Verifique os logs para erros no pipeline do Brain (LLM timeout, provider indisponível)
- Verifique se há pelo menos um LLM provider configurado (`OPENAI_API_KEY` ou `ANTHROPIC_API_KEY`)
- Verifique se `TWILIO_ACCOUNT_SID` e `TWILIO_AUTH_TOKEN` estão corretos (necessários para enviar a resposta)

### Erro "Twilio credentials not configured"

- Verifique se `TWILIO_ACCOUNT_SID` e `TWILIO_AUTH_TOKEN` estão preenchidos no `.env`
- O Brain precisa desses valores para enviar mensagens de resposta via API Twilio

### Sandbox expirado

- O sandbox Twilio expira após 72 horas de inatividade
- Reenvie a mensagem de ativação (`join <código>`) para reativar

---

## Próximos Passos

- Para produção, use um número WhatsApp Business aprovado pela Meta (via Twilio)
- Implemente validação completa da assinatura Twilio (HMAC-SHA1)
- Configure `WEBHOOK_BASE_URL` com a URL permanente do seu servidor
- Considere usar o provedor Meta Cloud API diretamente (ver `12-whatsapp-setup-meta-cloud.md`)

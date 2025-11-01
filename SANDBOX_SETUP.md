# Stripe Sandbox Setup Guide

Este guia explica como configurar e usar Sandboxes do Stripe para testar sua integração de forma isolada.

## 🌐 O que são Sandboxes?

Sandboxes são ambientes de teste isolados no Stripe que permitem:
- Testar funcionalidades sem afetar sua conta live
- Simular eventos sem movimentação real de dinheiro
- Testar com múltiplos desenvolvedores em ambientes separados
- Experimentar com novas features sem riscos

## 🚀 Criando um Sandbox

### Opção 1: Copiar configurações da conta

1. Acesse [Stripe Dashboard](https://dashboard.stripe.com/)
2. Clique no seletor de conta (canto superior direito)
3. Clique em **Sandboxes** > **Create sandbox**
4. Selecione **Copy your account**
5. Isso copiará settings e capabilities da sua conta live

**Settings copiados:**
- ✅ Payment methods habilitados
- ✅ Payouts settings
- ✅ Capital settings
- ✅ Financial Connections settings
- ✅ Account capabilities (payouts, Link, etc.)

**Settings NÃO copiados:**
- ❌ Domains (payment methods, customer portal, etc.)
- ❌ Webhook endpoints
- ❌ Automations
- ❌ Authorization webhooks (Issuing)
- ❌ Custom designs

### Opção 2: Criar do zero

1. Acesse **Sandboxes** > **Create sandbox**
2. Selecione **Create an account from scratch**
3. Configure manualmente todas as settings necessárias

## 🔑 Obter API Keys do Sandbox

Após criar o sandbox:

1. Abra o sandbox no Dashboard
2. Vá em **Developers** > **API keys**
3. Você verá keys específicas do sandbox (formato `sb_*` para secret keys)

**Formato das keys:**
- **Sandbox Secret Key**: `sb_...` (diferente de `sk_test_...`)
- **Sandbox Publishable Key**: `sbp_...` (diferente de `pk_test_...`)

## ⚙️ Configurar no Projeto

### 1. Variáveis de Ambiente para Sandbox

Adicione ao seu `.env.local`:

```env
# Sandbox Keys (use estas para desenvolvimento)
STRIPE_SECRET_KEY_SANDBOX=sb_...
NEXT_PUBLIC_STRIPE_PUBLIC_KEY_SANDBOX=sbp_...
STRIPE_WEBHOOK_SECRET_SANDBOX=whsec_...

# OU use as variáveis padrão se preferir
# STRIPE_SECRET_KEY=sb_...
# NEXT_PUBLIC_STRIPE_PUBLIC_KEY=sbp_...
# STRIPE_WEBHOOK_SECRET=whsec_...
```

### 2. Configurar Webhook no Sandbox

**IMPORTANTE**: Webhooks precisam ser configurados separadamente no sandbox!

1. Abra seu sandbox no Dashboard
2. Vá em **Developers** > **Webhooks**
3. Clique em **Add endpoint**
4. Configure a URL: `https://seu-dominio.com/api/stripe/webhook`
5. Ou use [Stripe CLI](https://stripe.com/docs/stripe-cli) para forwarding:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### 3. Configurar Features e Products no Sandbox

Execute o script de setup **dentro do sandbox**:

```bash
# Certifique-se de estar usando as keys do sandbox
STRIPE_SECRET_KEY=sb_... npx tsx scripts/setup-stripe-features.ts
```

Ou configure manualmente no Dashboard do sandbox.

## 🧪 Testando no Sandbox

### Test Cards

Use os mesmos test cards, mas agora no ambiente do sandbox:

- **Sucesso**: `4242 4242 4242 4242`
- **Requer autenticação**: `4000 0025 0000 3155`
- **Falha**: `4000 0000 0000 0002`

### Testando Entitlements

1. Crie uma subscription no sandbox
2. Verifique que entitlements são criados automaticamente
3. Teste o middleware bloqueando acesso Free
4. Verifique que webhooks são processados corretamente

### Simulando Eventos

Use o Stripe CLI para simular eventos:

```bash
# Simular subscription criada
stripe trigger customer.subscription.created

# Simular entitlement atualizado
stripe trigger entitlements.active_entitlement_summary.updated
```

## 🔄 Diferenças entre Sandbox, Test Mode e Live Mode

| Aspecto | Sandbox | Test Mode | Live Mode |
|---------|---------|-----------|-----------|
| **Keys** | `sb_*` / `sbp_*` | `sk_test_*` / `pk_test_*` | `sk_live_*` / `pk_live_*` |
| **Dinheiro** | Fake/Simulado | Fake/Simulado | Real |
| **Isolamento** | Completo | Parcial | N/A |
| **Múltiplos ambientes** | ✅ Sim | ❌ Não | ❌ Não |
| **Convidar usuários** | ✅ Sim | ❌ Não | ⚠️ Cuidado |
| **Webhooks** | Separados | Separados | Separados |

## 📋 Checklist de Configuração

- [ ] Sandbox criado no Stripe Dashboard
- [ ] API keys do sandbox obtidas
- [ ] Keys adicionadas ao `.env.local`
- [ ] Webhook configurado no sandbox
- [ ] Features criadas no sandbox (via script ou manualmente)
- [ ] Product e Price criados no sandbox
- [ ] Features anexadas ao Product
- [ ] Testado checkout com test cards
- [ ] Testado webhooks recebendo eventos
- [ ] Testado middleware bloqueando acesso

## 🔍 Troubleshooting

### Erro: "Invalid API Key"

- Verifique se está usando keys do sandbox (`sb_*`)
- Certifique-se que as keys estão corretas no `.env.local`
- Reinicie o servidor após mudar as keys

### Webhooks não funcionando

- Verifique se o webhook está configurado **no sandbox**, não na conta principal
- Use Stripe CLI para testar: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
- Verifique o webhook secret correto do sandbox

### Entitlements não aparecem

- Certifique-se que Features foram criadas **no sandbox**
- Verifique se Features estão anexadas ao Product **no sandbox**
- A subscription precisa estar ativa para entitlements serem criados

### "Subscription not found"

- Verifique se está consultando no sandbox correto
- Cada sandbox tem seus próprios customers e subscriptions
- Certifique-se que o webhook está sincronizando corretamente

## 💡 Dicas

1. **Use nomes descritivos**: Nomeie seus sandboxes claramente (ex: "Dev - João", "QA Testing")

2. **Isolamento**: Cada desenvolvedor pode ter seu próprio sandbox para evitar conflitos

3. **Reset fácil**: Você pode deletar e recriar sandboxes facilmente sem afetar produção

4. **Stripe CLI**: Use `stripe login --sandbox` para autenticar com um sandbox específico

5. **Dashboard Switch**: Use o seletor de conta no Dashboard para alternar rapidamente entre sandboxes

## 📚 Referências

- [Stripe Sandboxes Docs](https://docs.stripe.com/sandboxes)
- [Stripe Sandbox Settings](https://docs.stripe.com/sandboxes/dashboard/sandbox-settings)
- [Stripe Testing Guide](https://docs.stripe.com/testing)


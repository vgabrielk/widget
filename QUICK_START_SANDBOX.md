# 🚀 Quick Start - Sandbox Configurado

Se você já configurou as keys do sandbox no `.env.local`, siga estes passos:

## ✅ Verificar Configuração

Execute o script de verificação:

```bash
npx tsx scripts/verify-sandbox-setup.ts
```

Isso vai verificar:
- ✅ Se as keys estão configuradas corretamente
- ✅ Se a conexão com Stripe funciona
- ✅ Se features e products existem no sandbox

## 📋 Checklist Rápido

### 1. Features e Products ✅

Se o script mostrar que não há features, execute:

```bash
npx tsx scripts/setup-stripe-features.ts
```

Isso vai criar:
- 8 features (unlimited_messages, priority_support, etc.)
- Product "Plano Pro"
- Price de R$ 29,90/mês

### 2. Webhooks 🔗

**IMPORTANTE**: Webhooks precisam ser configurados separadamente no sandbox!

1. Abra seu sandbox no [Stripe Dashboard](https://dashboard.stripe.com/)
2. Vá em **Developers** > **Webhooks**
3. Clique em **Add endpoint**
4. Configure:
   - **URL**: `https://seu-dominio.com/api/stripe/webhook`
   - **Ou use Stripe CLI** (local development):
     ```bash
     stripe listen --forward-to localhost:3000/api/stripe/webhook
     ```
5. Selecione os eventos:
   - `entitlements.active_entitlement_summary.updated`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.created`
   - `customer.updated`
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
6. Copie o **Webhook signing secret** e adicione ao `.env.local`:
   ```env
   STRIPE_WEBHOOK_SECRET_SANDBOX=whsec_...
   ```

### 3. Testar a Integração 🧪

1. **Inicie o servidor**:
   ```bash
   npm run dev
   ```

2. **Acesse a página de billing**:
   - Faça login na aplicação
   - Vá para `/dashboard/billing`

3. **Teste o checkout**:
   - Clique em "Assinar Agora" no plano Pro
   - Use cartão de teste: `4242 4242 4242 4242`
   - Data: qualquer data futura (ex: 12/25)
   - CVC: qualquer 3 dígitos (ex: 123)

4. **Verifique**:
   - ✅ Modal de sucesso aparece após pagamento
   - ✅ Subscription aparece no Stripe Dashboard (no sandbox)
   - ✅ Entitlements são criados automaticamente
   - ✅ Usuário consegue acessar rotas protegidas

## 🔍 Troubleshooting Rápido

### "Invalid API Key"
- Verifique se está usando keys do sandbox (`sb_*`)
- Reinicie o servidor após mudar `.env.local`

### "Webhook signature verification failed"
- Verifique se `STRIPE_WEBHOOK_SECRET_SANDBOX` está configurado
- Use o webhook secret correto do **sandbox** (não da conta principal)

### "Features not found"
- Execute: `npx tsx scripts/setup-stripe-features.ts`
- Certifique-se de estar no sandbox correto no Dashboard

### "Subscription not recognized"
- Verifique se o webhook está processando eventos
- Verifique logs do servidor para eventos recebidos
- O middleware verifica diretamente na API do Stripe se não encontrar no banco

## 📚 Documentação Completa

- [SANDBOX_SETUP.md](./SANDBOX_SETUP.md) - Guia completo de sandboxes
- [STRIPE_ENTITLEMENTS_SETUP.md](./STRIPE_ENTITLEMENTS_SETUP.md) - Configuração de entitlements

## 🎉 Pronto!

Se tudo estiver configurado, sua integração está pronta para testar no sandbox! 

Lembre-se:
- ✅ Cada sandbox é isolado
- ✅ Você pode deletar e recriar sandboxes sem problemas
- ✅ Use test cards para simular pagamentos
- ✅ Webhooks precisam ser configurados em cada sandbox separadamente


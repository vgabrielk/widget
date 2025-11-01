# Stripe Entitlements Setup Guide

Este guia explica como configurar a integração completa de Stripe Entitlements para controlar o acesso aos recursos do seu SaaS.

## 📋 Visão Geral

A integração usa **Stripe Entitlements** para gerenciar acesso a funcionalidades baseado na assinatura do usuário. O sistema está configurado para:

- **Plano Free**: Acesso limitado (apenas página de billing)
- **Plano Pro**: Acesso completo a todas as funcionalidades

## 🚀 Configuração Inicial

### 1. Criar Features no Stripe

Execute o script de setup para criar todas as features necessárias:

```bash
npx tsx scripts/setup-stripe-features.ts
```

Ou crie manualmente no [Stripe Dashboard](https://dashboard.stripe.com/features):

**Features a criar:**
- `unlimited_messages` - Mensagens ilimitadas
- `priority_support` - Suporte prioritário
- `widget_customization` - Personalização de widgets
- `multiple_widgets` - Múltiplos widgets
- `advanced_analytics` - Analytics avançado
- `api_access` - Acesso à API
- `webhooks` - Webhooks
- `brand_removal` - Remoção de marca

### 2. Criar Product e Price

O script também criará automaticamente:
- **Product**: "Plano Pro"
- **Price**: R$ 29.90/mês (recurring monthly)

Ou crie manualmente no Stripe Dashboard e adicione todas as features acima ao produto.

### 3. Configurar Webhooks

Configure os seguintes eventos no [Stripe Webhooks Dashboard](https://dashboard.stripe.com/webhooks):

1. `entitlements.active_entitlement_summary.updated` - Quando entitlements mudam
2. `customer.subscription.created` - Quando uma subscription é criada
3. `customer.subscription.updated` - Quando uma subscription é atualizada
4. `customer.subscription.deleted` - Quando uma subscription é cancelada
5. `customer.created` - Quando um customer é criado
6. `customer.updated` - Quando um customer é atualizado
7. `checkout.session.completed` - Quando checkout é completado
8. `invoice.paid` - Quando uma invoice é paga
9. `invoice.payment_failed` - Quando pagamento falha

O endpoint do webhook é: `https://seu-dominio.com/api/stripe/webhook`

### 4. Variáveis de Ambiente

Adicione as seguintes variáveis ao seu `.env.local`:

**Opção A: Test Mode (test keys)**
```env
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PRICE_ID_PRO=price_...  # Opcional, se usar price fixo
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Opção B: Sandbox (recomendado para desenvolvimento)**
```env
STRIPE_SECRET_KEY_SANDBOX=sb_...
NEXT_PUBLIC_STRIPE_PUBLIC_KEY_SANDBOX=sbp_...
STRIPE_WEBHOOK_SECRET_SANDBOX=whsec_...
NEXT_PUBLIC_STRIPE_PRICE_ID_PRO=price_...  # Opcional, se usar price fixo
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Nota**: O código suporta ambos os formatos. Sandboxes oferecem isolamento completo entre desenvolvedores. Veja [SANDBOX_SETUP.md](./SANDBOX_SETUP.md) para mais detalhes.

## 📦 Como Funciona

### Fluxo de Checkout

1. Usuário clica em "Assinar Agora" no plano Pro
2. Sistema cria/recupera Stripe Customer
3. Cria Checkout Session com trial de 4 dias
4. Usuário completa pagamento no Stripe Checkout
5. Webhook processa eventos e sincroniza subscription
6. Entitlements são automaticamente criados no Stripe
7. Middleware verifica entitlements em cada requisição

### Middleware de Entitlements

O middleware (`lib/middleware/entitlements.ts`) verifica:

- Se usuário tem subscription ativa/trialing no banco
- Se não encontrou, verifica diretamente na API do Stripe
- Se usuário é Free e tenta acessar rota protegida, redireciona para `/dashboard/billing?upgrade=required`

### Verificação de Entitlements

O sistema verifica entitlements de duas formas:

1. **No banco de dados**: Verifica `stripe_subscriptions` para subscription ativa
2. **Na API do Stripe**: Se não encontrar no banco, consulta diretamente a API do Stripe
3. **Entitlements**: Busca entitlements ativos via `stripe.entitlements.activeEntitlements.list()`

## 🔧 Uso no Código

### Verificar Entitlements

```typescript
import { getUserEntitlements } from '@/lib/stripe/entitlements';

const entitlements = await getUserEntitlements(userId);

if (entitlements.isPro) {
  // Usuário tem acesso Pro
}

if (entitlements.hasFeature('unlimited_messages')) {
  // Usuário tem acesso a mensagens ilimitadas
}
```

### Verificar Acesso a Rota

```typescript
import { hasRouteAccess, getUserEntitlements } from '@/lib/stripe/entitlements';

const entitlements = await getUserEntitlements(userId);

if (!hasRouteAccess(pathname, entitlements)) {
  // Usuário não tem acesso
}
```

## 🧪 Testando

### Cards de Teste Stripe

Use os seguintes cards de teste:

- **Sucesso**: `4242 4242 4242 4242`
- **Requer autenticação**: `4000 0025 0000 3155`
- **Falha**: `4000 0000 0000 0002`

### Cenários de Teste

1. **Novo usuário assinando**:
   - Acesse `/dashboard/billing`
   - Clique em "Assinar Agora" no plano Pro
   - Complete o checkout
   - Verifique se aparece modal de sucesso
   - Verifique se consegue acessar rotas protegidas

2. **Usuário Free tentando acessar rota protegida**:
   - Faça login como usuário sem subscription
   - Tente acessar qualquer rota do dashboard (exceto billing)
   - Deve ser redirecionado para `/dashboard/billing?upgrade=required`
   - Deve aparecer banner de upgrade necessário

3. **Verificar entitlements**:
   - Após assinar, verifique no Stripe Dashboard que entitlements foram criados
   - Verifique logs do webhook para eventos processados

## 📝 Features Disponíveis

As features estão definidas em `lib/stripe/entitlements.ts`:

```typescript
export const FEATURES = {
  UNLIMITED_MESSAGES: 'unlimited_messages',
  PRIORITY_SUPPORT: 'priority_support',
  WIDGET_CUSTOMIZATION: 'widget_customization',
  MULTIPLE_WIDGETS: 'multiple_widgets',
  ADVANCED_ANALYTICS: 'advanced_analytics',
  API_ACCESS: 'api_access',
  WEBHOOKS: 'webhooks',
  BRAND_REMOVAL: 'brand_removal',
} as const;
```

## 🔍 Troubleshooting

### Subscription não está sendo reconhecida

1. Verifique se o webhook está configurado corretamente
2. Verifique logs do webhook em `app/api/stripe/webhook/route.ts`
3. Verifique se a subscription está na tabela `stripe_subscriptions`
4. O middleware verifica diretamente na API do Stripe se não encontrar no banco

### Entitlements não estão sendo criados

1. Verifique se o Product tem as Features anexadas no Stripe Dashboard
2. Verifique se a subscription foi criada corretamente
3. Verifique logs para eventos `entitlements.active_entitlement_summary.updated`

### Erro ao criar checkout

1. Verifique se `STRIPE_SECRET_KEY` está configurado
2. Verifique se o widget existe (sistema cria automaticamente se não existir)
3. Verifique se não há subscription ativa duplicada

## 📚 Referências

- [Stripe Entitlements Docs](https://docs.stripe.com/billing/entitlements)
- [Stripe Subscriptions Docs](https://docs.stripe.com/billing/subscriptions)
- [Stripe Checkout Docs](https://docs.stripe.com/checkout)
- [Stripe Sandboxes Setup](./SANDBOX_SETUP.md) - Guia completo para usar sandboxes
- [Stripe Sandboxes Docs](https://docs.stripe.com/sandboxes)


# 🚨 CORREÇÃO URGENTE DE SEGURANÇA

## Problema Detectado

Você está usando uma **LIVE secret key** (`sk_live_*`) em desenvolvimento, o que pode causar:
- ✅ **Cobranças reais** em cartões de teste
- ✅ **Dados reais** sendo criados na conta Stripe
- ✅ **Risco de cobranças acidentais**

## ⚠️ AÇÃO IMEDIATA NECESSÁRIA

### 1. Remover LIVE Key

No seu `.env.local`, você precisa **remover ou comentar** a live key:

```env
# ❌ REMOVA OU COMENTE ESTA LINHA:
# STRIPE_SECRET_KEY=sk_live_...

# ✅ USE TEST KEYS:
STRIPE_SECRET_KEY=sk_test_...  # Substitua com sua TEST key
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_...  # Já está correto
STRIPE_WEBHOOK_SECRET=whsec_...  # Já está correto
```

### 2. Obter TEST Keys

1. Acesse: https://dashboard.stripe.com/test/apikeys
2. Certifique-se de estar no modo **TEST** (toggle no canto superior direito)
3. Copie a **Secret key** (deve começar com `sk_test_`)
4. Copie a **Publishable key** (deve começar com `pk_test_`)

### 3. Atualizar .env.local

```env
# TEST Keys (desenvolvimento)
STRIPE_SECRET_KEY=sk_test_YOUR_TEST_KEY_HERE
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_YOUR_TEST_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE

# Opcional: Se quiser usar Sandbox depois
# STRIPE_SECRET_KEY_SANDBOX=sb_...
# NEXT_PUBLIC_STRIPE_PUBLIC_KEY_SANDBOX=sbp_...
# STRIPE_WEBHOOK_SECRET_SANDBOX=whsec_...
```

### 4. Reiniciar o Servidor

Após atualizar o `.env.local`:
```bash
# Pare o servidor (Ctrl+C)
# Reinicie:
npm run dev
```

## 🔒 Proteção Adicionada

O código agora tem uma proteção que:
- ✅ **Bloqueia** o uso de live keys em desenvolvimento
- ✅ **Lança erro** se detectar live keys fora de produção
- ✅ **Avisa** antes de usar keys perigosas

## ✅ Verificar Correção

Execute novamente:
```bash
npx tsx scripts/check-env-keys.ts
```

Deve mostrar:
- ✅ TEST keys configuradas
- ✅ Sem live keys
- ✅ Keys do mesmo tipo (test + test)

## 📝 Próximos Passos

Após corrigir:
1. ✅ Verifique: `npx tsx scripts/check-env-keys.ts`
2. ✅ Configure webhooks com test keys
3. ✅ Execute: `npx tsx scripts/setup-stripe-features.ts`
4. ✅ Teste a integração

## 🔐 Boas Práticas

- ✅ **NUNCA** commite keys no git (já está no .gitignore)
- ✅ **SEMPRE** use test keys em desenvolvimento
- ✅ **SOMENTE** use live keys em produção (com NODE_ENV=production)
- ✅ Use **Sandbox** para isolamento completo entre desenvolvedores


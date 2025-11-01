/**
 * Script to help fix Stripe keys for sandbox mode
 * 
 * Run: npx tsx scripts/fix-sandbox-keys.ts
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const stripeMode = process.env.STRIPE_MODE?.toLowerCase();
const isSandboxMode = stripeMode === 'sandbox';

console.log('🔍 Diagnóstico de Keys para Sandbox Mode\n');

if (!isSandboxMode) {
  console.log('⚠️  STRIPE_MODE não está definido como "sandbox"');
  console.log('   Adicione STRIPE_MODE=sandbox ao .env.local\n');
  process.exit(0);
}

console.log('✅ STRIPE_MODE=sandbox detectado\n');

const sandboxKey = process.env.STRIPE_SECRET_KEY_SANDBOX;
const regularKey = process.env.STRIPE_SECRET_KEY;

console.log('📋 Keys encontradas:\n');

if (sandboxKey) {
  const isLive = sandboxKey.startsWith('sk_live_');
  const isTest = sandboxKey.startsWith('sk_test_');
  const isSandboxKey = sandboxKey.startsWith('sb_');
  
  console.log('  STRIPE_SECRET_KEY_SANDBOX:');
  if (isLive) {
    console.log('    ❌ LIVE key (sk_live_*) - NÃO PERMITIDO em sandbox mode!');
  } else if (isTest) {
    console.log('    ✅ TEST key (sk_test_*) - OK para sandbox');
  } else if (isSandboxKey) {
    console.log('    ✅ SANDBOX key (sb_*) - IDEAL para sandbox');
  }
} else {
  console.log('  STRIPE_SECRET_KEY_SANDBOX: ❌ Não configurado\n');
}

if (regularKey) {
  const isLive = regularKey.startsWith('sk_live_');
  const isTest = regularKey.startsWith('sk_test_');
  const isSandboxKey = regularKey.startsWith('sb_');
  
  console.log('  STRIPE_SECRET_KEY:');
  if (isLive) {
    console.log('    ❌ LIVE key (sk_live_*) - NÃO PERMITIDO em sandbox mode!');
    console.log('\n🔧 SOLUÇÃO:\n');
    console.log('   Opção 1 - Comentar a live key e usar sandbox key:');
    console.log('     # STRIPE_SECRET_KEY=sk_live_...  (comentado)');
    console.log('     STRIPE_SECRET_KEY_SANDBOX=sk_test_...  (sua test key aqui)\n');
    console.log('   Opção 2 - Substituir por test key:');
    console.log('     STRIPE_SECRET_KEY=sk_test_...  (sua test key aqui)\n');
  } else if (isTest) {
    console.log('    ✅ TEST key (sk_test_*) - OK para sandbox');
  } else if (isSandboxKey) {
    console.log('    ✅ SANDBOX key (sb_*) - IDEAL para sandbox');
  }
} else {
  console.log('  STRIPE_SECRET_KEY: ❌ Não configurado\n');
}

// Check which key will be used
console.log('\n📊 Key que será usada:\n');

if (sandboxKey && !sandboxKey.startsWith('sk_live_')) {
  console.log('  ✅ STRIPE_SECRET_KEY_SANDBOX será usada (prioridade)');
} else if (regularKey && !regularKey.startsWith('sk_live_')) {
  const isTest = regularKey.startsWith('sk_test_');
  const isSandboxKey = regularKey.startsWith('sb_');
  if (isTest || isSandboxKey) {
    console.log('  ✅ STRIPE_SECRET_KEY será usada');
  }
} else {
  console.log('  ❌ NENHUMA key válida encontrada!');
  console.log('\n🔧 Configure uma das opções:\n');
  console.log('   1. STRIPE_SECRET_KEY_SANDBOX=sk_test_...');
  console.log('   2. STRIPE_SECRET_KEY=sk_test_... (substitua a live key)\n');
}

console.log('\n💡 Como obter TEST keys:');
console.log('   1. Acesse: https://dashboard.stripe.com/test/apikeys');
console.log('   2. Certifique-se de estar no modo TEST (toggle no canto superior)');
console.log('   3. Copie a Secret key (deve começar com sk_test_)\n');


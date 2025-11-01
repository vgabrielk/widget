/**
 * Script to check which Stripe keys are configured in .env.local
 * 
 * Run: npx tsx scripts/check-env-keys.ts
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(process.cwd(), '.env.local');

console.log('🔍 Verificando variáveis de ambiente do Stripe...\n');

if (!fs.existsSync(envPath)) {
  console.error('❌ Arquivo .env.local não encontrado!');
  process.exit(1);
}

dotenv.config({ path: envPath });

const keys = {
  'STRIPE_SECRET_KEY': process.env.STRIPE_SECRET_KEY,
  'STRIPE_SECRET_KEY_SANDBOX': process.env.STRIPE_SECRET_KEY_SANDBOX,
  'NEXT_PUBLIC_STRIPE_PUBLIC_KEY': process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY,
  'NEXT_PUBLIC_STRIPE_PUBLIC_KEY_SANDBOX': process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY_SANDBOX,
  'STRIPE_WEBHOOK_SECRET': process.env.STRIPE_WEBHOOK_SECRET,
  'STRIPE_WEBHOOK_SECRET_SANDBOX': process.env.STRIPE_WEBHOOK_SECRET_SANDBOX,
};

console.log('📋 Variáveis encontradas no .env.local:\n');

Object.entries(keys).forEach(([name, value]) => {
  if (value) {
    const prefix = value.substring(0, 8);
    const suffix = value.substring(value.length - 4);
    const type = value.startsWith('sb_') || value.startsWith('sbp_') 
      ? '🔵 SANDBOX' 
      : value.startsWith('sk_test_') || value.startsWith('pk_test_')
      ? '🟡 TEST'
      : value.startsWith('sk_live_') || value.startsWith('pk_live_')
      ? '🔴 LIVE'
      : '❓ UNKNOWN';
    
    console.log(`  ${name}:`);
    console.log(`    ${prefix}...${suffix} (${value.length} caracteres)`);
    console.log(`    Tipo: ${type}\n`);
  } else {
    console.log(`  ${name}: ❌ Não configurado\n`);
  }
});

// Detect which keys will be used
const secretKey = keys.STRIPE_SECRET_KEY || keys.STRIPE_SECRET_KEY_SANDBOX;
const publicKey = keys.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || keys.NEXT_PUBLIC_STRIPE_PUBLIC_KEY_SANDBOX;
const stripeMode = process.env.STRIPE_MODE?.toLowerCase();

console.log('📊 Análise:\n');

// Check STRIPE_MODE
if (stripeMode) {
  console.log(`  STRIPE_MODE: ${stripeMode.toUpperCase()}\n`);
}

if (secretKey) {
  const explicitSandbox = stripeMode === 'sandbox';
  const isSandboxKey = secretKey.startsWith('sb_');
  const isSandbox = explicitSandbox || isSandboxKey;
  
  if (isSandbox) {
    console.log('  ✅ Você está usando modo SANDBOX!');
    if (explicitSandbox) {
      console.log('    (STRIPE_MODE=sandbox configurado)');
    }
    if (isSandboxKey) {
      console.log('    (Keys de sandbox detectadas: sb_*)');
    }
    console.log('  ✅ Ambiente isolado configurado corretamente\n');
  } else if (secretKey.startsWith('sk_test_')) {
    console.log('  ⚠️  Você está usando TEST keys (sk_test_*)');
    if (!explicitSandbox) {
      console.log('  💡 Adicione STRIPE_MODE=sandbox se estiver usando sandbox');
      console.log('     Ou use keys de sandbox (sb_*) para isolamento completo\n');
    }
  } else if (secretKey.startsWith('sk_live_')) {
    console.log('  🚨 ATENÇÃO: Você está usando LIVE keys!');
    console.log('  🚨 NUNCA use live keys em desenvolvimento!');
    console.log('  🚨 Use TEST keys (sk_test_*) ou SANDBOX keys (sb_*)\n');
  }
} else {
  console.log('  ❌ Nenhuma secret key configurada!\n');
}

if (secretKey && publicKey) {
  const secretType = secretKey.startsWith('sb_') ? 'sandbox' : secretKey.startsWith('sk_test_') ? 'test' : 'live';
  const publicType = publicKey.startsWith('sbp_') ? 'sandbox' : publicKey.startsWith('pk_test_') ? 'test' : 'live';
  
  if (secretType !== publicType) {
    console.log('  ⚠️  AVISO: Secret key e Public key são de tipos diferentes!');
    console.log(`     Secret: ${secretType}, Public: ${publicType}`);
    console.log('     Certifique-se de que são do mesmo ambiente\n');
  }
}

console.log('💡 Dica: O código prioriza keys de sandbox se ambas estiverem configuradas.');
console.log('   Se você tem ambas, o sandbox será usado automaticamente.\n');


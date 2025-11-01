/**
 * Script to help fix Stripe keys configuration
 * This script helps identify and fix key mismatches
 */

console.log('🚨 CONFIGURAÇÃO DE KEYS CRÍTICA ENCONTRADA!\n');
console.log('Você tem:');
console.log('  🔴 LIVE secret key (sk_live_*) - PERIGOSO!');
console.log('  🟡 TEST public key (pk_test_*) - OK para desenvolvimento\n');
console.log('⚠️  ATENÇÃO: NUNCA use live keys em desenvolvimento!\n');
console.log('📋 CORREÇÃO NECESSÁRIA:\n');
console.log('No seu .env.local, você precisa ter:\n');
console.log('Para desenvolvimento (recomendado):');
console.log('  STRIPE_SECRET_KEY=sk_test_...');
console.log('  NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_...');
console.log('  STRIPE_WEBHOOK_SECRET=whsec_...\n');
console.log('OU para Sandbox (melhor isolamento):');
console.log('  STRIPE_SECRET_KEY_SANDBOX=sb_...');
console.log('  NEXT_PUBLIC_STRIPE_PUBLIC_KEY_SANDBOX=sbp_...');
console.log('  STRIPE_WEBHOOK_SECRET_SANDBOX=whsec_...\n');
console.log('🔧 AÇÕES NECESSÁRIAS:\n');
console.log('1. Remova ou comente a LIVE secret key:');
console.log('   # STRIPE_SECRET_KEY=sk_live_... (COMENTADA)\n');
console.log('2. Configure apenas TEST keys:');
console.log('   STRIPE_SECRET_KEY=sk_test_...');
console.log('   NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_... (já está configurado)');
console.log('   STRIPE_WEBHOOK_SECRET=whsec_... (já está configurado)\n');
console.log('3. Reinicie o servidor após fazer as mudanças\n');
console.log('💡 Como obter TEST keys:');
console.log('   1. Acesse: https://dashboard.stripe.com/test/apikeys');
console.log('   2. Copie "Secret key" (deve começar com sk_test_)');
console.log('   3. Copie "Publishable key" (deve começar com pk_test_)\n');


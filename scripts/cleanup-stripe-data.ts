/**
 * Script to cleanup Stripe data when switching between test/live modes
 * 
 * This helps resolve issues when customers were created in one mode but
 * accessed with keys from another mode.
 * 
 * Run: npx tsx scripts/cleanup-stripe-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar configurados!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupStripeData() {
  console.log('🧹 Limpando dados do Stripe para evitar conflito entre test/live modes...\n');

  try {
    // 1. Check current Stripe mode
    const stripeMode = process.env.STRIPE_MODE?.toLowerCase();
    const secretKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY_SANDBOX;
    
    let currentMode = 'unknown';
    if (secretKey) {
      if (secretKey.startsWith('sk_live_')) {
        currentMode = 'live';
      } else if (secretKey.startsWith('sk_test_') || secretKey.startsWith('sb_')) {
        currentMode = 'test';
      }
    }
    
    console.log(`📊 Modo Stripe atual: ${currentMode}`);
    if (stripeMode === 'sandbox') {
      console.log(`   STRIPE_MODE: sandbox\n`);
    } else {
      console.log('');
    }

    // 2. List customers
    console.log('📋 Verificando customers no banco...\n');
    const { data: customers, error: customersError } = await supabase
      .from('stripe_customers')
      .select('*');

    if (customersError) {
      console.error('❌ Erro ao buscar customers:', customersError);
      return;
    }

    if (!customers || customers.length === 0) {
      console.log('✅ Nenhum customer encontrado no banco. Tudo limpo!\n');
      return;
    }

    console.log(`Encontrados ${customers.length} customer(s) no banco:\n`);

    customers.forEach((customer, index) => {
      console.log(`  ${index + 1}. Customer ID: ${customer.stripe_customer_id}`);
      console.log(`     Widget ID: ${customer.widget_id}`);
      console.log(`     Email: ${customer.email || 'N/A'}`);
      console.log('');
    });

    // 3. List subscriptions
    console.log('📋 Verificando subscriptions no banco...\n');
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from('stripe_subscriptions')
      .select('*');

    if (subscriptionsError) {
      console.error('❌ Erro ao buscar subscriptions:', subscriptionsError);
    } else if (subscriptions && subscriptions.length > 0) {
      console.log(`Encontradas ${subscriptions.length} subscription(s) no banco:\n`);
      subscriptions.forEach((sub, index) => {
        console.log(`  ${index + 1}. Subscription: ${sub.stripe_subscription_id}`);
        console.log(`     Status: ${sub.status}`);
        console.log(`     Customer: ${sub.stripe_customer_id}`);
        console.log('');
      });
    } else {
      console.log('✅ Nenhuma subscription encontrada.\n');
    }

    // 4. Ask what to do
    console.log('⚠️  IMPORTANTE: Se você mudou de live para test mode (ou vice-versa),');
    console.log('    os customers no banco podem estar no modo errado.\n');
    console.log('💡 Recomendações:\n');
    console.log('   1. Se mudou para TEST mode:');
    console.log('      - Customers serão recriados automaticamente no test mode');
    console.log('      - Você pode limpar os dados antigos com segurança\n');
    console.log('   2. Se está em modo SANDBOX:');
    console.log('      - Cada sandbox tem seus próprios customers');
    console.log('      - Limpe os dados antigos para evitar conflitos\n');

    console.log('🔧 Para limpar os dados, descomente as linhas no final deste script');
    console.log('    ou execute manualmente no Supabase SQL Editor:\n');
    console.log('   DELETE FROM stripe_subscriptions;');
    console.log('   DELETE FROM stripe_customers;\n');

    // Uncomment these lines to actually delete (commented for safety)
    /*
    console.log('🗑️  Limpando dados...\n');
    
    // Delete subscriptions first (due to foreign keys)
    if (subscriptions && subscriptions.length > 0) {
      const { error: deleteSubsError } = await supabase
        .from('stripe_subscriptions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
      if (deleteSubsError) {
        console.error('❌ Erro ao deletar subscriptions:', deleteSubsError);
      } else {
        console.log(`✅ ${subscriptions.length} subscription(s) deletada(s)`);
      }
    }
    
    // Delete customers
    if (customers && customers.length > 0) {
      const { error: deleteCustomersError } = await supabase
        .from('stripe_customers')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
      if (deleteCustomersError) {
        console.error('❌ Erro ao deletar customers:', deleteCustomersError);
      } else {
        console.log(`✅ ${customers.length} customer(s) deletado(s)\n`);
      }
    }
    
    console.log('✅ Limpeza concluída! Agora você pode criar novos customers no modo correto.\n');
    */
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

cleanupStripeData();


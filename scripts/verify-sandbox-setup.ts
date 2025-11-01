/**
 * Script to verify Stripe Sandbox setup
 * 
 * Run this script to verify that your sandbox is configured correctly:
 * npx tsx scripts/verify-sandbox-setup.ts
 */

import Stripe from 'stripe';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function verifySandboxSetup() {
  console.log('🔍 Verificando configuração do Sandbox Stripe...\n');

  // Check environment variables
  const secretKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY_SANDBOX;
  const publicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY_SANDBOX;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET_SANDBOX;

  console.log('📋 Variáveis de Ambiente:');
  console.log(`  Secret Key: ${secretKey ? (secretKey.substring(0, 8) + '...' + secretKey.substring(secretKey.length - 4)) : '❌ NÃO CONFIGURADO'}`);
  console.log(`  Public Key: ${publicKey ? (publicKey.substring(0, 8) + '...' + publicKey.substring(publicKey.length - 4)) : '❌ NÃO CONFIGURADO'}`);
  console.log(`  Webhook Secret: ${webhookSecret ? '✅ Configurado' : '⚠️  NÃO CONFIGURADO'}\n`);

  if (!secretKey) {
    console.error('❌ STRIPE_SECRET_KEY ou STRIPE_SECRET_KEY_SANDBOX não encontrado!');
    process.exit(1);
  }

  // Check STRIPE_MODE first
  const stripeMode = process.env.STRIPE_MODE?.toLowerCase();
  const explicitSandbox = stripeMode === 'sandbox';
  
  // Detect key type
  const isSandboxKey = secretKey.startsWith('sb_');
  const isTest = secretKey.startsWith('sk_test_');
  const isLive = secretKey.startsWith('sk_live_');
  
  // Final determination
  const isSandbox = explicitSandbox || isSandboxKey;

  console.log('🔑 Modo Stripe:');
  if (stripeMode) {
    console.log(`  STRIPE_MODE: ${stripeMode.toUpperCase()}`);
  }
  
  if (isSandbox) {
    console.log('  ✅ Modo SANDBOX - Ambiente isolado');
    if (explicitSandbox && !isSandboxKey) {
      console.log('    (Usando test keys com STRIPE_MODE=sandbox)');
    }
  } else if (isTest) {
    console.log('  ⚠️  Modo TEST - Ambiente compartilhado');
  } else if (isLive) {
    console.log('  🚨 Modo LIVE - ATENÇÃO: Produção!');
  } else {
    console.log('  ❌ Formato não reconhecido');
    process.exit(1);
  }
  console.log('');

  // Test API connection
  try {
    console.log('🌐 Testando conexão com Stripe API...');
    const stripe = new Stripe(secretKey, {
      apiVersion: '2025-10-29.clover',
    });

    // Try to list products (this will verify the key works)
    const products = await stripe.products.list({ limit: 1 });
    console.log('  ✅ Conexão com Stripe API funcionando!\n');

    // Check if features exist
    console.log('📦 Verificando Features...');
    try {
      const features = await stripe.entitlements.features.list({ limit: 10 });
      if (features.data.length > 0) {
        console.log(`  ✅ ${features.data.length} feature(s) encontrada(s):`);
        features.data.forEach((feature) => {
          console.log(`     - ${feature.name} (${feature.lookup_key})`);
        });
      } else {
        console.log('  ⚠️  Nenhuma feature encontrada');
        console.log('  💡 Execute: npx tsx scripts/setup-stripe-features.ts');
      }
    } catch (error: any) {
      console.log('  ⚠️  Erro ao listar features:', error.message);
      console.log('  💡 Certifique-se de que o sandbox tem acesso à API de Entitlements');
    }
    console.log('');

    // Check products
    console.log('🛍️  Verificando Products...');
    const allProducts = await stripe.products.list({ limit: 10, active: true });
    if (allProducts.data.length > 0) {
      console.log(`  ✅ ${allProducts.data.length} produto(s) encontrado(s):`);
      for (const product of allProducts.data) {
        console.log(`     - ${product.name} (${product.id})`);
        
        // Check if product has features
        try {
          const productFeatures = await stripe.products.listFeatures(product.id);
          if (productFeatures.data.length > 0) {
            console.log(`       📋 Features: ${productFeatures.data.map((pf) => pf.entitlement_feature?.lookup_key || 'N/A').join(', ')}`);
          }
        } catch (error) {
          // Ignore if entitlements not available
        }

        // Check prices
        const prices = await stripe.prices.list({ product: product.id, active: true });
        if (prices.data.length > 0) {
          console.log(`       💰 Preços:`);
          prices.data.forEach((price) => {
            const amount = price.unit_amount ? (price.unit_amount / 100).toFixed(2) : 'N/A';
            const interval = price.recurring?.interval || 'one-time';
            console.log(`          - ${amount} ${price.currency?.toUpperCase()} / ${interval}`);
          });
        }
      }
    } else {
      console.log('  ⚠️  Nenhum produto encontrado');
      console.log('  💡 Execute: npx tsx scripts/setup-stripe-features.ts');
    }
    console.log('');

    // Summary
    console.log('📊 Resumo:');
    console.log(`  ✅ Keys configuradas corretamente`);
    console.log(`  ✅ Conexão com API funcionando`);
    
    if (isSandbox) {
      console.log(`  ✅ Usando Sandbox (ambiente isolado)`);
      console.log(`\n📝 Próximos passos:`);
      console.log(`  1. Configure webhooks no Dashboard do sandbox`);
      console.log(`  2. Execute: npx tsx scripts/setup-stripe-features.ts (se ainda não executou)`);
      console.log(`  3. Teste o checkout com cartões de teste`);
    } else {
      console.log(`  ⚠️  Não está usando Sandbox`);
      console.log(`  💡 Considere usar Sandbox para desenvolvimento isolado`);
    }

  } catch (error: any) {
    console.error('❌ Erro ao conectar com Stripe:', error.message);
    if (error.type === 'StripeAuthenticationError') {
      console.error('  💡 Verifique se as keys estão corretas no .env.local');
    }
    process.exit(1);
  }
}

// Run the verification
verifySandboxSetup().catch(console.error);


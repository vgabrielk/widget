/**
 * Script to set up Stripe Features and Products for Entitlements
 * 
 * Run this script once to create all necessary features and products in Stripe.
 * You can run this with: npx tsx scripts/setup-stripe-features.ts
 * 
 * Make sure to set STRIPE_SECRET_KEY in your environment variables.
 */

import Stripe from 'stripe';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

// Features to create
const FEATURES = [
  { name: 'Unlimited Messages', lookupKey: 'unlimited_messages' },
  { name: 'Priority Support', lookupKey: 'priority_support' },
  { name: 'Widget Customization', lookupKey: 'widget_customization' },
  { name: 'Multiple Widgets', lookupKey: 'multiple_widgets' },
  { name: 'Advanced Analytics', lookupKey: 'advanced_analytics' },
  { name: 'API Access', lookupKey: 'api_access' },
  { name: 'Webhooks', lookupKey: 'webhooks' },
  { name: 'Brand Removal', lookupKey: 'brand_removal' },
];

async function setupStripeFeatures() {
  console.log('🚀 Setting up Stripe Features and Products...\n');

  try {
    // Step 1: Create Features
    console.log('📋 Creating features...');
    const createdFeatures: Stripe.Entitlements.Feature[] = [];

    for (const feature of FEATURES) {
      try {
        // Try to retrieve existing feature first
        const existing = await stripe.entitlements.features
          .list({ lookup_key: feature.lookupKey })
          .then((list) => list.data[0]);

        if (existing) {
          console.log(`  ✓ Feature "${feature.name}" already exists (${existing.id})`);
          createdFeatures.push(existing);
        } else {
          const stripeFeature = await stripe.entitlements.features.create({
            name: feature.name,
            lookup_key: feature.lookupKey,
          });
          console.log(`  ✓ Created feature: ${feature.name} (${stripeFeature.id})`);
          createdFeatures.push(stripeFeature);
        }
      } catch (error: any) {
        console.error(`  ✗ Error creating feature "${feature.name}":`, error.message);
      }
    }

    // Step 2: Create Product
    console.log('\n📦 Creating Pro product...');
    let product: Stripe.Product;

    try {
      const existingProducts = await stripe.products.list({
        active: true,
        limit: 100,
      });

      product = existingProducts.data.find((p) => p.name === 'Plano Pro') as Stripe.Product;

      if (!product) {
        product = await stripe.products.create({
          name: 'Plano Pro',
          description: 'Plano completo com acesso a todas as funcionalidades',
          metadata: {
            plan_type: 'pro',
          },
        });
        console.log(`  ✓ Created product: ${product.name} (${product.id})`);
      } else {
        console.log(`  ✓ Product already exists: ${product.name} (${product.id})`);
      }
    } catch (error: any) {
      console.error('  ✗ Error creating product:', error.message);
      throw error;
    }

    // Step 3: Attach Features to Product
    console.log('\n🔗 Attaching features to product...');
    for (const feature of createdFeatures) {
      try {
        // Check if feature is already attached
        const existingFeatures = await stripe.products.listFeatures(product.id);
        const isAttached = existingFeatures.data.some(
          (pf) => {
            const entFeature = (pf as any).entitlement_feature;
            return typeof entFeature === 'string' ? entFeature === feature.id : entFeature?.id === feature.id;
          }
        );

        if (isAttached) {
          console.log(`  ✓ Feature "${feature.name}" already attached to product`);
        } else {
          await stripe.products.createFeature(product.id, {
            entitlement_feature: feature.id,
          });
          console.log(`  ✓ Attached feature: ${feature.name}`);
        }
      } catch (error: any) {
        console.error(`  ✗ Error attaching feature "${feature.name}":`, error.message);
      }
    }

    // Step 4: Create Price (optional - you might want to create this via Dashboard or API)
    console.log('\n💰 Creating price...');
    try {
      const existingPrices = await stripe.prices.list({
        product: product.id,
        active: true,
        limit: 10,
      });

      const monthlyPrice = existingPrices.data.find(
        (p) => p.recurring?.interval === 'month' && p.currency === 'brl'
      );

      if (!monthlyPrice) {
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: 2990, // R$ 29.90 in cents
          currency: 'brl',
          recurring: {
            interval: 'month',
          },
          metadata: {
            plan_type: 'pro',
          },
        });
        console.log(`  ✓ Created price: R$ 29.90/month (${price.id})`);
        console.log(`\n📝 Save this price ID for your .env.local:`);
        console.log(`   NEXT_PUBLIC_STRIPE_PRICE_ID_PRO=${price.id}`);
      } else {
        console.log(`  ✓ Price already exists: R$ 29.90/month (${monthlyPrice.id})`);
      }
    } catch (error: any) {
      console.error('  ✗ Error creating price:', error.message);
      console.log('  ⚠️  You may need to create the price manually in the Stripe Dashboard');
    }

    console.log('\n✅ Setup complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Add the price ID to your .env.local file');
    console.log('2. Configure webhook events in Stripe Dashboard:');
    console.log('   - entitlements.active_entitlement_summary.updated');
    console.log('   - customer.subscription.created');
    console.log('   - customer.subscription.updated');
    console.log('   - customer.subscription.deleted');
    console.log('3. Test the integration with test cards from Stripe');
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run the script
setupStripeFeatures().catch(console.error);


import Stripe from 'stripe';

// Lazy initialize Stripe client
let stripeInstance: Stripe | null = null;

function getStripeInstance(): Stripe {
  if (!stripeInstance) {
    // Check STRIPE_MODE environment variable first
    const stripeMode = process.env.STRIPE_MODE?.toLowerCase();
    const explicitSandbox = stripeMode === 'sandbox';
    
    // If in sandbox mode, prioritize sandbox/test keys over live keys
    let secretKey: string | undefined;
    
    if (explicitSandbox) {
      // In sandbox mode, only use test or sandbox keys (ignore live keys)
      const sandboxKey = process.env.STRIPE_SECRET_KEY_SANDBOX;
      const regularKey = process.env.STRIPE_SECRET_KEY;
      
      // Prefer sandbox-specific key first
      if (sandboxKey && !sandboxKey.startsWith('sk_live_')) {
        secretKey = sandboxKey;
      } 
      // Then try regular key, but only if it's test or sandbox
      else if (regularKey) {
        const isLive = regularKey.startsWith('sk_live_');
        const isTest = regularKey.startsWith('sk_test_');
        const isSandboxKey = regularKey.startsWith('sb_');
        
        if (isLive) {
          console.error('🚨 SECURITY WARNING: STRIPE_MODE=sandbox but LIVE key in STRIPE_SECRET_KEY detected!');
          console.error('🚨 In sandbox mode, you must use TEST keys (sk_test_*) or SANDBOX keys (sb_*)');
          console.error('🚨 Options:');
          console.error('   1. Set STRIPE_SECRET_KEY_SANDBOX to a test/sandbox key');
          console.error('   2. Change STRIPE_SECRET_KEY to a test key (sk_test_*)');
          console.error('   3. Remove or comment STRIPE_SECRET_KEY if it contains live key');
          throw new Error('Cannot use LIVE keys when STRIPE_MODE=sandbox. Configure STRIPE_SECRET_KEY_SANDBOX or use test key in STRIPE_SECRET_KEY.');
        } else if (isTest || isSandboxKey) {
          secretKey = regularKey;
        }
      }
      
      // If still no valid key found
      if (!secretKey) {
        throw new Error('No valid test or sandbox key found. When STRIPE_MODE=sandbox, configure STRIPE_SECRET_KEY_SANDBOX or set STRIPE_SECRET_KEY to a test key (sk_test_*).');
      }
    } else {
      // Normal mode: use any available key
      secretKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY_SANDBOX;
    }
    
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY or STRIPE_SECRET_KEY_SANDBOX environment variable is not set');
    }
    
    // Detect mode from key prefix
    const isSandboxKey = secretKey.startsWith('sb_');
    const isTest = secretKey.startsWith('sk_test_');
    const isLive = secretKey.startsWith('sk_live_');
    
    // Final determination: explicit mode takes precedence, then key format
    const isSandbox = explicitSandbox || isSandboxKey;
    
    // SECURITY: Warn if using live keys in development (when not in sandbox mode)
    if (isLive && process.env.NODE_ENV !== 'production' && !explicitSandbox) {
      console.error('🚨 SECURITY WARNING: Using LIVE Stripe keys in development!');
      console.error('🚨 This can create REAL charges!');
      console.error('🚨 Please use TEST keys (sk_test_*), SANDBOX keys (sb_*), or set STRIPE_MODE=sandbox');
      throw new Error('LIVE Stripe keys detected in non-production environment. Use test or sandbox keys instead, or set STRIPE_MODE=sandbox.');
    }
    
    if (isSandbox) {
      console.log('🔵 Using Stripe in SANDBOX mode');
    } else if (!isSandbox && !isTest && !isLive) {
      console.warn('Warning: Stripe key format not recognized. Expected sb_* (sandbox), sk_test_* (test), or sk_live_* (live)');
    }
    
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2025-10-29.clover',
      typescript: true,
    });
  }
  return stripeInstance;
}

// Export stripe instance getter
export const stripe = new Proxy({} as Stripe, {
  get: (target, prop) => {
    return (getStripeInstance() as any)[prop];
  }
});

// Get the publishable key for client-side usage
// Supports sandbox keys (sb_*) or regular keys (pk_test_* or pk_live_*)
export const getStripePublishableKey = () => {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || 
         process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY_SANDBOX ||
         '';
};

// Stripe helper functions

/**
 * Create a Stripe customer
 */
export async function createStripeCustomer(params: {
  email: string;
  name?: string;
  widgetId: string;
  metadata?: Record<string, string>;
}) {
  const customer = await stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: {
      widget_id: params.widgetId,
      ...params.metadata,
    },
  });

  return customer;
}

/**
 * Create a checkout session for subscription
 */
export async function createCheckoutSession(params: {
  customerId?: string;
  customerEmail?: string;
  priceId: string;
  widgetId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}) {
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      widget_id: params.widgetId,
      ...params.metadata,
    },
  };

  // Add customer or email
  if (params.customerId) {
    sessionParams.customer = params.customerId;
  } else if (params.customerEmail) {
    sessionParams.customer_email = params.customerEmail;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return session;
}

/**
 * Create a one-time payment checkout session
 */
export async function createOneTimeCheckoutSession(params: {
  customerId?: string;
  customerEmail?: string;
  priceId: string;
  widgetId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}) {
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      widget_id: params.widgetId,
      ...params.metadata,
    },
  };

  if (params.customerId) {
    sessionParams.customer = params.customerId;
  } else if (params.customerEmail) {
    sessionParams.customer_email = params.customerEmail;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return session;
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string) {
  const subscription = await stripe.subscriptions.cancel(subscriptionId);
  return subscription;
}

/**
 * Cancel a subscription at period end
 */
export async function cancelSubscriptionAtPeriodEnd(subscriptionId: string) {
  const subscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
  return subscription;
}

/**
 * Resume a subscription that's set to cancel at period end
 */
export async function resumeSubscription(subscriptionId: string) {
  const subscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
  return subscription;
}

/**
 * Update a subscription (e.g., change plan)
 */
export async function updateSubscription(
  subscriptionId: string,
  params: {
    priceId?: string;
    quantity?: number;
    metadata?: Record<string, string>;
  }
) {
  const updateParams: Stripe.SubscriptionUpdateParams = {};

  if (params.priceId) {
    // Get the subscription to find the item ID
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const itemId = subscription.items.data[0].id;

    updateParams.items = [
      {
        id: itemId,
        price: params.priceId,
        quantity: params.quantity || 1,
      },
    ];
  }

  if (params.metadata) {
    updateParams.metadata = params.metadata;
  }

  const subscription = await stripe.subscriptions.update(
    subscriptionId,
    updateParams
  );
  return subscription;
}

/**
 * Get customer by ID
 */
export async function getCustomer(customerId: string) {
  const customer = await stripe.customers.retrieve(customerId);
  return customer;
}

/**
 * Get subscription by ID
 */
export async function getSubscription(subscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return subscription;
}

/**
 * List customer subscriptions
 */
export async function listCustomerSubscriptions(customerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 100,
  });
  return subscriptions.data;
}

/**
 * Create a billing portal session
 */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session;
}

/**
 * List all products
 */
export async function listProducts(activeOnly: boolean = true) {
  const products = await stripe.products.list({
    active: activeOnly,
    limit: 100,
  });
  return products.data;
}

/**
 * List all prices for a product
 */
export async function listPrices(productId?: string, activeOnly: boolean = true) {
  const params: Stripe.PriceListParams = {
    active: activeOnly,
    limit: 100,
  };

  if (productId) {
    params.product = productId;
  }

  const prices = await stripe.prices.list(params);
  return prices.data;
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}


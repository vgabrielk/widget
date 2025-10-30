import Stripe from 'stripe';

// Lazy initialize Stripe client
let stripeInstance: Stripe | null = null;

function getStripeInstance(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
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
export const getStripePublishableKey = () => {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!;
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


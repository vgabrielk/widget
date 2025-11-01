import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

// Lazy initialize Stripe
let stripeInstance: Stripe | null = null;
function getStripe() {
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
      throw new Error('STRIPE_SECRET_KEY or STRIPE_SECRET_KEY_SANDBOX is not set');
    }
    
    // Detect mode from key prefix
    const isSandboxKey = secretKey.startsWith('sb_');
    const isTest = secretKey.startsWith('sk_test_');
    const isLive = secretKey.startsWith('sk_live_');
    
    // Final determination: explicit mode takes precedence
    const isSandbox = explicitSandbox || isSandboxKey;
    
    // SECURITY: Warn if using live keys in development (when not in sandbox mode)
    if (isLive && process.env.NODE_ENV !== 'production' && !explicitSandbox) {
      console.error('🚨 SECURITY WARNING: Using LIVE Stripe keys in development!');
      console.error('🚨 This can create REAL charges!');
      throw new Error('LIVE Stripe keys detected in non-production environment. Use test or sandbox keys instead, or set STRIPE_MODE=sandbox.');
    }
    
    if (!isSandbox && !isTest && !isLive) {
      console.warn('Warning: Stripe key format not recognized. Expected sb_* (sandbox), sk_test_* (test), or sk_live_* (live)');
    }
    
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2025-10-29.clover',
    });
  }
  return stripeInstance;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('Missing stripe-signature header');
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    // Support for sandbox webhook secret or regular webhook secret
    let event: Stripe.Event;
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET_SANDBOX;
      if (!webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRET_SANDBOX is not set');
      }
      event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Handle the event
    console.log(`Processing Stripe webhook: ${event.type}`);

    const supabase = await createClient();

    switch (event.type) {
      // Customer events
      case 'customer.created':
      case 'customer.updated': {
        const customer = event.data.object as Stripe.Customer;
        await handleCustomerUpsert(supabase, customer);
        break;
      }

      case 'customer.deleted': {
        const customer = event.data.object as Stripe.Customer;
        await handleCustomerDelete(supabase, customer.id);
        break;
      }

      // Subscription events
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[Webhook] Subscription updated: ${subscription.id}, status: ${subscription.status}, cancel_at_period_end: ${subscription.cancel_at_period_end}`);
        await handleSubscriptionUpsert(supabase, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[Webhook] Subscription deleted: ${subscription.id}`);
        await handleSubscriptionDelete(supabase, subscription.id);
        break;
      }

      // Checkout session completed
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabase, session);
        break;
      }

      // Invoice events
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(supabase, invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoiceFailed(supabase, invoice);
        break;
      }

      // Entitlements events
      case 'entitlements.active_entitlement_summary.updated': {
        await handleEntitlementSummaryUpdated(supabase, event.data.object);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// Helper functions

async function handleCustomerUpsert(
  supabase: any,
  customer: Stripe.Customer
) {
  try {
    // Get widget_id from customer metadata
    const widgetId = customer.metadata?.widget_id;
    
    if (!widgetId) {
      console.warn(`Customer ${customer.id} has no widget_id in metadata`);
      return;
    }

    // Use the sync function from the migration
    const { error } = await supabase.rpc('sync_stripe_customer', {
      p_widget_id: widgetId,
      p_stripe_customer_id: customer.id,
      p_email: customer.email,
      p_name: customer.name,
      p_metadata: customer.metadata || {},
    });

    if (error) {
      console.error('Error syncing customer:', error);
    } else {
      console.log(`Synced customer: ${customer.id}`);
    }
  } catch (error) {
    console.error('Error in handleCustomerUpsert:', error);
  }
}

async function handleCustomerDelete(supabase: any, customerId: string) {
  try {
    const { error } = await supabase
      .from('stripe_customers')
      .delete()
      .eq('stripe_customer_id', customerId);

    if (error) {
      console.error('Error deleting customer:', error);
    } else {
      console.log(`Deleted customer: ${customerId}`);
    }
  } catch (error) {
    console.error('Error in handleCustomerDelete:', error);
  }
}

async function handleSubscriptionUpsert(
  supabase: any,
  subscription: Stripe.Subscription
) {
  try {
    console.log(`[Webhook] handleSubscriptionUpsert called for subscription: ${subscription.id}`);
    console.log(`[Webhook] Subscription status: ${subscription.status}`);
    console.log(`[Webhook] Subscription customer: ${subscription.customer}`);
    console.log(`[Webhook] Subscription metadata:`, subscription.metadata);

    // Get widget_id from subscription metadata or from customer
    let widgetId = subscription.metadata?.widget_id;

    if (!widgetId) {
      console.log('[Webhook] No widget_id in subscription metadata, checking customer...');
      // Try to get from customer
      const { data: customer } = await supabase
        .from('stripe_customers')
        .select('widget_id')
        .eq('stripe_customer_id', subscription.customer as string)
        .maybeSingle();

      widgetId = customer?.widget_id;
      console.log(`[Webhook] Widget ID from customer table: ${widgetId || 'NOT FOUND'}`);
    }

    // If still no widget_id, try to get from customer metadata in Stripe
    if (!widgetId && subscription.customer) {
      try {
        console.log('[Webhook] Fetching customer from Stripe to get widget_id...');
        const customer = await getStripe().customers.retrieve(subscription.customer as string);
        if (!customer.deleted && 'metadata' in customer) {
          widgetId = (customer as Stripe.Customer).metadata?.widget_id;
          console.log(`[Webhook] Widget ID from Stripe customer metadata: ${widgetId || 'NOT FOUND'}`);
        }
      } catch (err) {
        console.error('[Webhook] Error retrieving customer:', err);
      }
    }

    if (!widgetId) {
      console.error(
        `[Webhook] Subscription ${subscription.id} has no widget_id in metadata, customer table, or Stripe customer metadata`
      );
      return;
    }

    // Safely convert dates
    const safeToISO = (timestamp: number | null | undefined) => {
      if (!timestamp) return null;
      try {
        const date = new Date(timestamp * 1000);
        if (isNaN(date.getTime())) return null;
        return date.toISOString();
      } catch {
        return null;
      }
    };

    console.log(`[Webhook] Syncing subscription ${subscription.id} to database with widget_id: ${widgetId}`);
    console.log(`[Webhook] cancel_at_period_end: ${subscription.cancel_at_period_end}`);
    
    // Store cancel_at_period_end in metadata if not already there
    const metadata = subscription.metadata || {};
    if (subscription.cancel_at_period_end !== undefined) {
      metadata.cancel_at_period_end = subscription.cancel_at_period_end.toString();
    }
    
    // Use the sync function from the migration
    const { error, data } = await supabase.rpc('sync_stripe_subscription', {
      p_widget_id: widgetId,
      p_stripe_subscription_id: subscription.id,
      p_stripe_customer_id: subscription.customer as string,
      p_status: subscription.status,
      p_current_period_start: safeToISO((subscription as any).current_period_start),
      p_current_period_end: safeToISO((subscription as any).current_period_end),
      p_cancel_at: safeToISO((subscription as any).cancel_at),
      p_canceled_at: safeToISO((subscription as any).canceled_at),
      p_metadata: metadata,
    });

    if (error) {
      console.error('[Webhook] Error syncing subscription:', error);
      console.error('[Webhook] Error details:', JSON.stringify(error, null, 2));
    } else {
      console.log(`[Webhook] Successfully synced subscription: ${subscription.id} to widget: ${widgetId}`);
    }
  } catch (error) {
    console.error('[Webhook] Error in handleSubscriptionUpsert:', error);
    if (error instanceof Error) {
      console.error('[Webhook] Error stack:', error.stack);
    }
  }
}

async function handleSubscriptionDelete(
  supabase: any,
  subscriptionId: string
) {
  try {
    // Mark as canceled instead of deleting
    const { error } = await supabase
      .from('stripe_subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscriptionId);

    if (error) {
      console.error('Error marking subscription as canceled:', error);
    } else {
      console.log(`Marked subscription as canceled: ${subscriptionId}`);
    }
  } catch (error) {
    console.error('Error in handleSubscriptionDelete:', error);
  }
}

async function handleCheckoutCompleted(
  supabase: any,
  session: Stripe.Checkout.Session
) {
  try {
    console.log(`[Webhook] Checkout completed: ${session.id}`);
    console.log(`[Webhook] Session mode: ${session.mode}`);
    console.log(`[Webhook] Session customer: ${session.customer}`);
    console.log(`[Webhook] Session subscription: ${session.subscription}`);
    console.log(`[Webhook] Session metadata:`, session.metadata);
    
    // Get widget_id from session metadata
    let widgetId = session.metadata?.widget_id;
    
    if (!widgetId) {
      console.warn(`[Webhook] Checkout session ${session.id} has no widget_id in metadata`);
      // Try to get from customer metadata as fallback
      if (session.customer) {
        try {
          const customer = await getStripe().customers.retrieve(session.customer as string);
          if (!customer.deleted && 'metadata' in customer) {
            const customerWidgetId = (customer as Stripe.Customer).metadata?.widget_id;
            if (customerWidgetId) {
              console.log(`[Webhook] Found widget_id in customer metadata: ${customerWidgetId}`);
              widgetId = customerWidgetId;
            }
          }
        } catch (err) {
          console.error('[Webhook] Error retrieving customer for widget_id:', err);
        }
      }
      if (!widgetId) {
        console.error(`[Webhook] No widget_id found for checkout session ${session.id}`);
        return;
      }
    }

    // If this session created a customer, sync it
    if (session.customer) {
      console.log(`[Webhook] Syncing customer: ${session.customer}`);
      try {
        const customerResponse = await getStripe().customers.retrieve(
          session.customer as string
        );
        
        // Type guard: check if customer is not deleted
        if (customerResponse && !customerResponse.deleted && 'created' in customerResponse) {
          await handleCustomerUpsert(supabase, customerResponse as Stripe.Customer);
          console.log(`[Webhook] Customer synced successfully`);
        }
      } catch (error) {
        console.error('[Webhook] Error syncing customer:', error);
      }
    }

    // If this session created a subscription, sync it
    if (session.subscription) {
      console.log(`[Webhook] Syncing subscription: ${session.subscription}`);
      try {
        const subscription = await getStripe().subscriptions.retrieve(
          session.subscription as string
        );
        console.log(`[Webhook] Subscription retrieved:`, {
          id: subscription.id,
          status: subscription.status,
          customer: subscription.customer,
        });
        await handleSubscriptionUpsert(supabase, subscription);
        console.log(`[Webhook] Subscription synced successfully`);
      } catch (error) {
        console.error('[Webhook] Error syncing subscription:', error);
      }
    } else {
      console.warn(`[Webhook] No subscription in checkout session ${session.id}. Mode: ${session.mode}`);
      if (session.mode === 'subscription') {
        console.warn(`[Webhook] WARNING: Subscription mode but no subscription ID! This might indicate an issue.`);
      }
    }

    console.log(`[Webhook] Processed checkout session: ${session.id}`);
  } catch (error) {
    console.error('[Webhook] Error in handleCheckoutCompleted:', error);
  }
}

async function handleInvoicePaid(supabase: any, invoice: Stripe.Invoice) {
  try {
    console.log(`Invoice paid: ${invoice.id}`);
    
    // If invoice is for a subscription, update subscription status
    if ((invoice as any).subscription) {
      const subscription = await getStripe().subscriptions.retrieve(
        (invoice as any).subscription as string
      );
      await handleSubscriptionUpsert(supabase, subscription);
    }
  } catch (error) {
    console.error('Error in handleInvoicePaid:', error);
  }
}

async function handleInvoiceFailed(supabase: any, invoice: Stripe.Invoice) {
  try {
    console.log(`Invoice payment failed: ${invoice.id}`);
    
    // If invoice is for a subscription, update subscription status
    if ((invoice as any).subscription) {
      const subscription = await getStripe().subscriptions.retrieve(
        (invoice as any).subscription as string
      );
      await handleSubscriptionUpsert(supabase, subscription);
    }

    // Optionally: Send notification to customer about failed payment
    // You can implement email notifications here
  } catch (error) {
    console.error('Error in handleInvoiceFailed:', error);
  }
}

async function handleEntitlementSummaryUpdated(
  supabase: any,
  summary: Stripe.Entitlements.ActiveEntitlementSummary
) {
  try {
    console.log(`Entitlement summary updated for customer: ${summary.customer}`);
    
    // The entitlement summary contains a list of active entitlements
    // You can use this to update your local database or trigger feature provisioning
    
    // For now, we just log it. You might want to:
    // 1. Update a local cache of user entitlements
    // 2. Trigger feature provisioning/deprovisioning
    // 3. Send notifications to the user
    
    if ((summary as any).active_entitlements && (summary as any).active_entitlements.data) {
      const features = (summary as any).active_entitlements.data.map(
        (entitlement: any) => entitlement.feature?.lookup_key
      );
      console.log(`Customer has active features: ${features.join(', ')}`);
    }
  } catch (error) {
    console.error('Error in handleEntitlementSummaryUpdated:', error);
  }
}


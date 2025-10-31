import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

// Lazy initialize Stripe
let stripeInstance: Stripe | null = null;
function getStripe() {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set');
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
    let event: Stripe.Event;
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET is not set');
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
        await handleSubscriptionUpsert(supabase, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
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
    // Get widget_id from subscription metadata or from customer
    let widgetId = subscription.metadata?.widget_id;

    if (!widgetId) {
      // Try to get from customer
      const { data: customer } = await supabase
        .from('stripe_customers')
        .select('widget_id')
        .eq('stripe_customer_id', subscription.customer as string)
        .single();

      widgetId = customer?.widget_id;
    }

    if (!widgetId) {
      console.warn(
        `Subscription ${subscription.id} has no widget_id in metadata or customer`
      );
      return;
    }

    // Use the sync function from the migration
    const { error } = await supabase.rpc('sync_stripe_subscription', {
      p_widget_id: widgetId,
      p_stripe_subscription_id: subscription.id,
      p_stripe_customer_id: subscription.customer as string,
      p_status: subscription.status,
      p_current_period_start: new Date(
        (subscription as any).current_period_start * 1000
      ).toISOString(),
      p_current_period_end: new Date(
        (subscription as any).current_period_end * 1000
      ).toISOString(),
      p_cancel_at: (subscription as any).cancel_at
        ? new Date((subscription as any).cancel_at * 1000).toISOString()
        : null,
      p_canceled_at: (subscription as any).canceled_at
        ? new Date((subscription as any).canceled_at * 1000).toISOString()
        : null,
      p_metadata: subscription.metadata || {},
    });

    if (error) {
      console.error('Error syncing subscription:', error);
    } else {
      console.log(`Synced subscription: ${subscription.id}`);
    }
  } catch (error) {
    console.error('Error in handleSubscriptionUpsert:', error);
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
    console.log(`Checkout completed: ${session.id}`);
    
    // Get widget_id from session metadata
    const widgetId = session.metadata?.widget_id;
    
    if (!widgetId) {
      console.warn(`Checkout session ${session.id} has no widget_id in metadata`);
      return;
    }

    // If this session created a customer, sync it
    if (session.customer) {
      const customerResponse = await getStripe().customers.retrieve(
        session.customer as string
      );
      
      // Type guard: check if customer is not deleted
      if (customerResponse && !customerResponse.deleted && 'created' in customerResponse) {
        await handleCustomerUpsert(supabase, customerResponse as Stripe.Customer);
      }
    }

    // If this session created a subscription, sync it
    if (session.subscription) {
      const subscription = await getStripe().subscriptions.retrieve(
        session.subscription as string
      );
      await handleSubscriptionUpsert(supabase, subscription);
    }

    console.log(`Processed checkout session: ${session.id}`);
  } catch (error) {
    console.error('Error in handleCheckoutCompleted:', error);
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


import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

/**
 * Cancel subscription
 * POST /api/stripe/cancel-subscription
 * Body: { subscriptionId: string, cancelAtPeriodEnd?: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { subscriptionId, cancelAtPeriodEnd } = body;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    // Verify the subscription belongs to the user
    // Get user's widget first
    const { data: widgets } = await supabase
      .from('widgets')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .order('created_at', { ascending: false });

    const widgetId = widgets?.[0]?.id;

    if (!widgetId) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      );
    }

    // Get customer for this widget
    const { data: customer } = await supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('widget_id', widgetId)
      .maybeSingle();

    let customerId = customer?.stripe_customer_id;

    // If no customer in DB, try to find by email in Stripe
    if (!customerId && user.email) {
      try {
        const customers = await stripe.customers.list({
          email: user.email,
          limit: 10,
        });

        const matchingCustomer = customers.data.find((c) => {
          return c.metadata?.widget_id === widgetId || 
                 c.metadata?.user_id === user.id;
        });

        const foundCustomer = matchingCustomer || (customers.data.length > 0 ? customers.data[0] : null);
        
        if (foundCustomer) {
          customerId = foundCustomer.id;
        }
      } catch (error) {
        console.error('Error searching for customer:', error);
      }
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Check if subscription belongs to this customer
    const { data: userSubscription } = await supabase
      .from('stripe_subscriptions')
      .select('*')
      .eq('stripe_subscription_id', subscriptionId)
      .eq('stripe_customer_id', customerId)
      .maybeSingle();

    // Also verify in Stripe directly
    let subscriptionExists = false;
    if (!userSubscription) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
        if (stripeSubscription.customer === customerId) {
          subscriptionExists = true;
        }
      } catch (error) {
        console.error('Error verifying subscription in Stripe:', error);
      }
    }

    if (!userSubscription && !subscriptionExists) {
      return NextResponse.json(
        { error: 'Subscription not found or does not belong to user' },
        { status: 404 }
      );
    }

    // Cancel the subscription
    if (cancelAtPeriodEnd) {
      // Schedule cancellation at period end
      const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });

      // Sync updated subscription to database
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

      // Get widget ID
      const { data: widgets } = await supabase
        .from('widgets')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      const widgetId = widgets?.[0]?.id;

      if (widgetId) {
        const metadata = updatedSubscription.metadata || {};
        if (updatedSubscription.cancel_at_period_end !== undefined) {
          metadata.cancel_at_period_end = updatedSubscription.cancel_at_period_end.toString();
        }
        
        await supabase.rpc('sync_stripe_subscription', {
          p_widget_id: widgetId,
          p_stripe_subscription_id: updatedSubscription.id,
          p_stripe_customer_id: updatedSubscription.customer as string,
          p_status: updatedSubscription.status,
          p_current_period_start: safeToISO((updatedSubscription as any).current_period_start),
          p_current_period_end: safeToISO((updatedSubscription as any).current_period_end),
          p_cancel_at: safeToISO((updatedSubscription as any).cancel_at),
          p_canceled_at: safeToISO((updatedSubscription as any).canceled_at),
          p_metadata: metadata,
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Subscription will be canceled at the end of the current period',
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          cancel_at_period_end: updatedSubscription.cancel_at_period_end,
          current_period_end: (updatedSubscription as any).current_period_end,
        },
      });
    } else {
      // Cancel immediately
      const canceledSubscription = await stripe.subscriptions.cancel(subscriptionId);

      // The webhook will handle updating the database when subscription.deleted event is received
      // But we can also update it here for immediate feedback
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

      // Get widget ID
      const { data: widgets } = await supabase
        .from('widgets')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      const widgetId = widgets?.[0]?.id;

      if (widgetId) {
        const metadata = canceledSubscription.metadata || {};
        if (canceledSubscription.cancel_at_period_end !== undefined) {
          metadata.cancel_at_period_end = canceledSubscription.cancel_at_period_end.toString();
        }
        
        await supabase.rpc('sync_stripe_subscription', {
          p_widget_id: widgetId,
          p_stripe_subscription_id: canceledSubscription.id,
          p_stripe_customer_id: canceledSubscription.customer as string,
          p_status: canceledSubscription.status,
          p_current_period_start: safeToISO((canceledSubscription as any).current_period_start),
          p_current_period_end: safeToISO((canceledSubscription as any).current_period_end),
          p_cancel_at: safeToISO((canceledSubscription as any).cancel_at),
          p_canceled_at: safeToISO((canceledSubscription as any).canceled_at),
          p_metadata: metadata,
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Subscription canceled successfully',
        subscription: {
          id: canceledSubscription.id,
          status: canceledSubscription.status,
        },
      });
    }
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json(
      {
        error: 'Failed to cancel subscription',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Reactivate subscription (cancel scheduled cancellation)
 * PATCH /api/stripe/cancel-subscription
 * Body: { subscriptionId: string }
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { subscriptionId } = body;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    // Verify subscription belongs to user (similar check as above)
    const { data: widgets } = await supabase
      .from('widgets')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .order('created_at', { ascending: false });

    const widgetId = widgets?.[0]?.id;

    if (!widgetId) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      );
    }

    let { data: customer } = await supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('widget_id', widgetId)
      .maybeSingle();

    let customerId = customer?.stripe_customer_id;

    // If no customer in DB, try to find by email in Stripe
    if (!customerId && user.email) {
      try {
        const customers = await stripe.customers.list({
          email: user.email,
          limit: 10,
        });

        const matchingCustomer = customers.data.find((c) => {
          return c.metadata?.widget_id === widgetId || 
                 c.metadata?.user_id === user.id;
        });

        const foundCustomer = matchingCustomer || (customers.data.length > 0 ? customers.data[0] : null);
        
        if (foundCustomer) {
          customerId = foundCustomer.id;
        }
      } catch (error) {
        console.error('Error searching for customer:', error);
      }
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Check if subscription belongs to this customer
    const { data: userSubscription } = await supabase
      .from('stripe_subscriptions')
      .select('*')
      .eq('stripe_subscription_id', subscriptionId)
      .eq('stripe_customer_id', customerId)
      .maybeSingle();

    // Also verify in Stripe directly
    let subscriptionExists = false;
    if (!userSubscription) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
        if (stripeSubscription.customer === customerId) {
          subscriptionExists = true;
        }
      } catch (error) {
        console.error('Error verifying subscription in Stripe:', error);
      }
    }

    if (!userSubscription && !subscriptionExists) {
      return NextResponse.json(
        { error: 'Subscription not found or does not belong to user' },
        { status: 404 }
      );
    }

    // Reactivate by setting cancel_at_period_end to false
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });

    // Sync updated subscription
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

    const metadata = updatedSubscription.metadata || {};
    if (updatedSubscription.cancel_at_period_end !== undefined) {
      metadata.cancel_at_period_end = updatedSubscription.cancel_at_period_end.toString();
    }

    await supabase.rpc('sync_stripe_subscription', {
      p_widget_id: widgetId,
      p_stripe_subscription_id: updatedSubscription.id,
      p_stripe_customer_id: updatedSubscription.customer as string,
      p_status: updatedSubscription.status,
      p_current_period_start: safeToISO((updatedSubscription as any).current_period_start),
      p_current_period_end: safeToISO((updatedSubscription as any).current_period_end),
      p_cancel_at: safeToISO((updatedSubscription as any).cancel_at),
      p_canceled_at: safeToISO((updatedSubscription as any).canceled_at),
      p_metadata: metadata,
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription reactivated successfully',
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        cancel_at_period_end: updatedSubscription.cancel_at_period_end,
      },
    });
  } catch (error: any) {
    console.error('Error reactivating subscription:', error);
    return NextResponse.json(
      {
        error: 'Failed to reactivate subscription',
        details: error.message,
      },
      { status: 500 }
    );
  }
}


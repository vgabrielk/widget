import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

/**
 * Debug endpoint to check checkout and subscription status
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's widget
    const { data: widgets } = await supabase
      .from('widgets')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .order('created_at', { ascending: false });

    const widgetId = widgets?.[0]?.id;

    if (!widgetId) {
      return NextResponse.json(
        { error: 'No widget found', widgetId: null },
        { status: 200 }
      );
    }

    // Get customer from database
    const { data: stripeCustomer } = await supabase
      .from('stripe_customers')
      .select('*')
      .eq('widget_id', widgetId)
      .maybeSingle();

    const result: any = {
      widgetId,
      customer: {
        inDatabase: !!stripeCustomer,
        stripeCustomerId: stripeCustomer?.stripe_customer_id || null,
      },
      subscriptions: {
        inDatabase: [],
        inStripe: [],
      },
      checkoutSessions: [],
    };

    // Get subscriptions from database
    if (stripeCustomer?.stripe_customer_id) {
      const { data: dbSubscriptions } = await supabase
        .from('stripe_subscriptions')
        .select('*')
        .eq('stripe_customer_id', stripeCustomer.stripe_customer_id)
        .order('created_at', { ascending: false });

      result.subscriptions.inDatabase = dbSubscriptions || [];

      // Get subscriptions from Stripe
      try {
        const stripeSubscriptions = await stripe.subscriptions.list({
          customer: stripeCustomer.stripe_customer_id,
          status: 'all',
          limit: 10,
        });

        result.subscriptions.inStripe = stripeSubscriptions.data.map((sub) => ({
          id: sub.id,
          status: sub.status,
          created: new Date(sub.created * 1000).toISOString(),
          current_period_start: new Date((sub as any).current_period_start * 1000).toISOString(),
          current_period_end: new Date((sub as any).current_period_end * 1000).toISOString(),
          metadata: sub.metadata,
        }));

        // Get checkout sessions for this customer
        const sessions = await stripe.checkout.sessions.list({
          customer: stripeCustomer.stripe_customer_id,
          limit: 10,
        });

        result.checkoutSessions = sessions.data.map((session) => ({
          id: session.id,
          status: session.status,
          mode: session.mode,
          subscription: session.subscription,
          payment_status: session.payment_status,
          created: new Date(session.created * 1000).toISOString(),
          metadata: session.metadata,
        }));
      } catch (error: any) {
        if (
          error?.message?.includes('similar object exists in live mode') ||
          error?.message?.includes('No such customer')
        ) {
          result.error = 'Customer exists in different mode (live vs test)';
        } else {
          result.error = error.message;
        }
      }
    } else {
      // No customer in database - check if we can create one
      result.info = 'No customer found in database. Customer will be created on first checkout.';
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error in debug-checkout:', error);
    return NextResponse.json(
      { error: 'Failed to debug checkout', details: error.message },
      { status: 500 }
    );
  }
}


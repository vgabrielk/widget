import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

/**
 * Force sync subscription from Stripe to database
 * This is useful when webhook hasn't processed yet
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
        { error: 'No widget found' },
        { status: 404 }
      );
    }

    // Get Stripe customer from database first
    let { data: stripeCustomer } = await supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('widget_id', widgetId)
      .maybeSingle();

    let customerId = stripeCustomer?.stripe_customer_id;

    // If no customer in DB, try to find by email in Stripe
    if (!customerId && user.email) {
      try {
        console.log('[Sync] No customer in DB, searching by email:', user.email);
        const customers = await stripe.customers.list({
          email: user.email,
          limit: 10,
        });

        const matchingCustomer = customers.data.find((c) => {
          // Check if customer metadata has widget_id
          return c.metadata?.widget_id === widgetId || 
                 c.metadata?.user_id === user.id;
        });

        if (matchingCustomer) {
          console.log('[Sync] Found customer in Stripe by email:', matchingCustomer.id);
          customerId = matchingCustomer.id;

          // Sync customer to database
          await supabase.rpc('sync_stripe_customer', {
            p_widget_id: widgetId,
            p_stripe_customer_id: matchingCustomer.id,
            p_email: matchingCustomer.email,
            p_name: matchingCustomer.name,
            p_metadata: matchingCustomer.metadata || {},
          });
        } else if (customers.data.length > 0) {
          // Use first customer if found (might be from different widget)
          console.log('[Sync] Using first customer found:', customers.data[0].id);
          customerId = customers.data[0].id;

          // Sync customer to database
          await supabase.rpc('sync_stripe_customer', {
            p_widget_id: widgetId,
            p_stripe_customer_id: customers.data[0].id,
            p_email: customers.data[0].email,
            p_name: customers.data[0].name,
            p_metadata: customers.data[0].metadata || {},
          });
        }
      } catch (error: any) {
        console.error('[Sync] Error searching for customer by email:', error);
      }
    }

    if (!customerId) {
      return NextResponse.json(
        {
          error: 'No Stripe customer found',
          message:
            'Nenhum customer encontrado no Stripe. Você precisa criar uma assinatura primeiro através do checkout.',
          suggestion: 'Tente assinar um plano na página de billing.',
        },
        { status: 404 }
      );
    }

    // Fetch subscriptions from Stripe
    let subscriptions;
    try {
      subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 10,
      });
    } catch (error: any) {
      if (
        error?.message?.includes('similar object exists in live mode') ||
        error?.message?.includes('No such customer')
      ) {
        return NextResponse.json(
          {
            error: 'Customer exists in different mode',
            message:
              'O customer foi criado em outro modo (live/test). Limpe os dados antigos.',
          },
          { status: 400 }
        );
      }
      throw error;
    }

    if (subscriptions.data.length === 0) {
      return NextResponse.json(
        { message: 'No subscriptions found in Stripe', synced: false },
        { status: 200 }
      );
    }

    // Find active or trialing subscription
    const activeSubscription = subscriptions.data.find(
      (sub) => sub.status === 'active' || sub.status === 'trialing'
    );

    if (!activeSubscription) {
      return NextResponse.json(
        {
          message: 'No active subscription found',
          subscriptions: subscriptions.data.map((sub) => ({
            id: sub.id,
            status: sub.status,
          })),
        },
        { status: 200 }
      );
    }

    // Sync subscription to database
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

    const { error: syncError } = await supabase.rpc('sync_stripe_subscription', {
      p_widget_id: widgetId,
      p_stripe_subscription_id: activeSubscription.id,
      p_stripe_customer_id: customerId,
      p_status: activeSubscription.status,
      p_current_period_start: safeToISO((activeSubscription as any).current_period_start),
      p_current_period_end: safeToISO((activeSubscription as any).current_period_end),
      p_cancel_at: safeToISO((activeSubscription as any).cancel_at),
      p_canceled_at: safeToISO((activeSubscription as any).canceled_at),
      p_metadata: activeSubscription.metadata || {},
    });

    if (syncError) {
      console.error('Error syncing subscription:', syncError);
      return NextResponse.json(
        { error: 'Failed to sync subscription', details: syncError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'Subscription synced successfully',
        subscription: {
          id: activeSubscription.id,
          status: activeSubscription.status,
          current_period_end: new Date(
            (activeSubscription as any).current_period_end * 1000
          ).toISOString(),
        },
        synced: true,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in sync-subscription:', error);
    return NextResponse.json(
      { error: 'Failed to sync subscription', details: error.message },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

/**
 * Debug endpoint to check subscription status
 * GET /api/debug/subscription-status
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

    const debugInfo: any = {
      userId: user.id,
      email: user.email,
      timestamp: new Date().toISOString(),
    };

    // Get widgets
    const { data: widgets } = await supabase
      .from('widgets')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const widgetId = widgets?.[0]?.id;
    debugInfo.widgetId = widgetId;

    if (!widgetId) {
      return NextResponse.json({
        ...debugInfo,
        error: 'No widget found',
      });
    }

    // Check customer in DB
    const { data: dbCustomer } = await supabase
      .from('stripe_customers')
      .select('*')
      .eq('widget_id', widgetId)
      .maybeSingle();

    debugInfo.customerInDB = dbCustomer ? {
      id: dbCustomer.id,
      stripe_customer_id: dbCustomer.stripe_customer_id,
      email: dbCustomer.email,
    } : null;

    // Check subscriptions in DB
    const { data: dbSubscriptions } = await supabase
      .from('stripe_subscriptions')
      .select('*')
      .eq('widget_id', widgetId)
      .order('created_at', { ascending: false });

    debugInfo.subscriptionsInDB = dbSubscriptions || [];

    // Check Stripe directly
    let stripeCustomers: any[] = [];
    let stripeSubscriptions: any[] = [];

    if (user.email) {
      try {
        // Search by email
        const customers = await stripe.customers.list({
          email: user.email,
          limit: 10,
        });
        stripeCustomers = customers.data.map((c) => ({
          id: c.id,
          email: c.email,
          metadata: c.metadata,
          created: new Date(c.created * 1000).toISOString(),
        }));

        // Check subscriptions for each customer
        for (const customer of customers.data) {
          try {
            const subs = await stripe.subscriptions.list({
              customer: customer.id,
              status: 'all',
              limit: 10,
            });
            stripeSubscriptions.push(...subs.data.map((sub) => ({
              id: sub.id,
              customer: sub.customer,
              status: sub.status,
              current_period_start: new Date((sub as any).current_period_start * 1000).toISOString(),
              current_period_end: new Date((sub as any).current_period_end * 1000).toISOString(),
              created: new Date((sub as any).created * 1000).toISOString(),
              metadata: sub.metadata,
            })));
          } catch (err: any) {
            stripeSubscriptions.push({
              customer: customer.id,
              error: err.message,
            });
          }
        }
      } catch (error: any) {
        debugInfo.stripeError = error.message;
      }
    }

    debugInfo.stripeCustomers = stripeCustomers;
    debugInfo.stripeSubscriptions = stripeSubscriptions;

    // Check entitlements
    const { getUserEntitlements } = await import('@/lib/stripe/entitlements');
    const entitlements = await getUserEntitlements(user.id);

    debugInfo.entitlements = {
      plan: entitlements.plan,
      isPro: entitlements.isPro,
      isFree: entitlements.isFree,
      features: entitlements.features,
    };

    // Recommendations
    debugInfo.recommendations = [];

    if (!dbCustomer && stripeCustomers.length === 0) {
      debugInfo.recommendations.push('Crie uma assinatura através do checkout');
    }

    if (stripeCustomers.length > 0 && !dbCustomer) {
      debugInfo.recommendations.push('Sincronize o customer do Stripe para o banco');
    }

    if (stripeSubscriptions.length > 0 && dbSubscriptions?.length === 0) {
      debugInfo.recommendations.push('Sincronize as subscriptions do Stripe para o banco');
    }

    const activeStripeSub = stripeSubscriptions.find(
      (sub) => sub.status === 'active' || sub.status === 'trialing'
    );

    if (activeStripeSub && !dbSubscriptions?.find((s) => s.status === 'active' || s.status === 'trialing')) {
      debugInfo.recommendations.push('Sincronização automática falhou - execute sync manualmente');
    }

    return NextResponse.json(debugInfo, { status: 200 });
  } catch (error: any) {
    console.error('Error in debug subscription-status:', error);
    return NextResponse.json(
      { error: 'Failed to debug', details: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}


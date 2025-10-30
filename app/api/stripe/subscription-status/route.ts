import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const widgetId = searchParams.get('widgetId');

    if (!widgetId) {
      return NextResponse.json(
        { error: 'Missing required parameter: widgetId' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get subscription status for the widget
    const { data: subscription, error } = await supabase
      .from('stripe_subscriptions')
      .select(`
        *,
        stripe_customers!inner(
          widget_id,
          email,
          name
        )
      `)
      .eq('stripe_customers.widget_id', widgetId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching subscription:', error);
      return NextResponse.json(
        { error: 'Failed to fetch subscription' },
        { status: 500 }
      );
    }

    if (!subscription) {
      return NextResponse.json(
        { 
          hasSubscription: false,
          subscription: null,
        },
        { status: 200 }
      );
    }

    // Check if subscription is active
    const isActive = 
      subscription.status === 'active' && 
      new Date(subscription.current_period_end) > new Date();

    return NextResponse.json(
      { 
        hasSubscription: true,
        isActive,
        subscription: {
          id: subscription.stripe_subscription_id,
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end,
          cancelAt: subscription.cancel_at,
          canceledAt: subscription.canceled_at,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return NextResponse.json(
      { error: 'Failed to check subscription status' },
      { status: 500 }
    );
  }
}


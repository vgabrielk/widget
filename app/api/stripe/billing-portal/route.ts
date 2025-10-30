import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createBillingPortalSession } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { widgetId, returnUrl } = body;

    // Validate required fields
    if (!widgetId) {
      return NextResponse.json(
        { error: 'Missing required field: widgetId' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Get the widget's Stripe customer ID
    const { data: stripeCustomer, error } = await supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('widget_id', widgetId)
      .single();

    if (error || !stripeCustomer) {
      return NextResponse.json(
        { error: 'No Stripe customer found for this widget' },
        { status: 404 }
      );
    }

    // Create billing portal session
    const session = await createBillingPortalSession(
      stripeCustomer.stripe_customer_id,
      returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
    );

    return NextResponse.json(
      { 
        url: session.url,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error creating billing portal session:', error);
    return NextResponse.json(
      { error: 'Failed to create billing portal session' },
      { status: 500 }
    );
  }
}


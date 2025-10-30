import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createCheckoutSession } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { priceId, widgetId, email, successUrl, cancelUrl } = body;

    // Validate required fields
    if (!priceId || !widgetId) {
      return NextResponse.json(
        { error: 'Missing required fields: priceId and widgetId' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Verify widget exists and is active
    const { data: widget, error: widgetError } = await supabase
      .from('widgets')
      .select('id, name, is_active')
      .eq('id', widgetId)
      .single();

    if (widgetError || !widget) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      );
    }

    if (!widget.is_active) {
      return NextResponse.json(
        { error: 'Widget is not active' },
        { status: 403 }
      );
    }

    // Check if widget already has a Stripe customer
    const { data: stripeCustomer } = await supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('widget_id', widgetId)
      .single();

    // Create checkout session
    const session = await createCheckoutSession({
      customerId: stripeCustomer?.stripe_customer_id,
      customerEmail: email,
      priceId,
      widgetId,
      successUrl: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/success`,
      cancelUrl: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      metadata: {
        widget_name: widget.name,
      },
    });

    return NextResponse.json(
      { 
        sessionId: session.id,
        url: session.url,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}


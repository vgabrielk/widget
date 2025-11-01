import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { priceId, widgetId, trialDays = 4, email, price, currency = 'brl' } = body;

    // Validate required fields
    if (!widgetId) {
      return NextResponse.json(
        { error: 'Missing required field: widgetId' },
        { status: 400 }
      );
    }

    // Either priceId or price must be provided
    if (!priceId && !price) {
      return NextResponse.json(
        { error: 'Either priceId or price must be provided' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify widget exists
    const { data: widget, error: widgetError } = await supabase
      .from('widgets')
      .select('id, user_id')
      .eq('id', widgetId)
      .single();

    if (widgetError || !widget) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      );
    }

    // Get or create Stripe customer
    let customerId: string;
    const { data: existingCustomer } = await supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('widget_id', widgetId)
      .single();

    if (existingCustomer?.stripe_customer_id) {
      customerId = existingCustomer.stripe_customer_id;

      // Validate customer exists in current Stripe mode
      try {
        // Try to retrieve customer to verify it exists in current mode
        await stripe.customers.retrieve(customerId);
        
        // Check for active subscriptions in database
        const { data: dbSubscriptions } = await supabase
          .from('stripe_subscriptions')
          .select('*')
          .eq('stripe_customer_id', customerId)
          .in('status', ['active', 'trialing']);

        // Validate subscriptions from DB are actually active
        const validActiveSubscriptions = dbSubscriptions?.filter((sub) => {
          // Check if subscription period is valid
          if ((sub as any).current_period_end) {
            const periodEnd = new Date((sub as any).current_period_end * 1000);
            const now = new Date();
            // Subscription is active if period_end is in the future
            return periodEnd > now;
          }
          // If no period_end, trust the status
          return true;
        });

        if (validActiveSubscriptions && validActiveSubscriptions.length > 0) {
          console.log('Active subscription found in DB:', validActiveSubscriptions[0].stripe_subscription_id);
          return NextResponse.json(
            { error: 'Já existe uma assinatura ativa', subscriptionId: validActiveSubscriptions[0].stripe_subscription_id },
            { status: 400 }
          );
        }

        // Check Stripe directly
        const stripeSubscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: 'all',
          limit: 10,
        });

        // Find truly active subscriptions (active or trialing with valid period)
        const activeSub = stripeSubscriptions.data.find((sub) => {
          if (sub.status === 'active' || sub.status === 'trialing') {
            // For trialing/active, check period_end is in future
            const periodEnd = new Date((sub as any).current_period_end * 1000);
            const now = new Date();
            return periodEnd > now;
          }
          return false;
        });

        if (activeSub) {
          console.log('Active subscription found in Stripe:', activeSub.id);
          
          // Sync it to database if not there
          if (!validActiveSubscriptions || validActiveSubscriptions.length === 0) {
            console.log('Syncing active subscription to database...');
            try {
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

              await supabase.rpc('sync_stripe_subscription', {
                p_widget_id: widgetId,
                p_stripe_subscription_id: activeSub.id,
                p_stripe_customer_id: activeSub.customer as string,
                p_status: activeSub.status,
                p_current_period_start: safeToISO((activeSub as any).current_period_start),
                p_current_period_end: safeToISO((activeSub as any).current_period_end),
                p_cancel_at: safeToISO((activeSub as any).cancel_at),
                p_canceled_at: safeToISO((activeSub as any).canceled_at),
                p_metadata: activeSub.metadata || {},
              });
            } catch (syncError) {
              console.error('Error syncing subscription:', syncError);
            }
          }
          
          return NextResponse.json(
            { error: 'Já existe uma assinatura ativa', subscriptionId: activeSub.id },
            { status: 400 }
          );
        }
      } catch (error: any) {
        // Handle customer mode mismatch (e.g., customer in live mode but using test keys)
        if (error?.message?.includes('similar object exists in live mode') || 
            error?.message?.includes('No such customer') ||
            error?.code === 'resource_missing') {
          console.warn(`Customer ${customerId} exists in different mode. Cleaning up and creating new customer.`);
          
          // Delete the customer from database since it's from wrong mode
          await supabase
            .from('stripe_customers')
            .delete()
            .eq('stripe_customer_id', customerId);
          
          // Delete associated subscriptions
          await supabase
            .from('stripe_subscriptions')
            .delete()
            .eq('stripe_customer_id', customerId);
          
          // Set customerId to null to create a new one
          customerId = undefined;
        } else {
          console.error('Error validating customer:', error);
          // On other errors, still try to create new customer
          customerId = undefined;
        }
      }
    }
    
    // Create new customer if none exists or was invalid
    if (!customerId) {
      const { data: user } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      const customer = await stripe.customers.create({
        email: email || user.user.email || undefined,
        metadata: {
          widget_id: widgetId,
          user_id: user.user.id,
        },
      });

      customerId = customer.id;

      // Save customer to database
      await supabase.rpc('sync_stripe_customer', {
        p_widget_id: widgetId,
        p_stripe_customer_id: customer.id,
        p_email: customer.email,
        p_name: customer.name,
        p_metadata: customer.metadata || {},
      });
    }

    // Calculate trial end (trialDays from now)
    const trialEnd = Math.floor(Date.now() / 1000) + trialDays * 24 * 60 * 60;

    // Create checkout session
    const sessionParams: any = {
      mode: 'subscription',
      customer: customerId,
      payment_method_types: ['card'],
      subscription_data: {
        trial_end: trialEnd,
        metadata: {
          widget_id: widgetId,
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing?canceled=true`,
      metadata: {
        widget_id: widgetId,
      },
    };

    // Add line items
    if (priceId) {
      // Use existing price
      sessionParams.line_items = [
        {
          price: priceId,
          quantity: 1,
        },
      ];
    } else {
      // Create dynamic price
      const unitAmount = Math.round((price as number) * 100); // Convert to cents

      sessionParams.line_items = [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: 'Plano Pro',
              description: 'Acesso completo a todas as funcionalidades',
            },
            unit_amount: unitAmount,
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json(
      {
        sessionId: session.id,
        url: session.url,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    
    // Extract more detailed error message
    const errorMessage = error?.message || 'Failed to create checkout session';
    const statusCode = error?.statusCode || 500;

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}


import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { PlanCard } from '@/components/billing/plan-card';
import { BillingInfo } from '@/components/billing/billing-info';
import { PaymentSuccessModal } from '@/components/billing/payment-success-modal';
import { UpgradeRequiredBanner } from '@/components/billing/upgrade-required-banner';
import { Suspense } from 'react';

export default async function BillingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Get user's first widget (needed for Stripe checkout)
  // If no widget exists, create one automatically
  let { data: widgets } = await supabase
    .from('widgets')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .order('created_at', { ascending: false });

  let widgetId = widgets?.[0]?.id || null;

  // Create a widget if user doesn't have any (needed for Stripe checkout)
  if (!widgetId) {
    const { data: newWidget, error: createError } = await supabase
      .from('widgets')
      .insert({
        user_id: user.id,
        name: 'My Chat Widget',
        is_active: true,
        brand_color: '#6366f1',
        position: 'bottom-right',
        welcome_message: 'Olá! Como posso ajudar você hoje?',
        language: 'pt-BR',
      })
      .select('id')
      .single();

    if (!createError && newWidget) {
      widgetId = newWidget.id;
    } else if (createError) {
      console.error('Error creating widget for billing:', createError);
    }
  }

  // Get subscription from Stripe
  let subscription = null;
  let isTrialing = false;
  let trialEndDate: Date | null = null;

  if (widgetId) {
    // First, get the Stripe customer ID
    let { data: stripeCustomer } = await supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('widget_id', widgetId)
      .maybeSingle();

    let customerId = stripeCustomer?.stripe_customer_id;

    // If no customer in DB, try to find by user email in Stripe
    if (!customerId && user.email) {
      try {
        const { stripe } = await import('@/lib/stripe');
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
          
          // Sync customer to database
          await supabase.rpc('sync_stripe_customer', {
            p_widget_id: widgetId,
            p_stripe_customer_id: foundCustomer.id,
            p_email: foundCustomer.email || null,
            p_name: foundCustomer.name || null,
            p_metadata: foundCustomer.metadata || {},
          });

          // Sync subscriptions too
          try {
            const subscriptions = await stripe.subscriptions.list({
              customer: foundCustomer.id,
              status: 'all',
              limit: 10,
            });

            const activeSubscriptions = subscriptions.data.filter(
              (sub) => sub.status === 'active' || sub.status === 'trialing'
            );

            for (const sub of activeSubscriptions) {
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
                p_stripe_subscription_id: sub.id,
                p_stripe_customer_id: sub.customer as string,
                p_status: sub.status,
                p_current_period_start: safeToISO((sub as any).current_period_start),
                p_current_period_end: safeToISO((sub as any).current_period_end),
                p_cancel_at: safeToISO((sub as any).cancel_at),
                p_canceled_at: safeToISO((sub as any).canceled_at),
                p_metadata: sub.metadata || {},
              });
            }
          } catch (error) {
            console.error('Error syncing subscriptions:', error);
          }
        }
      } catch (error) {
        console.error('Error searching for customer by email:', error);
      }
    }

    if (customerId) {
      // Re-fetch customer from DB after sync
      const { data: refreshedCustomer } = await supabase
        .from('stripe_customers')
        .select('stripe_customer_id')
        .eq('widget_id', widgetId)
        .maybeSingle();
      
      stripeCustomer = refreshedCustomer;
    }

    if (stripeCustomer?.stripe_customer_id || customerId) {
      const finalCustomerId = stripeCustomer?.stripe_customer_id || customerId;
      // Get Stripe subscription from database first
      const { data: stripeSubscription } = await supabase
        .from('stripe_subscriptions')
        .select('*')
        .eq('stripe_customer_id', finalCustomerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      subscription = stripeSubscription || null;

      // If no subscription in DB, check Stripe API directly
      // This handles cases where webhook hasn't synced yet
      if (!subscription) {
        try {
          const { stripe } = await import('@/lib/stripe');
          const stripeSubscriptions = await stripe.subscriptions.list({
            customer: finalCustomerId,
            status: 'all',
            limit: 10,
          });

          const activeSubscription = stripeSubscriptions.data.find(
            (sub) => sub.status === 'active' || sub.status === 'trialing'
          );

          if (activeSubscription) {
            // Found subscription in Stripe - sync it to database
            console.log('Found subscription in Stripe but not in DB, syncing...');
            
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

            const syncedSubscription = await supabase.rpc('sync_stripe_subscription', {
              p_widget_id: widgetId,
              p_stripe_subscription_id: activeSubscription.id,
              p_stripe_customer_id: activeSubscription.customer as string,
              p_status: activeSubscription.status,
              p_current_period_start: safeToISO((activeSubscription as any).current_period_start),
              p_current_period_end: safeToISO((activeSubscription as any).current_period_end),
              p_cancel_at: safeToISO((activeSubscription as any).cancel_at),
              p_canceled_at: safeToISO((activeSubscription as any).canceled_at),
              p_metadata: activeSubscription.metadata || {},
            });

            // Get the synced subscription from DB
            const { data: syncedData } = await supabase
              .from('stripe_subscriptions')
              .select('*')
              .eq('stripe_customer_id', finalCustomerId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            subscription = syncedData || null;
          }
        } catch (error: any) {
          // Handle mode mismatch - customer might be from different mode
          if (error?.message?.includes('similar object exists in live mode') || 
              error?.message?.includes('No such customer')) {
            console.warn('Customer exists in different mode, cleaning up...');
            // Clean up will be handled by entitlements middleware
          } else {
            console.error('Error fetching subscription from Stripe:', error);
          }
        }
      }

      // Check if subscription is in trial
      if (subscription?.status === 'trialing') {
        isTrialing = true;
        if (subscription.current_period_end) {
          try {
            const date = new Date(subscription.current_period_end);
            if (!isNaN(date.getTime())) {
              trialEndDate = date;
            }
          } catch (error) {
            console.error('Error parsing trial end date:', error);
          }
        }
      } else if (subscription?.status === 'active') {
        if (subscription.current_period_end) {
          try {
            const date = new Date(subscription.current_period_end);
            if (!isNaN(date.getTime())) {
              trialEndDate = date;
            }
          } catch (error) {
            console.error('Error parsing period end date:', error);
          }
        }
      }
    }
  }

  // Fallback to old subscriptions table if needed
  const { data: legacySubscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  const plan =
    subscription?.status === 'active' || subscription?.status === 'trialing'
      ? 'pro'
      : legacySubscription?.plan || 'free';

  const isActive =
    subscription?.status === 'active' ||
    subscription?.status === 'trialing' ||
    legacySubscription?.status === 'active';

  return (
    <DashboardLayout
      email={user.email || ''}
      title="Planos e Assinatura"
      description="Gerencie sua assinatura e pagamentos"
    >
      <div className="space-y-6">
        <Suspense fallback={null}>
          <PaymentSuccessModal />
          <UpgradeRequiredBanner />
        </Suspense>

        {/* Current Plan Info */}
        <BillingInfo
          subscription={subscription}
          isTrialing={isTrialing}
          trialEndDate={trialEndDate}
          plan={plan}
          isActive={isActive}
        />

        {/* Available Plans */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Free Plan */}
          <PlanCard
            name="Free"
            price={0}
            description="Plano gratuito com recursos básicos"
            features={[
              '1 Widget',
              '100 mensagens/mês',
              'Suporte básico',
              'Personalização básica',
            ]}
            isCurrent={plan === 'free'}
            widgetId={widgetId}
            disabled={plan === 'free'}
          />

          {/* Pro Plan */}
          <PlanCard
            name="Pro"
            price={29.9}
            description="Plano completo com todas as funcionalidades"
            isPopular
            isCurrent={plan === 'pro'}
            widgetId={widgetId}
            features={[
              'Mensagens ilimitadas',
              'Suporte prioritário',
              'Personalização avançada',
              'Múltiplos widgets',
              'Analytics avançado',
              'Acesso à API',
              'Webhooks',
              'Remoção de marca',
            ]}
            disabled={plan === 'pro'}
          />

          {/* Enterprise Plan */}
          <PlanCard
            name="Enterprise"
            price="Custom"
            description="Solução personalizada para grandes empresas"
            features={[
              'Widgets ilimitados',
              'Mensagens ilimitadas',
              'Suporte dedicado 24/7',
              'SLA garantido',
              'Personalização completa',
              'Treinamento da equipe',
            ]}
            contactEmail="contato@example.com"
            widgetId={widgetId}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}

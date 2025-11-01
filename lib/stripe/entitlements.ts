import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

/**
 * Feature lookup keys for Stripe Entitlements
 * These must match the lookup_keys created in Stripe Dashboard or via API
 */
export const FEATURES = {
  UNLIMITED_MESSAGES: 'unlimited_messages',
  PRIORITY_SUPPORT: 'priority_support',
  WIDGET_CUSTOMIZATION: 'widget_customization',
  MULTIPLE_WIDGETS: 'multiple_widgets',
  ADVANCED_ANALYTICS: 'advanced_analytics',
  API_ACCESS: 'api_access',
  WEBHOOKS: 'webhooks',
  BRAND_REMOVAL: 'brand_removal',
} as const;

export type FeatureKey = typeof FEATURES[keyof typeof FEATURES];

export interface UserEntitlements {
  plan: 'free' | 'pro';
  features: FeatureKey[];
  hasFeature: (feature: FeatureKey) => boolean;
  isPro: boolean;
  isFree: boolean;
}

/**
 * Get active entitlements for a Stripe customer
 */
async function getStripeActiveEntitlements(
  customerId: string
): Promise<Stripe.Entitlements.ActiveEntitlement[]> {
  try {
    const activeEntitlements = await stripe.entitlements.activeEntitlements.list({
      customer: customerId,
      limit: 100,
    });
    return activeEntitlements.data;
  } catch (error) {
    console.error('Error fetching active entitlements from Stripe:', error);
    return [];
  }
}

/**
 * Get user entitlements from database and Stripe
 */
export async function getUserEntitlements(
  userId: string
): Promise<UserEntitlements> {
  const supabase = await createClient();

  // Get user's widgets (required for Stripe integration)
  const { data: widgets } = await supabase
    .from('widgets')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .order('created_at', { ascending: false });

  const widgetId = widgets?.[0]?.id;
  const hasWidgets = widgets && widgets.length > 0;

  // If user has no widgets, they can create first one (free plan allows 1 widget)
  // But we still need to check if they have subscription for other features
  if (!widgetId) {
    // Check if user has subscription via email (before creating widget)
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.email) {
        const { stripe } = await import('@/lib/stripe');
        const customers = await stripe.customers.list({
          email: userData.user.email,
          limit: 10,
        });

        // Check if any customer has active subscription
        for (const customer of customers.data) {
          try {
            const subscriptions = await stripe.subscriptions.list({
              customer: customer.id,
              status: 'all',
              limit: 10,
            });

            const hasActive = subscriptions.data.some(
              (sub) => sub.status === 'active' || sub.status === 'trialing'
            );

            if (hasActive) {
              console.log('[Entitlements] User has active subscription but no widget yet');
              // User has subscription but no widget - they're Pro
              return {
                plan: 'pro',
                features: [],
                hasFeature: () => true, // Pro users have all features
                isPro: true,
                isFree: false,
              };
            }
          } catch (error) {
            // Continue checking other customers
            continue;
          }
        }
      }
    } catch (error) {
      console.error('[Entitlements] Error checking subscription without widget:', error);
    }

    // No widget and no subscription = free plan (but can create first widget)
    return {
      plan: 'free',
      features: [],
      hasFeature: () => false,
      isPro: false,
      isFree: true,
    };
  }

  // Get Stripe customer ID from database
  let { data: stripeCustomer } = await supabase
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('widget_id', widgetId)
    .maybeSingle();

  let customerId = stripeCustomer?.stripe_customer_id;

  // If no customer in DB, try to find by user email in Stripe
  if (!customerId) {
    try {
      // Get user email to search in Stripe
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.email) {
        console.log('[Entitlements] No customer in DB, searching by email:', userData.user.email);
        const { stripe } = await import('@/lib/stripe');
        const customers = await stripe.customers.list({
          email: userData.user.email,
          limit: 10,
        });

        // Try to find customer with matching widget_id or user_id in metadata
        const matchingCustomer = customers.data.find((c) => {
          return c.metadata?.widget_id === widgetId || 
                 c.metadata?.user_id === userData.user.id;
        });

        let foundCustomer = matchingCustomer || (customers.data.length > 0 ? customers.data[0] : null);
        
        if (foundCustomer) {
          console.log('[Entitlements] Found customer in Stripe by email:', foundCustomer.id);
          customerId = foundCustomer.id;

          // Sync customer to database
          const { error: customerSyncError } = await supabase.rpc('sync_stripe_customer', {
            p_widget_id: widgetId,
            p_stripe_customer_id: foundCustomer.id,
            p_email: foundCustomer.email || null,
            p_name: foundCustomer.name || null,
            p_metadata: foundCustomer.metadata || {},
          });

          if (customerSyncError) {
            console.error('[Entitlements] Error syncing customer to DB:', customerSyncError);
          } else {
            console.log('[Entitlements] Customer synced to database successfully');
            
            // Now fetch and sync active subscriptions for this customer
            try {
              const { stripe } = await import('@/lib/stripe');
              const subscriptions = await stripe.subscriptions.list({
                customer: foundCustomer.id,
                status: 'all',
                limit: 10,
              });

              const activeSubscriptions = subscriptions.data.filter(
                (sub) => sub.status === 'active' || sub.status === 'trialing'
              );

              console.log(`[Entitlements] Found ${activeSubscriptions.length} active subscription(s) for customer`);

              // Sync each active subscription
              for (const subscription of activeSubscriptions) {
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

                const { error: subSyncError } = await supabase.rpc('sync_stripe_subscription', {
                  p_widget_id: widgetId,
                  p_stripe_subscription_id: subscription.id,
                  p_stripe_customer_id: subscription.customer as string,
                  p_status: subscription.status,
                  p_current_period_start: safeToISO((subscription as any).current_period_start),
                  p_current_period_end: safeToISO((subscription as any).current_period_end),
                  p_cancel_at: safeToISO((subscription as any).cancel_at),
                  p_canceled_at: safeToISO((subscription as any).canceled_at),
                  p_metadata: subscription.metadata || {},
                });

                if (subSyncError) {
                  console.error('[Entitlements] Error syncing subscription:', subSyncError);
                } else {
                  console.log(`[Entitlements] Subscription ${subscription.id} synced successfully`);
                }
              }
            } catch (error) {
              console.error('[Entitlements] Error fetching subscriptions from Stripe:', error);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('[Entitlements] Error searching for customer by email:', error);
      // Continue without customer - will return free plan
    }
  }

  if (!customerId) {
    // No Stripe customer means free plan
    console.log('[Entitlements] No Stripe customer found, returning free plan');
    return {
      plan: 'free',
      features: [],
      hasFeature: () => false,
      isPro: false,
      isFree: true,
    };
  }

  // Get subscription from database (check all statuses first to see what exists)
  let { data: allSubscriptions } = await supabase
    .from('stripe_subscriptions')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`[Entitlements] All subscriptions from DB:`, allSubscriptions?.map(s => ({
    id: s.stripe_subscription_id,
    status: s.status,
    cancel_at_period_end: s.metadata?.cancel_at_period_end || s.cancel_at_period_end,
  })) || 'NONE');

  // Try to find active or trialing subscription first
  let subscription = allSubscriptions?.find(
    (s) => s.status === 'active' || s.status === 'trialing'
  );

  // If no active subscription found, check if there's a recently canceled one that might still be valid
  if (!subscription && allSubscriptions && allSubscriptions.length > 0) {
    // Check if any subscription has cancel_at_period_end and is still within period
    const scheduledCancellation = allSubscriptions.find((s) => {
      const cancelAtPeriodEnd = s.metadata?.cancel_at_period_end === 'true' || s.cancel_at_period_end === true;
      if (cancelAtPeriodEnd && s.current_period_end) {
        try {
          const periodEnd = new Date(s.current_period_end);
          const now = new Date();
          return periodEnd > now;
        } catch {
          return false;
        }
      }
      return false;
    });
    
    if (scheduledCancellation) {
      subscription = scheduledCancellation;
      console.log('[Entitlements] Found subscription with scheduled cancellation still valid');
    }
  }
  
  console.log(`[Entitlements] Selected subscription:`, subscription ? {
    id: subscription.stripe_subscription_id,
    status: subscription.status,
    cancel_at_period_end: subscription.metadata?.cancel_at_period_end || subscription.cancel_at_period_end,
  } : 'NOT FOUND');

  // Validate customer exists in current Stripe mode before checking subscriptions
  let customerValid = true;
  try {
    await stripe.customers.retrieve(customerId);
  } catch (error: any) {
    // Customer doesn't exist in current mode (probably from different mode)
    if (error?.message?.includes('similar object exists in live mode') || 
        error?.message?.includes('No such customer') ||
        error?.code === 'resource_missing') {
      console.warn(`Customer ${customerId} exists in different mode. Returning free plan.`);
      customerValid = false;
      
      // Clean up invalid customer data
      await supabase
        .from('stripe_customers')
        .delete()
        .eq('stripe_customer_id', customerId);
      
      await supabase
        .from('stripe_subscriptions')
        .delete()
        .eq('stripe_customer_id', customerId);
    }
  }

  if (!customerValid) {
    return {
      plan: 'free',
      features: [],
      hasFeature: () => false,
      isPro: false,
      isFree: true,
    };
  }

  // If no active subscription in DB, check Stripe directly (webhook might not have synced yet)
  if (!subscription) {
    try {
      const stripeSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 10,
      });

      // Check for active or trialing subscriptions
      const activeSubscription = stripeSubscriptions.data.find(
        (sub) => sub.status === 'active' || sub.status === 'trialing'
      );

      if (activeSubscription) {
        // Subscription exists in Stripe but not in DB - sync it immediately
        console.log('[Entitlements] Found active subscription in Stripe but not in DB, syncing...');
        
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
          const { data: syncedSubscriptions } = await supabase
            .from('stripe_subscriptions')
            .select('*')
            .eq('stripe_customer_id', customerId)
            .order('created_at', { ascending: false })
            .limit(1);

          subscription = syncedSubscriptions?.[0] || null;
          console.log('[Entitlements] Subscription synced successfully:', subscription?.stripe_subscription_id);
        } catch (syncError) {
          console.error('[Entitlements] Error syncing subscription from Stripe:', syncError);
          // Even if sync fails, use the subscription from Stripe for entitlements
          // Create a temporary subscription object with all necessary fields
          const metadata: any = activeSubscription.metadata || {};
          if (activeSubscription.cancel_at_period_end !== undefined) {
            metadata.cancel_at_period_end = activeSubscription.cancel_at_period_end.toString();
          }
          
          subscription = {
            status: activeSubscription.status,
            current_period_end: new Date((activeSubscription as any).current_period_end * 1000).toISOString(),
            metadata,
            cancel_at_period_end: activeSubscription.cancel_at_period_end,
          } as any;
        }
      } else {
        // No active subscription found - check if there are any subscriptions at all (canceled, etc.)
        const allSubscriptions = stripeSubscriptions.data;
        if (allSubscriptions.length > 0) {
          console.log('[Entitlements] Found subscriptions but none are active:', allSubscriptions.map(s => s.status));
        }
        
        // No active subscription = free plan
        return {
          plan: 'free',
          features: [],
          hasFeature: () => false,
          isPro: false,
          isFree: true,
        };
      }
    } catch (error: any) {
      // Handle mode mismatch errors
      if (error?.message?.includes('similar object exists in live mode') || 
          error?.message?.includes('No such customer')) {
        console.warn('Customer exists in different mode, returning free plan');
        return {
          plan: 'free',
          features: [],
          hasFeature: () => false,
          isPro: false,
          isFree: true,
        };
      }
      
      console.error('Error checking Stripe subscriptions:', error);
      // Fail gracefully - return free plan
      return {
        plan: 'free',
        features: [],
        hasFeature: () => false,
        isPro: false,
        isFree: true,
      };
    }
  }

  // Validate subscription is actually active (check status, period_end, and cancellation)
  let isSubscriptionActive = false;
  if (subscription) {
    // Check if subscription is canceled (immediate cancellation)
    if (subscription.status === 'canceled') {
      console.log('[Entitlements] Subscription is canceled');
      isSubscriptionActive = false;
    }
    // Check if subscription is active or trialing
    else if (subscription.status === 'active' || subscription.status === 'trialing') {
      // Check if subscription is scheduled for cancellation (cancel_at_period_end)
      const cancelAtPeriodEnd = subscription.metadata?.cancel_at_period_end === 'true' ||
                                 subscription.cancel_at_period_end === true;
      
      if (cancelAtPeriodEnd) {
        // Subscription is scheduled for cancellation, but still active until period_end
        // Check if period_end is in the future
        if (subscription.current_period_end) {
          try {
            const periodEnd = new Date(subscription.current_period_end);
            const now = new Date();
            isSubscriptionActive = periodEnd > now && !isNaN(periodEnd.getTime());
            console.log('[Entitlements] Subscription scheduled for cancellation, active until:', periodEnd.toISOString());
          } catch (error) {
            console.error('[Entitlements] Error parsing period_end:', error);
            // If we can't parse, subscription might be expired
            isSubscriptionActive = false;
          }
        } else {
          // No period_end but scheduled for cancellation - still active
          isSubscriptionActive = true;
        }
      } else {
        // Normal active subscription - check if period_end is in the future
        if (subscription.current_period_end) {
          try {
            const periodEnd = new Date(subscription.current_period_end);
            const now = new Date();
            isSubscriptionActive = periodEnd > now && !isNaN(periodEnd.getTime());
          } catch (error) {
            console.error('[Entitlements] Error parsing period_end:', error);
            // If we can't parse, trust the status
            isSubscriptionActive = true;
          }
        } else {
          // No period_end, trust the status
          isSubscriptionActive = true;
        }
      }
    }
    // For any other status (past_due, incomplete, etc.), subscription is not active
    else {
      console.log('[Entitlements] Subscription status is not active:', subscription.status);
      isSubscriptionActive = false;
    }
  }

  // Get active entitlements from Stripe (optional - subscription status is primary)
  let activeEntitlements: Stripe.Entitlements.ActiveEntitlement[] = [];
  try {
    activeEntitlements = await getStripeActiveEntitlements(
      customerId
    );
  } catch (error) {
    console.error('[Entitlements] Error fetching entitlements:', error);
    // Continue without entitlements - subscription status is what matters
  }

  // Extract feature lookup keys from entitlements
  const featureKeys: FeatureKey[] = activeEntitlements
    .map((entitlement) => {
      const feature = (entitlement as any).feature;
      return feature?.lookup_key as FeatureKey;
    })
    .filter((key): key is FeatureKey => key !== undefined);

  // User is Pro if they have active subscription OR entitlements
  const isPro = isSubscriptionActive || featureKeys.length > 0;

  console.log('[Entitlements] Final determination:', {
    subscriptionStatus: subscription?.status,
    isSubscriptionActive,
    entitlementsCount: featureKeys.length,
    isPro,
  });

  return {
    plan: isPro ? 'pro' : 'free',
    features: featureKeys,
    hasFeature: (feature: FeatureKey) => featureKeys.includes(feature),
    isPro,
    isFree: !isPro,
  };
}

/**
 * Check if user has access to a specific route
 */
export function hasRouteAccess(
  pathname: string,
  entitlements: UserEntitlements
): boolean {
  // Free users can access:
  // - Billing page (to upgrade)
  // - Dashboard main page (to see widgets)
  // - Widget creation if they have less than 1 widget (free plan allows 1 widget)
  // - Auth pages
  const freeAccessibleRoutes = [
    '/dashboard/billing',
    '/dashboard', // Dashboard main page
    '/auth',
    '/login',
    '/signup',
  ];

  if (entitlements.isFree) {
    // Allow widget creation route (will be validated on the page itself based on widget count)
    if (pathname === '/dashboard/widgets/new' || pathname.startsWith('/dashboard/widgets/new')) {
      return true; // Let the page component validate widget count
    }

    // Allow viewing existing widgets
    if (pathname.startsWith('/dashboard/widgets/')) {
      return true; // Let the page validate access to specific widgets
    }

    // Allow dashboard main page
    if (pathname === '/dashboard' || pathname === '/dashboard/') {
      return true;
    }

    // Check other free routes
    return freeAccessibleRoutes.some((route) => pathname.startsWith(route));
  }

  // Pro users have access to all dashboard routes
  return true;
}


import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Widget, Subscription } from '@/lib/types/saas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/dashboard-layout';
import { 
  MessageSquare, 
  Plus, 
  Settings, 
  Inbox, 
  TrendingUp, 
  Zap,
  Users,
  Crown,
  Activity,
  ArrowUpRight
} from 'lucide-react';

export default async function DashboardPage() {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Get user's widgets
  const { data: widgets } = await supabase
    .from('widgets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Get subscription from Stripe (same logic as billing page)
  let subscription = null;
  let plan = 'free';
  let isTrialing = false;
  let isActive = false;

  // Get user's first widget ID for Stripe lookup
  const widgetId = widgets?.[0]?.id;

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
    }
  }

  // Determine plan and status
  if (subscription?.status === 'active' || subscription?.status === 'trialing') {
    plan = 'pro';
    isActive = true;
    if (subscription.status === 'trialing') {
      isTrialing = true;
    }
  }

  // Get total stats
  const totalConversations = widgets?.reduce((sum, w) => sum + (w.total_conversations || 0), 0) || 0;
  const totalMessages = widgets?.reduce((sum, w) => sum + (w.total_messages || 0), 0) || 0;

  return (
    <DashboardLayout
      email={user.email || ''}
      title="Dashboard"
      description="Visão geral das suas atividades e estatísticas"
    >
      <div className="space-y-6 pb-8 sm:pb-12">
        {/* Subscription Banner */}
        {isTrialing && (
          <Card className="border-2 border-primary bg-primary/5">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg">
                      Trial Ativo
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      Período de teste. Aproveite todos os recursos!
                    </CardDescription>
                  </div>
                </div>
                <Button asChild size="sm" className="w-full sm:w-auto">
                  <Link href="/dashboard/billing">
                    Ver Planos
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
          </Card>
        )}

        {/* Stats */}
        <div className="grid gap-3 sm:gap-4 lg:gap-6 grid-cols-2 lg:grid-cols-4">
          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Widgets
                </CardTitle>
                <div className="text-2xl sm:text-3xl font-bold">{widgets?.length || 0}</div>
              </div>
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-primary/10">
                <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="hidden sm:block">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Activity className="h-3 w-3" />
                <span>Ativos</span>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Conversas
                </CardTitle>
                <div className="text-2xl sm:text-3xl font-bold">{totalConversations}</div>
              </div>
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-blue-500/10">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent className="hidden sm:block">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                <span>Total</span>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Mensagens
                </CardTitle>
                <div className="text-2xl sm:text-3xl font-bold">{totalMessages}</div>
              </div>
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-purple-500/10">
                <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </CardHeader>
            <CardContent className="hidden sm:block">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Activity className="h-3 w-3" />
                <span>Total</span>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Plano
                </CardTitle>
                <div className="text-xl sm:text-3xl font-bold capitalize truncate">
                  {plan === 'pro' ? 'Pro' : 'Free'}
                </div>
              </div>
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-amber-500/10">
                <Crown className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400" />
              </div>
            </CardHeader>
            <CardContent className="hidden sm:block">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Activity className="h-3 w-3" />
                <span>Ativo</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Widgets List */}
        <Card className="card-clean">
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl sm:text-2xl">Meus Widgets</CardTitle>
                <CardDescription className="text-sm sm:text-base mt-1">
                  Gerencie seus widgets e estatísticas
                </CardDescription>
              </div>
              <Button asChild size="default" className="w-full sm:w-auto">
                <Link href="/dashboard/widgets/new">
                  <Plus className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="sm:inline">Novo Widget</span>
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {!widgets || widgets.length === 0 ? (
              <div className="text-center py-12 sm:py-16">
                <div className="flex justify-center mb-4 sm:mb-6">
                  <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-primary/10">
                    <MessageSquare className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mb-2">
                  Nenhum widget criado
                </h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-md mx-auto px-4">
                  Crie seu primeiro widget para começar a receber mensagens dos seus visitantes
                </p>
                <Button asChild size="default" className="w-full sm:w-auto">
                  <Link href="/dashboard/widgets/new">
                    <Plus className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    Criar Primeiro Widget
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
                {widgets.map((widget: Widget) => (
                  <Card key={widget.id} className="card-clean hover:border-primary/50 transition-all">
                    <CardHeader className="p-4 sm:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <div
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl border-2 flex items-center justify-center flex-shrink-0"
                            style={{ 
                              backgroundColor: widget.brand_color,
                              borderColor: widget.brand_color
                            }}
                          >
                            <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base sm:text-lg truncate">{widget.name}</CardTitle>
                            <CardDescription className="text-xs sm:text-sm truncate">
                              {widget.company_name || 'Sem nome'}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge 
                          variant={widget.is_active ? 'default' : 'secondary'}
                          className="flex-shrink-0 text-xs"
                        >
                          {widget.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div className="space-y-1">
                          <p className="text-xl sm:text-2xl font-bold">{widget.total_conversations || 0}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground">Conversas</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xl sm:text-2xl font-bold">{widget.total_messages || 0}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground">Mensagens</p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 pt-2">
                        <Button variant="default" asChild className="flex-1" size="default">
                          <Link href={`/dashboard/widgets/${widget.id}/inbox`}>
                            <Inbox className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                            Inbox
                          </Link>
                        </Button>
                        <Button variant="outline" asChild className="flex-1" size="default">
                          <Link href={`/dashboard/widgets/${widget.id}/settings`}>
                            <Settings className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                            Config
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, Check, Zap } from 'lucide-react';

export default async function BillingPage() {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Get subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single();

  const plan = subscription?.plan || 'free';
  const isActive = subscription?.status === 'active';

  return (
    <DashboardLayout
      email={user.email || ''}
      title="Billing & Subscription"
      description="Gerencie sua assinatura e pagamentos"
    >
      <div className="space-y-6">
        {/* Current Plan */}
        <Card className="card-clean">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Plano Atual</CardTitle>
                  <CardDescription>
                    Status da sua assinatura
                  </CardDescription>
                </div>
              </div>
              <Badge variant={isActive ? 'default' : 'secondary'} className="text-sm">
                {plan.toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={isActive ? 'default' : 'secondary'}>
                  {isActive ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              {subscription?.stripe_subscription_id && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Subscription ID</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {subscription.stripe_subscription_id.substring(0, 20)}...
                  </code>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Available Plans */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Free Plan */}
          <Card className="card-clean">
            <CardHeader>
              <CardTitle>Free</CardTitle>
              <div className="mt-4">
                <span className="text-4xl font-bold">R$ 0</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">1 Widget</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">100 mensagens/mês</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Suporte básico</span>
                </li>
              </ul>
              <Button 
                variant={plan === 'free' ? 'secondary' : 'outline'} 
                className="w-full mt-6"
                disabled={plan === 'free'}
              >
                {plan === 'free' ? 'Plano Atual' : 'Downgrade'}
              </Button>
            </CardContent>
          </Card>

          {/* Pro Plan */}
          <Card className="card-clean border-primary">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Pro</CardTitle>
                <Badge>Popular</Badge>
              </div>
              <div className="mt-4">
                <span className="text-4xl font-bold">R$ 49</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">5 Widgets</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">5.000 mensagens/mês</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Suporte prioritário</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Personalização avançada</span>
                </li>
              </ul>
              <Button 
                variant={plan === 'pro' ? 'secondary' : 'default'}
                className="w-full mt-6"
                disabled={plan === 'pro'}
              >
                {plan === 'pro' ? 'Plano Atual' : 'Upgrade'}
              </Button>
            </CardContent>
          </Card>

          {/* Enterprise Plan */}
          <Card className="card-clean">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Enterprise</CardTitle>
                <Zap className="h-5 w-5 text-orange-500" />
              </div>
              <div className="mt-4">
                <span className="text-4xl font-bold">Custom</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Widgets ilimitados</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Mensagens ilimitadas</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Suporte dedicado 24/7</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">SLA garantido</span>
                </li>
              </ul>
              <Button variant="outline" className="w-full mt-6">
                Contatar Vendas
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}


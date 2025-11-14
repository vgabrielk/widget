'use client';

import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Zap } from 'lucide-react';

interface PlanCardProps {
  name: string;
  price: number | string;
  description?: string;
  features: string[];
  isPopular?: boolean;
  isCurrent?: boolean;
  onSelect?: () => void;
  priceId?: string;
  widgetId?: string | null;
  contactEmail?: string;
  disabled?: boolean;
}

export function PlanCard({
  name,
  price,
  description,
  features,
  isPopular = false,
  isCurrent = false,
  onSelect,
  priceId,
  widgetId,
  contactEmail,
  disabled = false,
}: PlanCardProps) {
  const handleCheckout = async () => {
    if (!widgetId) {
      alert('Por favor, aguarde enquanto criamos seu widget...');
      return;
    }

    if (!priceId && typeof price !== 'number') {
      if (contactEmail) {
        window.location.href = `mailto:${contactEmail}?subject=Contato sobre plano Enterprise`;
      }
      return;
    }

    try {
      const response = await fetch('/api/stripe/create-checkout-with-trial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          widgetId,
          priceId,
          price: typeof price === 'number' ? price : undefined,
          currency: 'brl',
          trialDays: 4,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'Já existe uma assinatura ativa') {
          alert('Você já possui uma assinatura ativa. Gerencie sua assinatura na página de cobrança.');
        } else {
          alert(`Erro: ${data.error || 'Falha ao criar sessão de checkout'}`);
        }
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      alert('Erro ao iniciar o checkout. Por favor, tente novamente.');
    }
  };

  const isEnterprise = name === 'Enterprise';
  const priceLabel = typeof price === 'number' ? `R$ ${price.toFixed(2)}` : price;

  const cardClasses = isPopular
    ? 'border-primary/40 bg-gradient-to-br from-primary/5 via-white to-white shadow-[0_25px_60px_rgba(99,102,241,0.25)] dark:from-primary/15 dark:via-slate-900 dark:to-slate-900 dark:shadow-[0_25px_60px_rgba(15,23,42,0.55)]'
    : 'border-border/60 bg-card/95 shadow-[0_15px_40px_rgba(15,23,42,0.12)] dark:border-border/40 dark:bg-slate-900/70 dark:shadow-[0_20px_45px_rgba(0,0,0,0.45)]';

  return (
    <Card
      className={`relative overflow-hidden rounded-3xl border p-6 text-card-foreground transition-all hover:-translate-y-1 ${cardClasses}`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute -right-12 top-0 h-32 w-32 rounded-full bg-primary/10 blur-3xl dark:bg-primary/25" />
        <div className="absolute -bottom-10 left-0 h-24 w-24 rounded-full bg-muted/70 blur-3xl dark:bg-slate-800/60" />
      </div>

      <div className="relative space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Plano</p>
            <CardTitle className="text-2xl font-semibold">{name}</CardTitle>
            {description && (
              <CardDescription className="mt-1 text-sm leading-relaxed">
                {description}
              </CardDescription>
            )}
          </div>
          <div className="space-y-2 text-right">
            {isPopular && (
              <Badge className="rounded-full bg-primary/10 text-primary">
                <Zap className="mr-1 h-3 w-3" />
                Popular
              </Badge>
            )}
            {isCurrent && (
              <Badge variant="outline" className="rounded-full border-green-200 bg-green-50 text-green-700">
                Plano Atual
              </Badge>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">{priceLabel}</span>
            {typeof price === 'number' && <span className="text-muted-foreground">/mês</span>}
          </div>
          {!isEnterprise && (
            <p className="text-xs text-muted-foreground">
              4 dias grátis, depois {priceLabel}/mês
            </p>
          )}
        </div>

        <div className="space-y-3">
          {features.map((feature, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 px-4 py-2 text-sm shadow-sm dark:border-border/40 dark:bg-slate-900/60"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Check className="h-4 w-4" />
              </div>
              <span>{feature}</span>
            </div>
          ))}
        </div>

        <Button
          variant={isCurrent ? 'secondary' : isPopular ? 'default' : 'outline'}
          className="h-12 w-full rounded-2xl text-base font-medium"
          onClick={isEnterprise ? onSelect : handleCheckout}
          disabled={disabled || isCurrent || !widgetId}
        >
          {isCurrent ? 'Plano Atual' : isEnterprise ? 'Contatar Vendas' : 'Assinar Agora'}
        </Button>
      </div>
    </Card>
  );
}


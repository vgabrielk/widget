'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

  return (
    <Card className={`card-clean ${isPopular ? 'border-primary' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{name}</CardTitle>
          {isPopular && <Badge>Popular</Badge>}
        </div>
        <div className="mt-4">
          <span className="text-4xl font-bold">
            {typeof price === 'number' ? `R$ ${price.toFixed(2)}` : price}
          </span>
          {typeof price === 'number' && (
            <span className="text-muted-foreground">/mês</span>
          )}
        </div>
        {description && (
          <CardDescription className="mt-2">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <ul className="space-y-3 mb-6">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
        <Button
          variant={isCurrent ? 'secondary' : isPopular ? 'default' : 'outline'}
          className="w-full"
          onClick={name === 'Enterprise' ? onSelect : handleCheckout}
          disabled={disabled || isCurrent || !widgetId}
        >
          {isCurrent
            ? 'Plano Atual'
            : name === 'Enterprise'
            ? 'Contatar Vendas'
            : 'Assinar Agora'}
        </Button>
        {name !== 'Enterprise' && name !== 'Free' && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            4 dias grátis, depois R$ {typeof price === 'number' ? price.toFixed(2) : price}/mês
          </p>
        )}
      </CardContent>
    </Card>
  );
}


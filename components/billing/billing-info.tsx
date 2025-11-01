'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CreditCard, CheckCircle2, RefreshCw, X, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface BillingInfoProps {
  subscription: any;
  isTrialing: boolean;
  trialEndDate: Date | null;
  plan: string;
  isActive: boolean;
}

export function BillingInfo({
  subscription,
  isTrialing,
  trialEndDate,
  plan,
  isActive,
}: BillingInfoProps) {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showReactivateDialog, setShowReactivateDialog] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(true);

  const formatDate = (date: string | Date | null) => {
    if (!date) return 'N/A';
    try {
      return format(new Date(date), "dd/MM/yyyy");
    } catch {
      return 'N/A';
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/stripe/sync-subscription', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok && data.synced) {
        // Refresh the page to show updated subscription
        router.refresh();
      } else {
        // Show detailed error message
        const errorMessage = data.message || data.error || 'Erro ao sincronizar assinatura';
        const suggestion = data.suggestion || '';
        alert(`${errorMessage}${suggestion ? '\n\n' + suggestion : ''}`);
      }
    } catch (error) {
      console.error('Error syncing subscription:', error);
      alert('Erro ao sincronizar assinatura');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCancel = async () => {
    if (!subscription?.stripe_subscription_id) return;

    setIsCanceling(true);
    try {
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: subscription.stripe_subscription_id,
          cancelAtPeriodEnd,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setShowCancelDialog(false);
        router.refresh();
      } else {
        alert(data.error || 'Erro ao cancelar assinatura');
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      alert('Erro ao cancelar assinatura');
    } finally {
      setIsCanceling(false);
    }
  };

  const handleReactivate = async () => {
    if (!subscription?.stripe_subscription_id) return;

    setIsCanceling(true);
    try {
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: subscription.stripe_subscription_id,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setShowReactivateDialog(false);
        router.refresh();
      } else {
        alert(data.error || 'Erro ao reativar assinatura');
      }
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      alert('Erro ao reativar assinatura');
    } finally {
      setIsCanceling(false);
    }
  };

  const getStatusBadge = () => {
    if (isTrialing) {
      return (
        <Badge variant="default" className="bg-primary/20 text-primary border-primary">
          Em Período de Teste
        </Badge>
      );
    }
    if (isActive) {
      // Check if subscription is scheduled for cancellation
      const isScheduledForCancellation = subscription?.cancel_at_period_end === true;
      if (isScheduledForCancellation) {
        return (
          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500">
            Cancelamento Agendado
          </Badge>
        );
      }
      return <Badge variant="default">Ativo</Badge>;
    }
    return <Badge variant="secondary">Inativo</Badge>;
  };

  const isScheduledForCancellation = subscription?.cancel_at_period_end === true;

  return (
    <Card className="card-clean">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Plano Atual</CardTitle>
              <CardDescription>Status da sua assinatura</CardDescription>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge
              variant={isActive || isTrialing ? 'default' : 'secondary'}
              className="text-sm"
            >
              {plan.toUpperCase()}
            </Badge>
            {getStatusBadge()}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            {getStatusBadge()}
          </div>
          {isTrialing && trialEndDate && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Período de teste até</span>
              <span className="text-sm font-medium">{formatDate(trialEndDate)}</span>
            </div>
          )}
          {subscription?.current_period_end && !isTrialing && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Próxima cobrança</span>
              <span className="text-sm font-medium">
                {formatDate(subscription.current_period_end)}
              </span>
            </div>
          )}
          {subscription?.stripe_subscription_id && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">ID da Assinatura</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {subscription.stripe_subscription_id.substring(0, 20)}...
              </code>
            </div>
          )}

          {isScheduledForCancellation && subscription?.current_period_end && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Cancelamento em</span>
              <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                {formatDate(subscription.current_period_end)}
              </span>
            </div>
          )}
          
          {/* Action buttons */}
          <div className="pt-4 border-t space-y-2">
            {/* Sync button - show if plan is free but user might have subscribed */}
            {plan === 'free' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="w-full"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Sincronizando...' : 'Atualizar Status da Assinatura'}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Se você acabou de assinar, clique aqui para atualizar o status
                </p>
              </>
            )}

            {/* Cancel/Reactivate buttons - show if subscription is active */}
            {plan === 'pro' && isActive && subscription?.stripe_subscription_id && (
              <>
                {isScheduledForCancellation ? (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setShowReactivateDialog(true)}
                    disabled={isCanceling}
                    className="w-full"
                  >
                    <RotateCcw className={`h-4 w-4 mr-2 ${isCanceling ? 'animate-spin' : ''}`} />
                    Reativar Assinatura
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowCancelDialog(true)}
                    disabled={isCanceling}
                    className="w-full"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancelar Assinatura
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>

      {/* Cancel Subscription Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Assinatura</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar sua assinatura?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  checked={cancelAtPeriodEnd}
                  onChange={() => setCancelAtPeriodEnd(true)}
                  className="h-4 w-4"
                />
                <div>
                  <span className="font-medium">Cancelar no final do período</span>
                  <p className="text-xs text-muted-foreground">
                    Você continuará tendo acesso até {subscription?.current_period_end ? formatDate(subscription.current_period_end) : 'o final do período atual'}
                  </p>
                </div>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!cancelAtPeriodEnd}
                  onChange={() => setCancelAtPeriodEnd(false)}
                  className="h-4 w-4"
                />
                <div>
                  <span className="font-medium">Cancelar imediatamente</span>
                  <p className="text-xs text-muted-foreground">
                    Você perderá o acesso imediatamente
                  </p>
                </div>
              </label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCanceling}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={isCanceling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCanceling ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reactivate Subscription Dialog */}
      <AlertDialog open={showReactivateDialog} onOpenChange={setShowReactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reativar Assinatura</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja reativar sua assinatura? Ela continuará ativa após o período atual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCanceling}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReactivate}
              disabled={isCanceling}
            >
              {isCanceling ? 'Reativando...' : 'Confirmar Reativação'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}


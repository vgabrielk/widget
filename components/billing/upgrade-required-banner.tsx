'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export function UpgradeRequiredBanner() {
  const searchParams = useSearchParams();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const upgrade = searchParams.get('upgrade');
    if (upgrade === 'required') {
      setShow(true);
    }
  }, [searchParams]);

  if (!show) return null;

  return (
    <Alert className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-800 dark:text-amber-200">
        Upgrade Necessário
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-300">
        Você precisa fazer upgrade para o plano Pro para acessar esta funcionalidade.
        <div className="mt-2">
          <strong>Funcionalidades do Plano Pro:</strong>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Mensagens ilimitadas</li>
            <li>Suporte prioritário</li>
            <li>Personalização avançada de widgets</li>
            <li>Múltiplos widgets</li>
            <li>Analytics avançado</li>
            <li>Acesso à API</li>
            <li>Webhooks</li>
            <li>Remoção de marca</li>
          </ul>
        </div>
      </AlertDescription>
    </Alert>
  );
}


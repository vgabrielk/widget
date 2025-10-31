'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="text-center space-y-4 max-w-md">
            <h2 className="text-2xl font-bold">Algo deu errado!</h2>
            <p className="text-muted-foreground">
              Ocorreu um erro crítico na aplicação.
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground">
                Error ID: {error.digest}
              </p>
            )}
            <Button onClick={reset}>Tentar novamente</Button>
          </div>
        </div>
      </body>
    </html>
  );
}


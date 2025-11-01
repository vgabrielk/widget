'use client';

import { useState, useCallback } from 'react';
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

interface AlertOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

export function useAlertDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [alertState, setAlertState] = useState<{
    type: 'alert' | 'confirm';
    options: AlertOptions;
    resolve?: (value: boolean) => void;
  } | null>(null);

  const alert = useCallback((message: string, title?: string) => {
    return new Promise<void>((resolve) => {
      setAlertState({
        type: 'alert',
        options: {
          title: title || 'Aviso',
          message,
          confirmText: 'OK',
        },
        resolve: () => {
          setIsOpen(false);
          resolve();
        },
      });
      setIsOpen(true);
    });
  }, []);

  const confirm = useCallback((message: string, title?: string) => {
    return new Promise<boolean>((resolve) => {
      setAlertState({
        type: 'confirm',
        options: {
          title: title || 'Confirmar',
          message,
          confirmText: 'Confirmar',
          cancelText: 'Cancelar',
        },
        resolve: (value: boolean) => {
          setIsOpen(false);
          resolve(value);
        },
      });
      setIsOpen(true);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (alertState?.resolve) {
      alertState.resolve(true);
      setAlertState(null);
    }
  }, [alertState]);

  const handleCancel = useCallback(() => {
    if (alertState?.resolve) {
      alertState.resolve(false);
      setAlertState(null);
    }
  }, [alertState]);

  const AlertDialogComponent = (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{alertState?.options.title}</AlertDialogTitle>
          <AlertDialogDescription>{alertState?.options.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {alertState?.type === 'confirm' && (
            <AlertDialogCancel onClick={handleCancel}>
              {alertState.options.cancelText || 'Cancelar'}
            </AlertDialogCancel>
          )}
          <AlertDialogAction onClick={handleConfirm}>
            {alertState?.options.confirmText || 'OK'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return {
    alert,
    confirm,
    AlertDialogComponent,
  };
}




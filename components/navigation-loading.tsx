'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { JelloLogoCompact } from '@/components/jello-logo';

export function NavigationLoading() {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const isInitialMount = useRef(true);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousPathRef = useRef(pathname);

  useEffect(() => {
    // Skip initial mount to avoid showing loader on first render
    if (isInitialMount.current) {
      isInitialMount.current = false;
      previousPathRef.current = pathname;
      return;
    }

    // Only show loading if pathname actually changed
    if (previousPathRef.current !== pathname) {
      // Show loading immediately
      setIsNavigating(true);

      // Clean up any existing timeout
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }

      // Hide loading after navigation completes (or timeout)
      navigationTimeoutRef.current = setTimeout(() => {
        setIsNavigating(false);
      }, 600);

      previousPathRef.current = pathname;
    }

    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, [pathname]);

  if (!isNavigating) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          {/* Pulsating logo with smooth animation */}
          <div className="absolute inset-0 animate-ping opacity-20">
            <JelloLogoCompact size={80} />
          </div>
          <JelloLogoCompact size={80} className="animate-pulse" />
        </div>
        
        {/* Subtle text */}
        <p className="text-sm text-muted-foreground animate-pulse">
          Carregando...
        </p>
      </div>
    </div>
  );
}


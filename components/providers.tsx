'use client';

import { ThemeProvider } from 'next-themes';
import { NavigationLoading } from './navigation-loading';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
      <NavigationLoading />
    </ThemeProvider>
  );
}


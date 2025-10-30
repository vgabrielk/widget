'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DashboardSidebar } from './dashboard-sidebar';
import { NotificationBell } from './notification-bell';
import { createClient } from '@/lib/supabase/client';
import { Search, Menu } from 'lucide-react';
import { Input } from './ui/input';
import { ThemeToggle } from './theme-toggle';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTitle } from './ui/sheet';

interface DashboardLayoutProps {
  children: React.ReactNode;
  email?: string;
  title?: string;
  description?: string;
}

export function DashboardLayout({
  children,
  email,
  title,
  description,
}: DashboardLayoutProps) {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <DashboardSidebar email={email} onLogout={handleLogout} />
      </div>

      {/* Mobile Menu */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <SheetTitle className="sr-only">Menu de Navegação</SheetTitle>
          <DashboardSidebar 
            email={email} 
            onLogout={handleLogout} 
            onNavigate={() => setIsMobileMenuOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-16 sm:h-20 items-center justify-between border-b border-border bg-card px-3 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex items-center gap-2 sm:gap-4 flex-1">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden flex-shrink-0"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Search Bar */}
            <div className="relative max-w-md flex-1 hidden sm:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar..."
                className="pl-10 bg-muted/50 border-0"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile Search Button */}
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden flex-shrink-0"
            >
              <Search className="h-5 w-5" />
            </Button>

            {/* Notifications */}
            {userId && <NotificationBell userId={userId} />}

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Date Display */}
            <div className="hidden xl:flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2">
              <span className="text-sm font-medium">
                {new Date().toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
        </header>

        {/* Page Header */}
        {(title || description) && (
          <div className="border-b border-border bg-card px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
            {title && (
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
            )}
            {description && (
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-3 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}


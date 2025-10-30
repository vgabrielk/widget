'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  MessageSquare,
  Inbox,
  Settings,
  Users,
  FileText,
  CreditCard,
  HelpCircle,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { JelloLogoCompact } from '@/components/jello-logo';
import { useUser } from '@/lib/contexts/user-context';

interface SidebarProps {
  email?: string;
  onLogout?: () => void;
  onNavigate?: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const mainNavItems: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Widgets',
    href: '/dashboard/widgets',
    icon: MessageSquare,
  },
  {
    name: 'Inbox',
    href: '/dashboard/inbox',
    icon: Inbox,
  },
  {
    name: 'Contacts',
    href: '/dashboard/contacts',
    icon: Users,
  },
];

const settingsNavItems: NavItem[] = [
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
  },
  {
    name: 'Billing',
    href: '/dashboard/billing',
    icon: CreditCard,
  },
  {
    name: 'Documentation',
    href: '/dashboard/docs',
    icon: FileText,
  },
  {
    name: 'Help & Support',
    href: '/dashboard/support',
    icon: HelpCircle,
  },
];

export function DashboardSidebar({ email, onLogout, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { profile } = useUser();

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const getInitials = (email: string) => {
    return email
      .split('@')[0]
      .substring(0, 2)
      .toUpperCase();
  };

  const handleNavClick = () => {
    if (onNavigate) {
      onNavigate();
    }
  };

  return (
    <aside className="flex h-full w-full flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-background))]">
      {/* Logo */}
      <div className="flex h-16 sm:h-20 items-center justify-center border-b border-[hsl(var(--sidebar-border))] px-3 sm:px-4 py-4 sm:py-5">
        <Link href="/dashboard" className="flex items-center">
          <JelloLogoCompact size={40} />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="space-y-1">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={cn(
                  'sidebar-item',
                  active && 'active'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>

        <Separator className="my-4" />

        <div className="space-y-1">
          <p className="px-3 sm:px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Settings
          </p>
          {settingsNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={cn(
                  'sidebar-item',
                  active && 'active'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User Profile */}
      <div className="border-t border-[hsl(var(--sidebar-border))] p-4">
        <div className="flex items-center gap-3 rounded-lg p-3 hover:bg-muted/50 transition-colors">
          <Avatar className="h-10 w-10 border-2 border-primary">
            {profile?.avatar_url && (
              <AvatarImage src={profile.avatar_url} alt={profile.full_name || email || 'User'} />
            )}
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {email ? getInitials(email) : 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">
              {profile?.full_name || email?.split('@')[0] || 'User'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {email || 'user@example.com'}
            </p>
          </div>
        </div>
        
        {onLogout && (
          <Button
            variant="ghost"
            className="mt-2 w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onLogout}
          >
            <LogOut className="mr-3 h-5 w-5" />
            <span>Logout</span>
          </Button>
        )}
      </div>
    </aside>
  );
}


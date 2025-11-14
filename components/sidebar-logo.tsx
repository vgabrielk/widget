'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getAvatarUrlCached } from '@/lib/utils/avatar-client';

interface SidebarLogoProps {
  email?: string;
  avatarPath?: string | null;
  className?: string;
  size?: number;
}

function getInitials(email?: string): string {
  if (!email) return 'U';
  
  // Get first letter of username part before @
  const username = email.split('@')[0];
  if (username.length >= 2) {
    return username.substring(0, 2).toUpperCase();
  }
  return username.charAt(0).toUpperCase();
}

/**
 * SidebarLogo - Avatar component for the sidebar
 * Accepts avatarPath as prop to avoid dependency on user context
 * Shows avatar image when available, otherwise shows initials
 */
export function SidebarLogo({ email, avatarPath, className, size = 40 }: SidebarLogoProps) {
  const initials = getInitials(email);
  
  const avatarSrc = useMemo(() => getAvatarUrlCached(avatarPath || null), [avatarPath]);
  
  return (
    <Avatar 
      className={cn('shadow-sm flex-shrink-0', className)} 
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      {avatarSrc && (
        <AvatarImage 
          key={avatarPath || 'sidebar-avatar'}
          src={avatarSrc} 
          avatarPath={avatarPath || null}
          alt={email || 'User'} 
        />
      )}
      <AvatarFallback 
        className="bg-primary/10 text-primary font-semibold"
        style={{ fontSize: `${size * 0.4}px` }}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}


'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import Image from 'next/image';

interface JelloLogoProps {
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}

export function JelloLogo({ className, width = 150, height = 40, priority = false }: JelloLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div 
        className={className} 
        style={{ width: `${width}px`, height: `${height}px` }}
      />
    );
  }

  // Dark mode: use jello-horizontal-dark.png
  // Light mode: use jello-horizontal.png
  const logoSrc = resolvedTheme === 'dark' 
    ? '/jello-horizontal-dark.png' 
    : '/jello-horizontal.png';

  const logoAlt = 'Jello Logo';

  return (
    <Image
      src={logoSrc}
      alt={logoAlt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      style={{ objectFit: 'contain' }}
    />
  );
}

// Compact version for small spaces (always uses square logo)
export function JelloLogoCompact({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <Image
      src="/jello-logo.png"
      alt="Jello"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}


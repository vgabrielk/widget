'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChatWidget } from '@/src/components/chat/ChatWidget';

function WidgetContent() {
  const searchParams = useSearchParams();
  
  // Get publicKey from URL params (for fetching widget config)
  const publicKey = searchParams.get('publicKey') || searchParams.get('pk');
  
  // Optional: allow overriding config via URL params
  const brandColor = searchParams.get('brandColor');
  const position = searchParams.get('position') as 'bottom-right' | 'bottom-left' | null;
  const welcomeMessage = searchParams.get('welcomeMessage');

  return (
    <ChatWidget
      publicKey={publicKey || undefined}
      position={position || undefined}
      brandColor={brandColor || undefined}
      welcomeMessage={welcomeMessage || undefined}
    />
  );
}

export default function WidgetEmbedPage() {
  return (
    <div className="h-screen w-screen">
      <Suspense fallback={<div>Loading...</div>}>
        <WidgetContent />
      </Suspense>
    </div>
  );
}

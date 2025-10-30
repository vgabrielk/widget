'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChatWidget } from '@/components/chat/ChatWidget';

function WidgetContent() {
  const searchParams = useSearchParams();
  const [config, setConfig] = useState({
    brandColor: '#6366f1',
    position: 'bottom-right' as 'bottom-right' | 'bottom-left',
    welcomeMessage: 'Olá! Como posso ajudar você hoje?',
  });

  useEffect(() => {
    // Get config from URL params
    const brandColor = searchParams.get('brandColor') || '#6366f1';
    const position = (searchParams.get('position') as 'bottom-right' | 'bottom-left') || 'bottom-right';
    const welcomeMessage = searchParams.get('welcomeMessage') || 'Olá! Como posso ajudar você hoje?';

    setConfig({
      brandColor,
      position,
      welcomeMessage,
    });
  }, [searchParams]);

  return (
    <ChatWidget
      position={config.position}
      brandColor={config.brandColor}
      welcomeMessage={config.welcomeMessage}
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


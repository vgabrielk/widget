/**
 * Realtime Chat Widget - Embed Script
 * 
 * Usage:
 * <script>
 *   window.ChatWidgetConfig = {
 *     supabaseUrl: 'YOUR_SUPABASE_URL',
 *     supabaseKey: 'YOUR_SUPABASE_ANON_KEY',
 *     brandColor: '#6366f1',
 *     position: 'bottom-right',
 *     welcomeMessage: 'Olá! Como posso ajudar?'
 *   };
 * </script>
 * <script src="https://your-domain.com/embed.js"></script>
 */

(function() {
  'use strict';
  
  // Get config from window
  const config = window.ChatWidgetConfig || {};
  
  if (!config.supabaseUrl || !config.supabaseKey) {
    console.error('ChatWidget: supabaseUrl and supabaseKey are required');
    return;
  }
  
  // Default configuration
  const defaults = {
    brandColor: '#6366f1',
    position: 'bottom-right',
    welcomeMessage: 'Olá! Como posso ajudar você hoje?'
  };
  
  const settings = { ...defaults, ...config };
  
  // Create iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'chat-widget-iframe';
  iframe.style.cssText = `
    position: fixed;
    ${settings.position === 'bottom-right' ? 'right: 24px;' : 'left: 24px;'}
    bottom: 24px;
    width: 400px;
    max-width: calc(100vw - 48px);
    height: 600px;
    border: none;
    z-index: 999999;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    border-radius: 16px;
    display: none;
  `;
  
  // Build iframe src with config parameters
  const params = new URLSearchParams({
    brandColor: settings.brandColor,
    position: settings.position,
    welcomeMessage: settings.welcomeMessage,
    embedded: 'true'
  });
  
  iframe.src = `${window.location.origin}/widget-embed?${params.toString()}`;
  
  // Add iframe to page
  document.body.appendChild(iframe);
  
  // Create floating button
  const button = document.createElement('button');
  button.id = 'chat-widget-button';
  button.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
    <span id="chat-widget-badge" style="display: none;">0</span>
  `;
  
  button.style.cssText = `
    position: fixed;
    ${settings.position === 'bottom-right' ? 'right: 24px;' : 'left: 24px;'}
    bottom: 24px;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background-color: ${settings.brandColor};
    color: white;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 999998;
    transition: transform 0.2s, box-shadow 0.2s;
  `;
  
  button.onmouseover = () => {
    button.style.transform = 'scale(1.1)';
    button.style.boxShadow = '0 6px 20px rgba(0,0,0,0.25)';
  };
  
  button.onmouseout = () => {
    button.style.transform = 'scale(1)';
    button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  };
  
  // Badge styles
  const badge = button.querySelector('#chat-widget-badge');
  badge.style.cssText = `
    position: absolute;
    top: -4px;
    right: -4px;
    background-color: #ef4444;
    color: white;
    font-size: 12px;
    font-weight: bold;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: pulse 2s infinite;
  `;
  
  // Add button to page
  document.body.appendChild(button);
  
  // Toggle widget
  let isOpen = false;
  button.addEventListener('click', () => {
    isOpen = !isOpen;
    iframe.style.display = isOpen ? 'block' : 'none';
    button.style.display = isOpen ? 'none' : 'block';
    
    if (isOpen) {
      // Reset badge when opening
      badge.textContent = '0';
      badge.style.display = 'none';
    }
  });
  
  // Listen for messages from iframe
  window.addEventListener('message', (event) => {
    if (event.data.type === 'CHAT_WIDGET_CLOSE') {
      isOpen = false;
      iframe.style.display = 'none';
      button.style.display = 'block';
    }
    
    if (event.data.type === 'CHAT_WIDGET_UNREAD') {
      const count = event.data.count;
      if (count > 0 && !isOpen) {
        badge.textContent = count;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
  });
  
  // Add pulse animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;
  document.head.appendChild(style);
})();



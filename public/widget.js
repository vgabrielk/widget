(function() {
    'use strict';

    // =====================================================
    // SECURITY NOTICE
    // =====================================================
    // This widget uses API routes for all data operations for better security.
    // Direct Supabase access is only used for real-time subscriptions.
    // 
    // The security of this widget relies on:
    // 1. API route authentication and validation
    // 2. Rate limiting (implemented client-side and server-side)
    // 3. Input sanitization (implemented below)
    // 4. CORS configuration on API routes
    // 5. Magic bytes validation for file uploads
    // =====================================================

    // Detectar a origem da API baseado em onde o script foi carregado
    let API_BASE = window.CHAT_WIDGET_API_BASE || window.ChatWidgetConfig?.apiBase || '';
    
    // Se não foi configurado, tentar detectar do próprio script
    if (!API_BASE) {
        const scripts = document.getElementsByTagName('script');
        for (let script of scripts) {
            if (script.src && script.src.includes('widget.js')) {
                const url = new URL(script.src);
                API_BASE = `${url.protocol}//${url.host}`;
                break;
            }
        }
    }

    console.log('ChatWidget: API_BASE =', API_BASE);
    
    const SUPABASE_URL = window.SUPABASE_URL;
    const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

    let supabaseClient;
    let widgetData = null;
    let roomId = null;
    let roomStatus = null;
    let visitorId = null;
    let isBanned = false;
    let visitorInfo = { name: '', email: '' };
    let messageChannel = null;
    let roomStatusChannel = null;
    let isOpen = false;
    let hasSubmittedInfo = false;
    let hasActiveRoom = false;
    let selectedImage = null;
    let heartbeatInterval = null;
    
    // Rate limiting
    const RATE_LIMIT = {
        maxMessages: 10,        // Máximo de mensagens
        timeWindow: 60000,      // Em 1 minuto (60 segundos)
        messageTimestamps: [],  // Array de timestamps
    };

    // Estados de persistência
    const STORAGE_KEYS = {
        VISITOR_ID: 'chat_visitor_id',
        VISITOR_NAME: 'chat_visitor_name',
        VISITOR_EMAIL: 'chat_visitor_email',
        ROOM_ID: 'chat_room_id',
        IS_OPEN: 'chat_is_open',
        HAS_SUBMITTED: 'chat_has_submitted_info',
        SUBMITTED_AT: 'chat_submitted_at',
    };

    console.log('ChatWidget: Script loaded');

    // =====================================================
    // INJECT CSS STYLES (Improved maintainability)
    // =====================================================
    function injectStyles(brandColor, position) {
        const styleId = 'chat-widget-styles';
        
        // Remove existing styles if already injected
        const existingStyles = document.getElementById(styleId);
        if (existingStyles) {
            existingStyles.remove();
        }

        const styles = `
            @keyframes chat-widget-slide-in {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            @keyframes chat-widget-slide-out {
                from { opacity: 1; transform: translateY(0); }
                to { opacity: 0; transform: translateY(-10px); }
            }
            
            @keyframes chat-widget-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }

            /* Button */
            #chat-widget-button {
                position: fixed;
                ${position === 'bottom-left' ? 'left: 24px;' : 'right: 24px;'}
                bottom: 24px;
                bottom: calc(24px + env(safe-area-inset-bottom));
                width: 56px;
                height: 56px;
                border-radius: 50%;
                background: ${brandColor};
                color: white;
                border: none;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                align-items: center;
                justify-content: center;
                z-index: 999999;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            
            #chat-widget-button:hover {
                transform: scale(1.05);
                box-shadow: 0 6px 16px rgba(0,0,0,0.2);
            }

            /* Window */
            #chat-widget-window {
                position: fixed;
                ${position === 'bottom-left' ? 'left: 24px;' : 'right: 24px;'}
                bottom: 24px;
                bottom: calc(24px + env(safe-area-inset-bottom));
                width: 400px;
                max-width: calc(100vw - 48px);
                height: 600px;
                max-height: calc(100vh - 48px - env(safe-area-inset-bottom) - env(safe-area-inset-top));
                background: white;
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.12);
                flex-direction: column;
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
                overflow: hidden;
            }

            /* Header */
            .chat-widget-header {
                background: ${brandColor};
                padding: 16px 20px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: none;
                flex-shrink: 0;
                gap: 12px;
            }

            .chat-widget-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: #111827;
            }

            .chat-widget-close-btn {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                cursor: pointer;
                font-size: 20px;
                padding: 4px;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 6px;
                transition: background 0.2s;
            }

            .chat-widget-close-btn:hover {
                background: rgba(255, 255, 255, 0.3);
            }

            /* Welcome Form */
            #chat-widget-welcome-form {
                flex: 1;
                flex-direction: column;
                padding: 32px 24px;
                background: #FAFAFA;
                overflow-y: auto;
            }

            .chat-widget-welcome-icon {
                width: 64px;
                height: 64px;
                background: ${brandColor};
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 16px;
            }

            .chat-widget-form-group {
                margin-bottom: 16px;
            }

            .chat-widget-form-label {
                display: block;
                font-size: 13px;
                font-weight: 500;
                color: #374151;
                margin-bottom: 6px;
            }

            .chat-widget-form-input {
                width: 100%;
                padding: 12px 14px;
                border: 1px solid #E5E7EB;
                border-radius: 8px;
                font-size: 14px;
                outline: none;
                box-sizing: border-box;
            }

            .chat-widget-form-input:focus {
                border-color: ${brandColor};
            }

            .chat-widget-submit-btn {
                background: ${brandColor};
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
                margin-top: 8px;
                width: 100%;
            }

            .chat-widget-submit-btn:hover {
                opacity: 0.9;
            }

            /* Chat Container */
            #chat-widget-chat-container {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                min-height: 0;
            }

            #chat-widget-messages {
                flex: 1;
                overflow-y: auto;
                padding: 24px;
                background: white;
                min-height: 0;
                -webkit-overflow-scrolling: touch;
                overscroll-behavior: contain;
            }

            /* Input Area */
            .chat-widget-input-area {
                padding: 16px 20px;
                padding-bottom: calc(16px + env(safe-area-inset-bottom));
                border-top: 1px solid #F3F4F6;
                background: white;
                flex-shrink: 0;
            }

            /* Mobile-specific styles for iPhone Safari */
            @supports (-webkit-touch-callout: none) {
                .chat-widget-input-area {
                    padding-bottom: calc(32px + env(safe-area-inset-bottom));
                }
            }

            #chat-widget-closed-notice {
                background: #FEE2E2;
                border: 1px solid #FECACA;
                color: #991B1B;
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 12px;
                text-align: center;
                font-size: 13px;
            }

            #chat-widget-new-conversation-btn {
                background: ${brandColor};
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                width: 100%;
                margin-top: 12px;
                transition: background-color 0.2s, transform 0.1s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }

            #chat-widget-new-conversation-btn:hover {
                background: ${brandColor}dd;
                transform: translateY(-1px);
            }

            #chat-widget-new-conversation-btn:active {
                transform: translateY(0);
            }

            #chat-widget-new-conversation-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }

            #chat-widget-image-preview {
                margin-bottom: 12px;
            }

            .chat-widget-preview-img {
                max-width: 150px;
                max-height: 100px;
                border-radius: 8px;
                border: 2px solid #E5E7EB;
            }

            .chat-widget-remove-image-btn {
                position: absolute;
                top: -6px;
                right: -6px;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #EF4444;
                color: white;
                border: none;
                cursor: pointer;
                font-size: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .chat-widget-input-row {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            #chat-widget-input {
                flex: 1;
                padding: 12px 14px;
                border: 1px solid #E5E7EB;
                border-radius: 24px;
                font-size: 14px;
                outline: none;
                background: #F9FAFB;
            }

            #chat-widget-input:focus {
                border-color: ${brandColor};
                background: white;
            }

            .chat-widget-attach-btn {
                background: none;
                border: none;
                cursor: pointer;
                padding: 8px;
                color: #9CA3AF;
                flex-shrink: 0;
            }

            #chat-widget-send {
                background: ${brandColor};
                color: white;
                border: none;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }

            /* Message Styles */
            .chat-message-wrapper {
                display: flex;
                flex-direction: column;
                margin-bottom: 24px;
            }

            .chat-message-wrapper.visitor {
                align-items: flex-end;
            }

            .chat-message-wrapper.agent {
                align-items: flex-start;
            }

            .chat-message-row {
                display: flex;
                gap: 12px;
                align-items: flex-end;
                max-width: 75%;
            }

            .chat-message-row.visitor {
                flex-direction: row-reverse;
            }

            .chat-message-avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: 600;
                flex-shrink: 0;
            }

            .chat-message-avatar.visitor {
                background: #E5E7EB;
                color: #374151;
            }

            .chat-message-avatar.agent {
                background: #E5E7EB;
                color: #374151;
            }

            .chat-message-bubble {
                padding: 12px 16px;
                border-radius: 18px;
                word-wrap: break-word;
                overflow-wrap: break-word;
            }

            .chat-message-bubble.visitor {
                background: ${brandColor};
                color: white;
                border-bottom-right-radius: 4px;
            }

            .chat-message-bubble.agent {
                background: #F3F4F6;
                color: #111827;
                border-bottom-left-radius: 4px;
            }

            /* Remover background quando só tem imagem */
            .chat-message-bubble.no-background {
                background: transparent !important;
                padding: 0 !important;
            }

            .chat-message-content {
                margin: 0;
                font-size: 14px;
                line-height: 1.5;
            }

            .chat-message-image {
                max-width: 200px;
                max-height: 200px;
                border-radius: 8px;
                margin-top: 8px;
                cursor: pointer;
                display: block;
            }

            .chat-message-meta {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-top: 4px;
                font-size: 12px;
                font-weight: 600;
                color: #111827;
            }

            .chat-message-meta.visitor {
                margin-right: 44px;
            }

            .chat-message-meta.agent {
                margin-left: 44px;
            }

            /* System message */
            .chat-system-message {
                display: flex;
                justify-content: center;
                margin: 16px 0;
            }

            .chat-system-bubble {
                background: #F3F4F6;
                color: #6B7280;
                padding: 8px 16px;
                border-radius: 12px;
                font-size: 12px;
                text-align: center;
                max-width: 80%;
            }

            /* Badge */
            #chat-widget-badge {
                position: absolute;
                top: -4px;
                right: -4px;
                width: 12px;
                height: 12px;
                background: #EF4444;
                border-radius: 50%;
                border: 2px solid white;
                animation: chat-widget-pulse 2s infinite;
            }

            /* Error notification */
            .chat-widget-error {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #FEE2E2;
                border: 2px solid #EF4444;
                color: #991B1B;
                padding: 16px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 9999999;
                max-width: 300px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                font-size: 14px;
                line-height: 1.5;
                animation: chat-widget-slide-in 0.3s ease-out;
            }

            .chat-widget-error.fade-out {
                animation: chat-widget-slide-out 0.3s ease-out;
            }
        `;

        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);

        console.log('ChatWidget: Styles injected');
    }

    // =====================================================
    // IMPROVED INPUT SANITIZATION
    // =====================================================
    // More comprehensive sanitization to prevent XSS attacks
    // For production, consider using a library like DOMPurify for HTML content
    // =====================================================
    function sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        
        // Remove all HTML tags
        let sanitized = input.replace(/<[^>]*>/g, '');
        
        // Remove dangerous protocols and event handlers
        const dangerousPatterns = [
            /javascript:/gi,
            /data:text\/html/gi,
            /vbscript:/gi,
            /on\w+\s*=/gi,
            /<script/gi,
            /<\/script>/gi,
            /<iframe/gi,
            /<object/gi,
            /<embed/gi,
            /<link/gi,
            /<style/gi,
            /<meta/gi,
            /expression\s*\(/gi,
            /import\s+/gi,
            /&#/g,  // HTML entities
            /\0/g,  // Null bytes
        ];

        dangerousPatterns.forEach(pattern => {
            sanitized = sanitized.replace(pattern, '');
        });

        // Remove invisible/control characters (except common whitespace)
        sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        
        // Limit length (prevent DoS)
        const maxLength = 5000;
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength);
        }
        
        return sanitized.trim();
    }

    function isMobileScreen() {
        return window.innerWidth <= 1024;
    }

    function applyMobileStyles() {
        const chatWindow = document.getElementById('chat-widget-window');
        const inputArea = document.querySelector('.chat-widget-input-area');
        const chatButton = document.getElementById('chat-widget-button');
        if (!chatWindow) return;
        
        if (isMobileScreen()) {
            // Apply fullscreen styles for mobile/tablet with !important
            // Use safe-area-inset for iPhone notches and home indicator
            chatWindow.style.setProperty('left', '0', 'important');
            chatWindow.style.setProperty('right', '0', 'important');
            chatWindow.style.setProperty('top', '0', 'important');
            chatWindow.style.setProperty('bottom', 'env(safe-area-inset-bottom)', 'important');
            chatWindow.style.setProperty('width', '100vw', 'important');
            chatWindow.style.setProperty('height', 'calc(100vh - env(safe-area-inset-bottom))', 'important');
            chatWindow.style.setProperty('max-width', '100vw', 'important');
            chatWindow.style.setProperty('max-height', 'calc(100vh - env(safe-area-inset-bottom))', 'important');
            chatWindow.style.setProperty('border-radius', '0', 'important');
            chatWindow.style.setProperty('box-shadow', 'none', 'important');
            chatWindow.style.setProperty('margin', '0', 'important');
            
            // Ensure input area has proper safe area padding on mobile
            // This prevents input from being hidden behind iPhone home indicator and Safari URL bar
            if (inputArea) {
                inputArea.style.setProperty('padding-bottom', 'calc(32px + env(safe-area-inset-bottom))', 'important');
            }
            
            // Apply safe area to button on mobile
            if (chatButton) {
                chatButton.style.setProperty('bottom', 'calc(24px + env(safe-area-inset-bottom))', 'important');
            }
        } else {
            // Reset to default desktop styles
            chatWindow.style.removeProperty('left');
            chatWindow.style.removeProperty('right');
            chatWindow.style.removeProperty('top');
            chatWindow.style.removeProperty('bottom');
            chatWindow.style.removeProperty('width');
            chatWindow.style.removeProperty('height');
            chatWindow.style.removeProperty('max-width');
            chatWindow.style.removeProperty('max-height');
            chatWindow.style.removeProperty('border-radius');
            chatWindow.style.removeProperty('box-shadow');
            chatWindow.style.removeProperty('margin');
            
            if (inputArea) {
                inputArea.style.removeProperty('padding-bottom');
            }
            
            if (chatButton) {
                chatButton.style.removeProperty('bottom');
            }
        }
    }

    function initWidget(widgetConfig, supabaseConfig) {
        console.log('ChatWidget: Initializing...', { widgetConfig, supabaseConfig });

        widgetData = widgetConfig;

        // Inject CSS styles
        injectStyles(widgetData.brand_color, widgetData.position);

        // Initialize Supabase client
        // SECURITY: This uses the PUBLIC anon key. RLS policies MUST be configured!
        // Use window.supabase which was loaded dynamically, or fallback to global supabase
        const supabaseLib = window.supabase || (typeof supabase !== 'undefined' ? supabase : null);
        if (!supabaseLib) {
            console.error('ChatWidget: Supabase library not available');
            return;
        }
        supabaseClient = supabaseLib.createClient(
            supabaseConfig.url,
            supabaseConfig.key || supabaseConfig.anonKey
        );

        // Verificar e limpar dados expirados (LGPD compliance - 24 horas)
        const submittedAt = localStorage.getItem(STORAGE_KEYS.SUBMITTED_AT);
        if (submittedAt) {
            const expirationTime = 24 * 60 * 60 * 1000; // 24 horas
            const now = Date.now();
            const age = now - parseInt(submittedAt, 10);
            
            if (age > expirationTime) {
                console.log('ChatWidget: Data expired, clearing localStorage...');
                // Limpar apenas dados sensíveis, manter visitor_id
                localStorage.removeItem(STORAGE_KEYS.VISITOR_NAME);
                localStorage.removeItem(STORAGE_KEYS.VISITOR_EMAIL);
                localStorage.removeItem(STORAGE_KEYS.ROOM_ID);
                localStorage.removeItem(STORAGE_KEYS.HAS_SUBMITTED);
                localStorage.removeItem(STORAGE_KEYS.SUBMITTED_AT);
                localStorage.removeItem(STORAGE_KEYS.IS_OPEN);
            }
        }

        // Restaurar estados persistidos
        isOpen = localStorage.getItem(STORAGE_KEYS.IS_OPEN) === 'true';
        hasSubmittedInfo = localStorage.getItem(STORAGE_KEYS.HAS_SUBMITTED) === 'true';
        visitorInfo.name = localStorage.getItem(STORAGE_KEYS.VISITOR_NAME) || '';
        visitorInfo.email = localStorage.getItem(STORAGE_KEYS.VISITOR_EMAIL) || '';
        roomId = localStorage.getItem(STORAGE_KEYS.ROOM_ID);

        // Initialize visitor ID with FingerprintJS
        initializeVisitorId().then(() => {
            console.log('ChatWidget: Visitor ID:', visitorId);
            console.log('ChatWidget: Has submitted info:', hasSubmittedInfo);
            console.log('ChatWidget: Previous room ID:', roomId);

            // Check for existing active room before creating UI
            checkForActiveRoom().then(() => {
                createWidgetUI();
                addEventListeners();
                
                // Auto-open if was open
                if (isOpen) {
                    setTimeout(() => {
                        openChat();
                    }, 100);
                }
            });
        }).catch((error) => {
            console.error('ChatWidget: Error initializing visitor ID:', error);
            // Fallback to old method if FingerprintJS fails
            visitorId = localStorage.getItem(STORAGE_KEYS.VISITOR_ID) || `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem(STORAGE_KEYS.VISITOR_ID, visitorId);
            
            checkForActiveRoom().then(() => {
                createWidgetUI();
                addEventListeners();
            });
        });

        // Listener para visibilidade da página
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Cleanup de subscriptions quando página for fechada (previne memory leak)
        window.addEventListener('beforeunload', cleanupSubscriptions);
        window.addEventListener('pagehide', cleanupSubscriptions);

        // Apply mobile styles on resize (only after DOM is ready)
        window.addEventListener('resize', () => {
            if (document.getElementById('chat-widget-window')) {
                applyMobileStyles();
            }
        });

        console.log('ChatWidget: Initialized successfully');
    }

    // Heartbeat para indicar que visitante está online
    function startHeartbeat() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
        
        // Enviar heartbeat a cada 30 segundos
        heartbeatInterval = setInterval(async () => {
            if (roomId && isOpen) {
                try {
                    await fetch(`${API_BASE}/api/visitor/heartbeat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ roomId }),
                    });
                } catch (err) {
                    console.warn('ChatWidget: Heartbeat failed:', err);
                }
            }
        }, 30000); // 30 segundos
        
        // Enviar heartbeat imediatamente ao iniciar
        if (roomId) {
            fetch(`${API_BASE}/api/visitor/heartbeat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId }),
            }).catch(err => console.warn('ChatWidget: Initial heartbeat failed:', err));
        }
    }
    
    function stopHeartbeat() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
    }

    // Marcar visitante como offline
    function markAsOffline() {
        if (!roomId) {
            console.log('ChatWidget: No roomId to mark offline');
            return;
        }
        
        console.log('ChatWidget: Marking as offline, roomId:', roomId);
        
        try {
            // Usar FormData para máxima compatibilidade com sendBeacon
            const formData = new FormData();
            formData.append('roomId', roomId);
            
            // sendBeacon é mais confiável para eventos de unload
            if (navigator.sendBeacon) {
                const sent = navigator.sendBeacon(`${API_BASE}/api/visitor/offline`, formData);
                console.log('ChatWidget: sendBeacon result:', sent);
                
                // Se sendBeacon falhar, tentar fetch como fallback
                if (!sent) {
                    console.warn('ChatWidget: sendBeacon failed, trying fetch fallback');
                    fetch(`${API_BASE}/api/visitor/offline`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ roomId }),
                        keepalive: true,
                    }).catch(err => console.error('ChatWidget: Fetch fallback failed:', err));
                }
            } else {
                // Fallback para navegadores que não suportam sendBeacon
                console.log('ChatWidget: Using fetch fallback (no sendBeacon support)');
                fetch(`${API_BASE}/api/visitor/offline`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roomId }),
                    keepalive: true,
                }).catch(err => console.error('ChatWidget: Fetch failed:', err));
            }
        } catch (err) {
            console.error('ChatWidget: Failed to mark as offline:', err);
        }
    }

    function cleanupSubscriptions() {
        console.log('ChatWidget: Cleaning up subscriptions...');
        console.log('ChatWidget: Current roomId:', roomId);
        console.log('ChatWidget: isOpen:', isOpen);
        
        stopHeartbeat();
        markAsOffline(); // Marcar como offline ao limpar
        
        if (messageChannel) {
            supabaseClient.removeChannel(messageChannel);
            messageChannel = null;
        }
        
        if (roomStatusChannel) {
            supabaseClient.removeChannel(roomStatusChannel);
            roomStatusChannel = null;
        }
    }

    async function checkForActiveRoom() {
        if (!roomId) return;
        
        // Check if visitor is banned before checking for active room
        if (isBanned) {
            console.warn('ChatWidget: Visitor is banned, clearing room');
            roomId = null;
            roomStatus = null;
            localStorage.removeItem(STORAGE_KEYS.ROOM_ID);
            return;
        }

        try {
            // First check if visitor is banned
            const banCheckResponse = await fetch(`${API_BASE}/api/visitor/track?visitor_id=${encodeURIComponent(visitorId)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (banCheckResponse.ok) {
                const banCheckData = await banCheckResponse.json();
                if (banCheckData.banned) {
                    isBanned = true;
                    disableWidgetForBannedUser(banCheckData.reason || 'Acesso negado');
                    roomId = null;
                    roomStatus = null;
                    localStorage.removeItem(STORAGE_KEYS.ROOM_ID);
                    return;
                }
            }

            const { data: existingRoom } = await supabaseClient
                .from('rooms')
                .select('*')
                .eq('id', roomId)
                .eq('widget_id', widgetData.id)
                .eq('visitor_id', visitorId)
                .single();

            if (existingRoom) {
                console.log('ChatWidget: Found existing room:', existingRoom.id, 'Status:', existingRoom.status);
                
                // Atualizar status da sala (pode estar 'open' ou 'closed')
                roomId = existingRoom.id;
                roomStatus = existingRoom.status;
                hasSubmittedInfo = true;
                localStorage.setItem(STORAGE_KEYS.HAS_SUBMITTED, 'true');
                
                // Se a sala está aberta, considerar como ativa
                if (existingRoom.status === 'open') {
                    hasActiveRoom = true;
                } else {
                    console.log('ChatWidget: Room is closed, visitor will see closed notice');
                }
                
                if (existingRoom.visitor_name) {
                    visitorInfo.name = existingRoom.visitor_name;
                    localStorage.setItem(STORAGE_KEYS.VISITOR_NAME, existingRoom.visitor_name);
                }
                if (existingRoom.visitor_email) {
                    visitorInfo.email = existingRoom.visitor_email;
                    localStorage.setItem(STORAGE_KEYS.VISITOR_EMAIL, existingRoom.visitor_email);
                }
            } else {
                console.log('ChatWidget: No room found');
                roomId = null;
                roomStatus = null;
                localStorage.removeItem(STORAGE_KEYS.ROOM_ID);
            }
        } catch (error) {
            console.error('ChatWidget: Error checking for active room:', error);
        }
    }

    function showError(message) {
        // Criar notificação de erro elegante
        const errorDiv = document.createElement('div');
        errorDiv.className = 'chat-widget-error';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        // Remover após 5 segundos
        setTimeout(() => {
            errorDiv.classList.add('fade-out');
            setTimeout(() => errorDiv.remove(), 300);
        }, 5000);
    }

    function checkRateLimit() {
        const now = Date.now();
        
        // Remover timestamps antigos (fora da janela de tempo)
        RATE_LIMIT.messageTimestamps = RATE_LIMIT.messageTimestamps.filter(
            timestamp => now - timestamp < RATE_LIMIT.timeWindow
        );
        
        // Verificar se excedeu o limite
        if (RATE_LIMIT.messageTimestamps.length >= RATE_LIMIT.maxMessages) {
            const oldestTimestamp = RATE_LIMIT.messageTimestamps[0];
            const waitTime = Math.ceil((RATE_LIMIT.timeWindow - (now - oldestTimestamp)) / 1000);
            return {
                allowed: false,
                waitTime: waitTime
            };
        }
        
        // Adicionar novo timestamp
        RATE_LIMIT.messageTimestamps.push(now);
        
        return { allowed: true };
    }

        async function initializeRoom() {
        console.log('ChatWidget: Initializing room...', {
            widgetId: widgetData?.id,
            visitorId,
            visitorName: visitorInfo.name,
            visitorEmail: visitorInfo.email
        });

            // Check if visitor is banned before initializing
            if (isBanned) {
                console.warn('ChatWidget: Attempt to initialize room while banned');
                disableWidgetForBannedUser('Acesso negado');
                return;
            }

            try {
                // Use API route to initialize or get existing room
                const response = await fetch(`${API_BASE}/api/visitor/rooms`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        widget_id: widgetData.id,
                        visitor_id: visitorId,
                        visitor_name: visitorInfo.name,
                        visitor_email: visitorInfo.email,
                        page_url: window.location.href,
                        page_title: document.title,
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    if (errorData.banned || response.status === 403) {
                        isBanned = true;
                        disableWidgetForBannedUser(errorData.reason || 'Acesso negado');
                        return;
                    }
                    const error = await response.text();
                    throw new Error(error);
                }

                const result = await response.json();
                const room = result.room;

                roomId = room.id;
                roomStatus = room.status;
                localStorage.setItem(STORAGE_KEYS.ROOM_ID, roomId);
                    
                console.log('ChatWidget: Room initialized:', roomId);
                    
                loadMessages();
                subscribeToRoomStatus();
            } catch (error) {
            console.error('ChatWidget: Error initializing room:', error);
            showError('Erro ao iniciar conversa. Por favor, tente novamente.');
            }
        }

        async function startNewConversation() {
            console.log('ChatWidget: Starting new conversation...');
            
            // Check if visitor is banned before starting new conversation
            if (isBanned) {
                console.warn('ChatWidget: Attempt to start new conversation while banned');
                disableWidgetForBannedUser('Acesso negado');
                showError('Você não pode iniciar uma nova conversa. Acesso negado.');
                return;
            }

            // Check ban status before creating new room
            try {
                const banCheckResponse = await fetch(`${API_BASE}/api/visitor/track?visitor_id=${encodeURIComponent(visitorId)}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (banCheckResponse.ok) {
                    const banCheckData = await banCheckResponse.json();
                    if (banCheckData.banned) {
                        isBanned = true;
                        disableWidgetForBannedUser(banCheckData.reason || 'Acesso negado');
                        showError('Você não pode iniciar uma nova conversa. Acesso negado.');
                        return;
                    }
                }
            } catch (banCheckError) {
                console.error('ChatWidget: Error checking ban status:', banCheckError);
                // Continue anyway, API will catch it
            }
            
            try {
                // Limpar subscriptions antigas
                if (messageChannel) {
                    supabaseClient.removeChannel(messageChannel);
                    messageChannel = null;
                }
                
                if (roomStatusChannel) {
                    supabaseClient.removeChannel(roomStatusChannel);
                    roomStatusChannel = null;
                }
                
                // Limpar mensagens da UI
                const messagesContainer = document.getElementById('chat-widget-messages');
                if (messagesContainer) {
                    messagesContainer.innerHTML = '';
                }
                
                // Limpar input e imagem selecionada
                const input = document.getElementById('chat-widget-input');
                if (input) {
                    input.value = '';
                }
                selectedImage = null;
                const preview = document.getElementById('chat-widget-image-preview');
                if (preview) preview.style.display = 'none';
                const fileInput = document.getElementById('chat-widget-file-input');
                if (fileInput) fileInput.value = '';
                
                // Resetar variáveis de estado da sala antiga
                roomId = null;
                roomStatus = null;
                
                // Remover room_id do localStorage para forçar criação de nova sala
                localStorage.removeItem(STORAGE_KEYS.ROOM_ID);
                
                // Parar heartbeat da sala antiga
                stopHeartbeat();
                
                // Criar nova sala (initializeRoom busca apenas salas com status 'open', então criará uma nova)
                await initializeRoom();
                
                // If banned after initializeRoom, stop here
                if (isBanned) {
                    return;
                }
                
                // Atualizar UI após nova sala ser criada
                updateClosedNotice();
                
                // Restaurar texto do botão (caso ainda esteja visível)
                const newConversationBtn = document.getElementById('chat-widget-new-conversation-btn');
                if (newConversationBtn) {
                    newConversationBtn.disabled = false;
                    newConversationBtn.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 5v14M5 12h14"></path>
                        </svg>
                        Iniciar nova conversa
                    `;
                }
                
                console.log('ChatWidget: New conversation started successfully');
            } catch (error) {
                console.error('ChatWidget: Error starting new conversation:', error);
                // Check if error is due to ban
                if (isBanned) {
                    return;
                }
                showError('Erro ao iniciar nova conversa. Por favor, tente novamente.');
                throw error; // Re-throw para o handler de erro restaurar o botão
            }
        }

        async function loadMessages() {
            // Check if banned before loading messages
            if (isBanned || !roomId) return;
            
            try {
                // Use API route to load messages
                const response = await fetch(`${API_BASE}/api/visitor/rooms/${roomId}/messages`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(error);
                }

                const result = await response.json();
                const messages = result.messages || [];
                
                const messagesContainer = document.getElementById('chat-widget-messages');
                if (messagesContainer) {
                    messagesContainer.innerHTML = '';
                messages.forEach(addMessageToUI);
                    scrollToBottom();
                }
                
                subscribeToMessages();
            
            // Atualizar UI baseado no status atual da sala
            updateClosedNotice();
            } catch (error) {
            console.error('ChatWidget: Error loading messages:', error);
            }
        }

        function subscribeToMessages() {
            if (messageChannel) {
                supabaseClient.removeChannel(messageChannel);
            }

            messageChannel = supabaseClient
                .channel(`room:${roomId}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `room_id=eq.${roomId}`
                }, payload => {
                    const message = payload.new;
                    addMessageToUI(message);
                    scrollToBottom();
                    
                    // Se widget está fechado e mensagem é do atendente
                    if (!isOpen && message.sender_type === 'agent') {
                        showSystemNotification(message);
                        showUnreadBadge();
                    }
                })
                .subscribe();
            
            console.log('ChatWidget: Subscribed to messages');
        }

        function subscribeToRoomStatus() {
            if (roomStatusChannel) {
                supabaseClient.removeChannel(roomStatusChannel);
            }

            roomStatusChannel = supabaseClient
                .channel(`room-status:${roomId}`)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'rooms',
                    filter: `id=eq.${roomId}`
                }, payload => {
                const room = payload.new;
                roomStatus = room.status;
                console.log('ChatWidget: Room status updated:', roomStatus);
                updateClosedNotice();
                })
                .subscribe();
    }

    function updateClosedNotice() {
        const notice = document.getElementById('chat-widget-closed-notice');
        const input = document.getElementById('chat-widget-input');
        const sendBtn = document.getElementById('chat-widget-send');
        const attachBtn2 = document.getElementById('chat-widget-attach-btn-2');
        const newConversationBtn = document.getElementById('chat-widget-new-conversation-btn');

        if (roomStatus === 'closed') {
            console.log('ChatWidget: Room is closed, disabling inputs');
            
            // Mostrar aviso visual e botão de nova conversa
            if (notice) notice.style.display = 'block';
            
            // Verificar se há mensagens sendo digitadas ou pendentes para habilitar/desabilitar botão
            const hasInputText = input && input.value.trim().length > 0;
            const hasSelectedImage = selectedImage !== null;
            
            // Desabilitar botão apenas se houver texto digitado ou imagem selecionada
            if (newConversationBtn) {
                newConversationBtn.disabled = hasInputText || hasSelectedImage;
            }
            
            // Desabilitar todos os inputs
            if (input) {
                input.disabled = true;
                input.placeholder = 'Esta conversa foi encerrada';
                input.style.background = '#F3F4F6';
                input.style.cursor = 'not-allowed';
            }
            
            if (sendBtn) {
                sendBtn.disabled = true;
                sendBtn.style.opacity = '0.5';
                sendBtn.style.cursor = 'not-allowed';
            }
            
            if (attachBtn2) {
                attachBtn2.disabled = true;
                attachBtn2.style.opacity = '0.5';
                attachBtn2.style.cursor = 'not-allowed';
            }
        } else {
            console.log('ChatWidget: Room is open, enabling inputs');
            
            // Esconder aviso e botão
            if (notice) notice.style.display = 'none';
            
            // Reabilitar inputs
            if (input) {
                input.disabled = false;
                input.placeholder = 'Enter text here...';
                input.style.background = '#F9FAFB';
                input.style.cursor = 'text';
            }
            
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.style.opacity = '1';
                sendBtn.style.cursor = 'pointer';
            }
            
            if (attachBtn2) {
                attachBtn2.disabled = false;
                attachBtn2.style.opacity = '1';
                attachBtn2.style.cursor = 'pointer';
            }
        }
    }

    async function sendMessage() {
        // Check if visitor is banned
        if (isBanned) {
            console.warn('ChatWidget: Attempt to send message while banned');
            showError('Você não pode enviar mensagens. Acesso negado.');
            return;
        }

        const input = document.getElementById('chat-widget-input');
        const content = input?.value?.trim();

        // Validar se não tem conteúdo
        if (!content && !selectedImage) return;
        
        // Validar se conversa está fechada
        if (roomStatus === 'closed') {
            console.warn('ChatWidget: Attempt to send message in closed conversation');
            showError('Esta conversa foi encerrada. Inicie uma nova conversa para continuar.');
            return;
        }

        // Verificar rate limiting
        const rateLimitCheck = checkRateLimit();
        if (!rateLimitCheck.allowed) {
            showError(`Você está enviando mensagens muito rápido. Aguarde ${rateLimitCheck.waitTime} segundos.`);
            return;
        }

        // Se não tem room, inicializar primeiro
        if (!roomId) {
            console.log('ChatWidget: No room ID, initializing room...');
            await initializeRoom();
            
            // If banned after initializeRoom, stop here
            if (isBanned) {
                return;
            }
            
            // Se ainda não tem room após inicializar, abortar
            if (!roomId) {
                console.error('ChatWidget: Failed to initialize room');
                showError('Erro ao iniciar conversa. Tente novamente.');
                return;
            }
        }

        try {
            let imageUrl = null;
            let imageName = null;

            // Upload image if selected
            if (selectedImage) {
                console.log('ChatWidget: Uploading image...', selectedImage.name);
                    const formData = new FormData();
                    formData.append('file', selectedImage);
                    formData.append('roomId', roomId);

                // Timeout de 30 segundos para upload (pode demorar mais que requisições normais)
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);

                try {
                    const response = await fetch(`${API_BASE}/api/upload-image`, {
                        method: 'POST',
                        body: formData,
                        signal: controller.signal,
                    });

                    clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    if (errorData.banned || response.status === 403) {
                        isBanned = true;
                        disableWidgetForBannedUser(errorData.reason || 'Acesso negado');
                        showError('Você não pode enviar mensagens. Acesso negado.');
                        return;
                    }
                    const errorText = await response.text();
                    console.error('ChatWidget: Upload failed:', errorText);
                    throw new Error('Failed to upload image');
                }
                    
                    const result = await response.json();
                    imageUrl = result.imageUrl;  // API retorna 'imageUrl', não 'url'
                    imageName = selectedImage.name;
                    console.log('ChatWidget: Image uploaded successfully:', imageUrl);
                } catch (uploadError) {
                    clearTimeout(timeoutId);
                    if (uploadError.name === 'AbortError') {
                        throw new Error('Upload timeout - imagem muito grande ou conexão lenta');
                    }
                    throw uploadError;
                }
            }

            // Validar que tem content OU imageUrl
            if (!content && !imageUrl) {
                console.error('ChatWidget: No content or image to send');
                return;
            }

            // Sanitizar conteúdo da mensagem
            const sanitizedContent = content ? sanitizeInput(content) : '';
            
            console.log('ChatWidget: Sending message', { roomId, content: sanitizedContent, imageUrl });

            // Use API route to send message
            const response = await fetch(`${API_BASE}/api/visitor/rooms/${roomId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    visitor_id: visitorId,
                    visitor_name: sanitizeInput(visitorInfo?.name || 'Visitante'),
                    content: sanitizedContent,
                    image_url: imageUrl || null,
                    image_name: imageName || null,
                    message_type: imageUrl ? 'image' : 'text',
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (errorData.banned || response.status === 403) {
                    isBanned = true;
                    disableWidgetForBannedUser(errorData.reason || 'Acesso negado');
                    showError('Você não pode enviar mensagens. Acesso negado.');
                    return;
                }
                const error = await response.text();
                throw new Error(error);
            }

                if (input) input.value = '';

            // Clear selected image
                if (selectedImage) {
                    selectedImage = null;
                    const preview = document.getElementById('chat-widget-image-preview');
                    const fileInput = document.getElementById('chat-widget-file-input');
                    if (preview) preview.style.display = 'none';
                    if (fileInput) fileInput.value = '';
                }
            } catch (error) {
                console.error('ChatWidget: Error sending message', error);
            showError(error.message || 'Erro ao enviar mensagem. Tente novamente.');
            }
        }

        function addMessageToUI(message) {
            const messagesContainer = document.getElementById('chat-widget-messages');
            if (!messagesContainer) return;

        // System message
            if (message.message_type === 'system') {
                const systemDiv = document.createElement('div');
            systemDiv.className = 'chat-system-message';
                
                const systemBubble = document.createElement('div');
            systemBubble.className = 'chat-system-bubble';
                systemBubble.textContent = message.content;
            
                systemDiv.appendChild(systemBubble);
                messagesContainer.appendChild(systemDiv);
                return;
            }

            const isVisitor = message.sender_type === 'visitor';
            
        const messageWrapper = document.createElement('div');
        messageWrapper.className = `chat-message-wrapper ${isVisitor ? 'visitor' : 'agent'}`;

        const messageRow = document.createElement('div');
        messageRow.className = `chat-message-row ${isVisitor ? 'visitor' : 'agent'}`;

        // Avatar
        const avatar = document.createElement('div');
        avatar.className = `chat-message-avatar ${isVisitor ? 'visitor' : 'agent'}`;
        
        // Se tiver sender_avatar (imagem), mostrar a imagem
        if (message.sender_avatar) {
            const avatarImg = document.createElement('img');
            avatarImg.src = message.sender_avatar;
            avatarImg.alt = message.sender_name || 'Avatar';
            avatarImg.style.width = '100%';
            avatarImg.style.height = '100%';
            avatarImg.style.objectFit = 'cover';
            avatarImg.style.borderRadius = '50%';
            avatar.appendChild(avatarImg);
        } else {
            // Fallback para inicial do nome - sempre mostrar pelo menos uma letra
            const initials = message.sender_name 
                ? message.sender_name.trim().charAt(0).toUpperCase()
                : (isVisitor ? 'V' : 'S');
            avatar.textContent = initials;
            // Garantir que o avatar seja visível
            avatar.style.display = 'flex';
            avatar.style.visibility = 'visible';
        }

        // Message bubble
            const bubble = document.createElement('div');
        // Aplicar background apenas se tiver conteúdo de texto
        const hasOnlyImage = message.image_url && !message.content;
        bubble.className = `chat-message-bubble ${isVisitor ? 'visitor' : 'agent'} ${hasOnlyImage ? 'no-background' : ''}`;
        
        // Ajustar padding: remover se só tem imagem
        if (hasOnlyImage) {
            bubble.style.padding = '0';
            bubble.style.background = 'transparent';
        }

            if (message.content) {
                const content = document.createElement('p');
            content.className = 'chat-message-content';
                content.textContent = message.content;
                bubble.appendChild(content);
            }

            if (message.image_url) {
                const img = document.createElement('img');
            img.className = 'chat-message-image';
                img.src = message.image_url;
            img.alt = message.image_name || 'Image';
            if (message.content) img.style.marginTop = '8px';
                img.onclick = () => window.open(message.image_url, '_blank');
                bubble.appendChild(img);
            }

        messageRow.appendChild(avatar);
        messageRow.appendChild(bubble);
        messageWrapper.appendChild(messageRow);

        // Name
        const metaInfo = document.createElement('div');
        metaInfo.className = `chat-message-meta ${isVisitor ? 'visitor' : 'agent'}`;

        const nameSpan = document.createElement('span');
        nameSpan.textContent = message.sender_name || 'Visitor';
        metaInfo.appendChild(nameSpan);
        
        messageWrapper.appendChild(metaInfo);
        messagesContainer.appendChild(messageWrapper);
        }

        function scrollToBottom() {
            const messagesContainer = document.getElementById('chat-widget-messages');
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }

        function handleVisibilityChange() {
            if (document.hidden) {
                console.log('ChatWidget: Tab hidden, pausing heartbeat...');
                // Pausar heartbeat quando aba está escondida
                stopHeartbeat();
            } else {
                console.log('ChatWidget: Tab visible, resuming...');
                restoreWidgetState();
                // Retomar heartbeat se chat estiver aberto
                if (isOpen && roomId && hasSubmittedInfo) {
                    startHeartbeat();
                }
            }
        }

        function restoreWidgetState() {
            const chatWindow = document.getElementById('chat-widget-window');
            const button = document.getElementById('chat-widget-button');
            const chatContainer = document.getElementById('chat-widget-chat-container');
            const welcomeForm = document.getElementById('chat-widget-welcome-form');
            
            if (isOpen && chatWindow) {
                chatWindow.style.display = 'flex';
                applyMobileStyles(); // Apply mobile styles when restoring state
                if (button) button.style.display = 'none';
                
                if (hasSubmittedInfo || hasActiveRoom) {
                    if (chatContainer) chatContainer.style.display = 'flex';
                    if (welcomeForm) welcomeForm.style.display = 'none';
                } else {
                    if (chatContainer) chatContainer.style.display = 'none';
                    if (welcomeForm) welcomeForm.style.display = 'flex';
                }
            }
        }

    function showSystemNotification(message) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Nova Mensagem - Chat', {
                body: message.content || 'Você recebeu uma nova mensagem',
                icon: '/icon.png',
                tag: 'chat-message',
            });
        }
    }

    function showUnreadBadge() {
        const button = document.getElementById('chat-widget-button');
        if (!button) return;

        let badge = document.getElementById('chat-widget-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'chat-widget-badge';
            button.appendChild(badge);
        }
    }

    function hideUnreadBadge() {
        const badge = document.getElementById('chat-widget-badge');
        if (badge) badge.remove();
    }

    function createWidgetUI() {
        const container = document.createElement('div');
        container.id = 'chat-widget-container';
        container.innerHTML = `
            <!-- Chat Button -->
            <button id="chat-widget-button" style="display: ${isOpen ? 'none' : 'flex'};">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                </svg>
            </button>

            <!-- Chat Window -->
            <div id="chat-widget-window" style="display: ${isOpen ? 'flex' : 'none'};">
                <!-- Header -->
                <div class="chat-widget-header">
                    ${widgetData.avatar_url 
                        ? `<img src="${widgetData.avatar_url}" alt="${widgetData.company_name || 'Logo'}" class="chat-widget-header-avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" />`
                        : `<div class="chat-widget-header-avatar-fallback" style="width: 32px; height: 32px; border-radius: 50%; background: rgba(255, 255, 255, 0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 14px; flex-shrink: 0;">${(widgetData.company_name || 'C').substring(0, 1).toUpperCase()}</div>`
                    }
                    <button id="chat-widget-close" class="chat-widget-close-btn">×</button>
                    </div>

                <!-- Welcome Form -->
                <div id="chat-widget-welcome-form" style="display: ${hasSubmittedInfo ? 'none' : 'flex'};">
                        <div style="text-align: center; margin-bottom: 24px;">
                        <div class="chat-widget-welcome-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                </svg>
                            </div>
                        <h3 style="margin: 0 0 8px 0; font-size: 20px; color: #111827; font-weight: 600;">Welcome!</h3>
                        <p style="margin: 0; font-size: 14px; color: #6B7280;">Tell us a bit about yourself to get started</p>
                        </div>

                    <form id="chat-widget-visitor-form">
                        <div class="chat-widget-form-group">
                            <label class="chat-widget-form-label">Name *</label>
                            <input type="text" id="chat-widget-visitor-name" class="chat-widget-form-input" required placeholder="Your name" />
                            </div>

                        <div class="chat-widget-form-group">
                            <label class="chat-widget-form-label">Email *</label>
                            <input type="email" id="chat-widget-visitor-email" class="chat-widget-form-input" required placeholder="your@email.com" />
                            </div>

                        <button type="submit" class="chat-widget-submit-btn">Start Chat</button>
                        </form>
                    </div>

                <!-- Chat Container -->
                <div id="chat-widget-chat-container" style="display: ${hasSubmittedInfo ? 'flex' : 'none'};">
                    <div id="chat-widget-messages"></div>

                    <!-- Input Area -->
                    <div class="chat-widget-input-area">
                        <div id="chat-widget-closed-notice" style="display: none;">
                            🔒 Esta conversa foi encerrada pelo suporte.
                            <button id="chat-widget-new-conversation-btn" type="button">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 5v14M5 12h14"></path>
                                </svg>
                                Iniciar nova conversa
                            </button>
                        </div>

                        <div id="chat-widget-image-preview" style="display: none;">
                            <div style="position: relative; display: inline-block;">
                                <img id="chat-widget-preview-img" class="chat-widget-preview-img" />
                                <button id="chat-widget-remove-image" class="chat-widget-remove-image-btn">×</button>
                            </div>
                        </div>

                        <div class="chat-widget-input-row">
                            <input type="text" id="chat-widget-input" placeholder="Enter text here..." />
                            
                            <input id="chat-widget-file-input" type="file" accept="image/*" style="display: none;" />
                            <button id="chat-widget-attach-btn-2" class="chat-widget-attach-btn">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                                </svg>
                            </button>

                            <button id="chat-widget-send">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="22" y1="2" x2="11" y2="13"></line>
                                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                </svg>
                            </button>
                        </div>
                    </div>
                    </div>
                </div>
            `;

        document.body.appendChild(container);
        console.log('ChatWidget: UI created and added to DOM');
        
        // Apply mobile styles after DOM creation (use requestAnimationFrame to ensure DOM is ready)
        requestAnimationFrame(() => {
            applyMobileStyles();
        });
    }

    function addEventListeners() {
            const button = document.getElementById('chat-widget-button');
            const closeBtn = document.getElementById('chat-widget-close');
        const sendBtn = document.getElementById('chat-widget-send');
            const input = document.getElementById('chat-widget-input');
        const form = document.getElementById('chat-widget-visitor-form');
        const attachBtn2 = document.getElementById('chat-widget-attach-btn-2');
        const fileInput = document.getElementById('chat-widget-file-input');

        if (button) button.addEventListener('click', openChat);
        if (closeBtn) closeBtn.addEventListener('click', closeChat);
        if (sendBtn) sendBtn.addEventListener('click', sendMessage);
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const nameInput = document.getElementById('chat-widget-visitor-name');
                const emailInput = document.getElementById('chat-widget-visitor-email');
                
                const name = nameInput.value.trim();
                const email = emailInput.value.trim();
                
                // Validação robusta de email
                const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                if (!emailRegex.test(email)) {
                    showError('Por favor, insira um email válido.');
                    emailInput.focus();
                        return;
                    }

                // Validação de nome (mínimo 2 caracteres)
                if (name.length < 2) {
                    showError('Por favor, insira seu nome completo (mínimo 2 caracteres).');
                    nameInput.focus();
                        return;
                    }

                // Sanitização robusta
                visitorInfo.name = sanitizeInput(name);
                visitorInfo.email = sanitizeInput(email);
                
                localStorage.setItem(STORAGE_KEYS.VISITOR_NAME, visitorInfo.name);
                localStorage.setItem(STORAGE_KEYS.VISITOR_EMAIL, visitorInfo.email);
                localStorage.setItem(STORAGE_KEYS.HAS_SUBMITTED, 'true');
                localStorage.setItem(STORAGE_KEYS.SUBMITTED_AT, Date.now().toString());
                
                hasSubmittedInfo = true;
                
                const welcomeForm = document.getElementById('chat-widget-welcome-form');
                const chatContainer = document.getElementById('chat-widget-chat-container');
                
                if (welcomeForm) welcomeForm.style.display = 'none';
                if (chatContainer) chatContainer.style.display = 'flex';
                
                await initializeRoom();
            });
        }

        if (attachBtn2) attachBtn2.addEventListener('click', () => fileInput?.click());
        
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files?.[0];
                if (file && file.type.startsWith('image/')) {
                    selectedImage = file;
                    const preview = document.getElementById('chat-widget-image-preview');
                    const previewImg = document.getElementById('chat-widget-preview-img');
                    
                    if (preview && previewImg) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                            previewImg.src = e.target.result;
                            preview.style.display = 'block';
                            // Atualizar estado do botão se a conversa estiver fechada
                            if (roomStatus === 'closed') {
                                updateClosedNotice();
                            }
                    };
                    reader.readAsDataURL(file);
                    }
                }
                });
            }

        const removeImageBtn = document.getElementById('chat-widget-remove-image');
            if (removeImageBtn) {
                removeImageBtn.addEventListener('click', () => {
                    selectedImage = null;
                const preview = document.getElementById('chat-widget-image-preview');
                if (preview) preview.style.display = 'none';
                if (fileInput) fileInput.value = '';
                // Atualizar estado do botão de nova conversa se estiver visível
                updateClosedNotice();
            });
        }

        // Adicionar listener para o botão de nova conversa
        const newConversationBtn = document.getElementById('chat-widget-new-conversation-btn');
        if (newConversationBtn) {
            newConversationBtn.addEventListener('click', async () => {
                // Desabilitar botão durante o processo
                const originalText = newConversationBtn.innerHTML;
                newConversationBtn.disabled = true;
                newConversationBtn.innerHTML = '<span>Iniciando...</span>';
                
                try {
                    await startNewConversation();
                    // Botão será atualizado pela updateClosedNotice quando nova sala for criada
                } catch (error) {
                    // Restaurar botão em caso de erro
                    newConversationBtn.disabled = false;
                    newConversationBtn.innerHTML = originalText;
                }
            });
        }

        // Monitorar mudanças no input para atualizar estado do botão
        if (input) {
            input.addEventListener('input', () => {
                // Atualizar estado do botão se a conversa estiver fechada
                if (roomStatus === 'closed') {
                    updateClosedNotice();
                }
            });
        }

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    function openChat() {
        isOpen = true;
        localStorage.setItem(STORAGE_KEYS.IS_OPEN, 'true');
        
        const chatWindow = document.getElementById('chat-widget-window');
        const button = document.getElementById('chat-widget-button');
        
        if (chatWindow) {
            chatWindow.style.display = 'flex';
            applyMobileStyles();
        }
        if (button) button.style.display = 'none';
        
        hideUnreadBadge();
        
        if (hasSubmittedInfo && roomId) {
            loadMessages();
            startHeartbeat(); // Iniciar heartbeat quando chat abre
        }
    }

    function closeChat() {
        isOpen = false;
        localStorage.setItem(STORAGE_KEYS.IS_OPEN, 'false');
        
        const chatWindow = document.getElementById('chat-widget-window');
        const button = document.getElementById('chat-widget-button');
        
        if (chatWindow) chatWindow.style.display = 'none';
        if (button) button.style.display = 'flex';
        
        // Limpar subscriptions ao fechar (economiza recursos)
        cleanupSubscriptions();
    }

    // Load FingerprintJS library dynamically
    function loadFingerprintJS() {
        return new Promise((resolve, reject) => {
            // Check if FingerprintJS is already loaded
            if (window.FingerprintJS) {
                resolve(window.FingerprintJS);
                return;
            }

            // Check if script is already being loaded
            if (document.querySelector('script[data-fingerprintjs-loader]')) {
                const checkInterval = setInterval(() => {
                    if (window.FingerprintJS) {
                        clearInterval(checkInterval);
                        resolve(window.FingerprintJS);
                    }
                }, 50);
                setTimeout(() => {
                    clearInterval(checkInterval);
                    reject(new Error('Timeout loading FingerprintJS library'));
                }, 10000);
                return;
            }

            // Load FingerprintJS from CDN
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@fingerprintjs/fingerprintjs@4/dist/fp.min.js';
            script.setAttribute('data-fingerprintjs-loader', 'true');
            script.async = true;
            
            script.onload = () => {
                if (window.FingerprintJS) {
                    resolve(window.FingerprintJS);
                } else {
                    reject(new Error('FingerprintJS not available after load'));
                }
            };
            
            script.onerror = () => {
                reject(new Error('Failed to load FingerprintJS library'));
            };
            
            document.head.appendChild(script);
        });
    }

    // Initialize visitor ID using FingerprintJS
    async function initializeVisitorId() {
        try {
            // Try to get from localStorage first (for backward compatibility)
            let storedId = localStorage.getItem(STORAGE_KEYS.VISITOR_ID);
            
            // Load FingerprintJS
            const FingerprintJS = await loadFingerprintJS();
            const fp = await FingerprintJS.load();
            const result = await fp.get();
            
            // Use FingerprintJS visitorId
            const fingerprintId = result.visitorId;
            
            // If we have a stored ID and it's different, log it (could be old format)
            if (storedId && storedId !== fingerprintId && !storedId.startsWith('visitor_')) {
                console.log('ChatWidget: Migrating from old visitor ID format');
            }
            
            visitorId = fingerprintId;
            localStorage.setItem(STORAGE_KEYS.VISITOR_ID, visitorId);
            
            // Track visitor with fingerprint data
            await trackVisitor(result, {
                page_url: window.location.href,
                page_title: document.title,
            });
            
            return visitorId;
        } catch (error) {
            console.error('ChatWidget: Error initializing with FingerprintJS:', error);
            // Fallback to old method
            if (!visitorId) {
                visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                localStorage.setItem(STORAGE_KEYS.VISITOR_ID, visitorId);
            }
            throw error;
        }
    }

    // Track visitor and check if banned
    async function trackVisitor(fingerprintResult, pageInfo) {
        try {
            // Check if visitor is banned first
            const checkResponse = await fetch(`${API_BASE}/api/visitor/track?visitor_id=${encodeURIComponent(visitorId)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (checkResponse.ok) {
                const checkData = await checkResponse.json();
                if (checkData.banned) {
                    console.warn('ChatWidget: Visitor is banned:', checkData.reason);
                    isBanned = true;
                    // Disable widget for banned users
                    disableWidgetForBannedUser(checkData.reason);
                    return false;
                }
            }

            // Track visitor with full data
            const trackResponse = await fetch(`${API_BASE}/api/visitor/track`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    visitor_id: visitorId,
                    fingerprint_data: {
                        confidence: fingerprintResult.confidence?.score || null,
                        incognito: fingerprintResult.incognito || false,
                        components: fingerprintResult.components || {},
                    },
                    page_url: pageInfo.page_url,
                    page_title: pageInfo.page_title,
                }),
            });

            if (trackResponse.ok) {
                const trackData = await trackResponse.json();
                if (trackData.banned) {
                    console.warn('ChatWidget: Visitor is banned:', trackData.reason);
                    isBanned = true;
                    disableWidgetForBannedUser(trackData.reason);
                    return false;
                }
                console.log('ChatWidget: Visitor tracked successfully');
                isBanned = false; // Ensure flag is cleared if not banned
                return true;
            } else {
                const errorData = await trackResponse.json().catch(() => ({}));
                if (errorData.banned) {
                    isBanned = true;
                    disableWidgetForBannedUser(errorData.reason || 'Access denied');
                    return false;
                }
                console.warn('ChatWidget: Failed to track visitor:', errorData);
                return false;
            }
        } catch (error) {
            console.error('ChatWidget: Error tracking visitor:', error);
            // Don't block widget if tracking fails
            return false;
        }
    }

    // Disable widget for banned users
    function disableWidgetForBannedUser(reason) {
        isBanned = true;
        const container = document.getElementById('chat-widget-container');
        const button = document.getElementById('chat-widget-button');
        const chatWindow = document.getElementById('chat-widget-window');
        
        if (container) {
            container.style.display = 'none';
        }
        if (button) {
            button.style.display = 'none';
        }
        if (chatWindow) {
            chatWindow.style.display = 'none';
        }
        
        // Clear room ID to prevent any further actions
        roomId = null;
        localStorage.removeItem(STORAGE_KEYS.ROOM_ID);
        
        // Cleanup subscriptions
        cleanupSubscriptions();
        
        console.warn('ChatWidget: Widget disabled - Visitor is banned. Reason:', reason);
    }

    // Load Supabase library dynamically if not already loaded
    function loadSupabaseLibrary() {
        return new Promise((resolve, reject) => {
            // Check if Supabase is already loaded (could be from window.supabase or module)
            let supabaseLib = null;
            
            // Check various ways Supabase might be available
            if (typeof window.supabase !== 'undefined') {
                supabaseLib = window.supabase;
            } else if (typeof supabase !== 'undefined') {
                supabaseLib = supabase;
            }
            
            if (supabaseLib && typeof supabaseLib.createClient === 'function') {
                resolve(supabaseLib);
                return;
            }

            // Check if script is already being loaded
            if (document.querySelector('script[data-supabase-widget-loader]')) {
                const checkInterval = setInterval(() => {
                    if (typeof window.supabase !== 'undefined') {
                        clearInterval(checkInterval);
                        resolve(window.supabase);
                    } else if (typeof supabase !== 'undefined') {
                        clearInterval(checkInterval);
                        resolve(supabase);
                    }
                }, 50);
                setTimeout(() => {
                    clearInterval(checkInterval);
                    reject(new Error('Timeout loading Supabase library'));
                }, 10000);
                return;
            }

            // Load Supabase from CDN
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.setAttribute('data-supabase-widget-loader', 'true');
            script.async = true;
            
            script.onload = () => {
                // Check again after script loads
                const loadedSupabase = window.supabase || (typeof supabase !== 'undefined' ? supabase : null);
                if (loadedSupabase && typeof loadedSupabase.createClient === 'function') {
                    resolve(loadedSupabase);
                } else {
                    reject(new Error('Supabase library loaded but createClient not available'));
                }
            };
            
            script.onerror = () => {
                reject(new Error('Failed to load Supabase library from CDN'));
            };
            
            document.head.appendChild(script);
        });
    }

    // Initialize
    const publicKey = window.ChatWidgetConfig?.publicKey || window.CHAT_WIDGET_PUBLIC_KEY;
    
    if (!publicKey) {
        console.error('ChatWidget: No public key provided. Set window.ChatWidgetConfig.publicKey or window.CHAT_WIDGET_PUBLIC_KEY');
        return;
    }

    // Load Supabase library first, then fetch widget config
    loadSupabaseLibrary()
        .then((supabaseLib) => {
            // Store supabase globally for use in initWidget (if not already in window)
            if (typeof window.supabase === 'undefined') {
                window.supabase = supabaseLib;
            }
            
            console.log('ChatWidget: Fetching config from:', `${API_BASE}/api/widget/${publicKey}`);
            
            // Timeout de 10 segundos para carregar configuração
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            return fetch(`${API_BASE}/api/widget/${publicKey}`, { signal: controller.signal })
                .then(res => {
                    clearTimeout(timeoutId);
                    console.log('ChatWidget: Response status:', res.status);
                    if (!res.ok) throw new Error(`Widget not found (${res.status})`);
                    return res.json();
                })
                .then(config => {
                    console.log('ChatWidget: Config loaded:', config);
                    initWidget(config.widget, config.supabase);
                });
        })
        .catch(error => {
            if (error.name === 'AbortError') {
                console.error('ChatWidget: Timeout loading config - check your connection');
            } else if (error.message && error.message.includes('Supabase')) {
                console.error('ChatWidget: Failed to load Supabase library:', error.message);
            } else {
                console.error('ChatWidget: Error loading widget config:', error);
            }
        });
    
    // Expor funções para debug (apenas em desenvolvimento)
    window.ChatWidgetDebug = {
        markOffline: () => markAsOffline(),
        getRoomId: () => roomId,
        getStatus: () => ({
            roomId,
            isOpen,
            hasSubmittedInfo,
            hasActiveRoom,
            heartbeatActive: heartbeatInterval !== null
        })
    };
})();

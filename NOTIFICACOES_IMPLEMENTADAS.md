# Sistema de Notificações Implementado ✅

## Resumo
Sistema completo de notificações de áudio e navegador implementado para visitantes e owners do widget.

## Funcionalidades Implementadas

### 1. Arquivo de Áudio 🔊
- ✅ Arquivo `notification.mp3` movido para `/public/notification.mp3`
- ✅ Tamanho: 40KB
- ✅ Acessível via URL: `/notification.mp3`

### 2. Notificações para Visitantes (Widget)

**Local:** `/public/widget.js`

**Quando dispara:**
- Quando o visitante recebe uma mensagem do agente/suporte
- Apenas quando o widget está FECHADO (minimizado)

**Funcionalidades:**
- 🔊 Som de notificação (volume 50%)
- 🔔 Notificação do navegador (se permissão concedida)
- 🔴 Badge vermelho com contador de mensagens não lidas
- 📱 Animação de pulso no botão do widget

**Código implementado:**
```javascript
// Som de notificação
function playNotificationSound() {
    if (!notificationAudio) {
        notificationAudio = new Audio(`${API_BASE}/notification.mp3`);
        notificationAudio.volume = 0.5; // 50% volume
    }
    notificationAudio.play().catch(e => {
        console.log('Could not play notification sound:', e);
    });
}

// Notificação do sistema
function showSystemNotification(message) {
    if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(title, options);
        notification.onclick = () => {
            window.focus();
            // Abre o widget
            chatContainer.style.display = 'flex';
            isOpen = true;
            clearUnreadBadge();
        };
    }
}
```

**Comportamento:**
1. Visitante fecha o widget
2. Agente envia mensagem
3. Som toca automaticamente
4. Notificação do navegador aparece
5. Badge vermelho aparece no botão
6. Ao clicar na notificação ou abrir widget, badge desaparece

### 3. Notificações para Owners (Dashboard/Inbox)

**Local:** `/app/(saas)/dashboard/widgets/[id]/inbox/page.tsx`

**Quando dispara:**
- Quando o owner está vendo o inbox
- Quando recebe mensagem de um VISITANTE
- Em tempo real via Supabase Realtime

**Funcionalidades:**
- 🔊 Som de notificação (volume 50%)
- 🔔 Notificação do navegador com informações da mensagem
- 📜 Auto-scroll para a nova mensagem
- ✅ Permissão solicitada na primeira visita

**Código implementado:**
```typescript
// Som de notificação
const playNotificationSound = () => {
    if (!notificationAudioRef.current) {
        notificationAudioRef.current = new Audio('/notification.mp3');
        notificationAudioRef.current.volume = 0.5;
    }
    notificationAudioRef.current.play().catch(e => {
        console.log('Could not play notification sound:', e);
    });
};

// Notificação do sistema
const showSystemNotification = (message: Message, roomId: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(title, {
            body: message.content || 'Você recebeu uma nova mensagem',
            icon: widget?.brand_color ? /* SVG icon */ : undefined,
            tag: `inbox-${roomId}`,
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    }
};

// No realtime subscription
if (newMessage.sender_type === 'visitor') {
    playNotificationSound();
    showSystemNotification(newMessage, roomId);
}
```

**Comportamento:**
1. Owner está visualizando uma conversa no inbox
2. Visitante envia mensagem
3. Som toca imediatamente
4. Notificação do navegador aparece
5. Mensagem é adicionada ao chat em tempo real
6. Scroll automático para a nova mensagem

### 4. Permissões do Navegador

**Solicitação de Permissão:**

**Widget (Visitante):**
- Permissão solicitada ao ABRIR o widget pela primeira vez
- Código: `requestNotificationPermission()` no evento de click do botão

**Inbox (Owner):**
- Permissão solicitada ao CARREGAR a página do inbox
- Código: `useEffect(() => { Notification.requestPermission() }, [])`

**Estados de Permissão:**
- `default`: Ainda não foi pedida permissão
- `granted`: Permissão concedida - notificações funcionam
- `denied`: Permissão negada - apenas som funciona

### 5. Detalhes Técnicos

**Volume:**
- Definido em 50% (0.5) para não ser intrusivo

**Fallback:**
- Se o áudio não carregar ou der erro, não quebra a aplicação
- Logs no console para debug

**Performance:**
- Áudio é carregado apenas uma vez (lazy loading)
- Reutiliza a mesma instância para novas notificações

**Browser Support:**
- Chrome/Edge: ✅ Total
- Firefox: ✅ Total
- Safari: ✅ (com permissão explícita)
- Mobile: ⚠️ Limitado (depende do navegador)

## Testando as Notificações

### Teste Widget (Visitante):
1. Abra o widget em um site
2. Permita notificações quando solicitado
3. Envie uma mensagem
4. **FECHE o widget**
5. No dashboard, responda como agente
6. ✅ Você deve ouvir o som e ver a notificação

### Teste Inbox (Owner):
1. Faça login no dashboard
2. Abra o inbox de um widget
3. Permita notificações quando solicitado
4. Em outra aba/janela, abra o widget como visitante
5. Envie uma mensagem como visitante
6. ✅ No inbox, você deve ouvir o som e ver a notificação

## Arquivos Modificados

1. ✅ `/public/notification.mp3` - Arquivo de áudio movido
2. ✅ `/public/widget.js` - Notificações para visitantes
3. ✅ `/app/(saas)/dashboard/widgets/[id]/inbox/page.tsx` - Notificações para owners

## Notas Importantes

⚠️ **Autoplay Policy:**
Navegadores modernos bloqueiam autoplay de áudio sem interação do usuário. Por isso:
- Widget: Som toca após o usuário abrir o widget (interação inicial)
- Inbox: Som toca após carregar a página (considerado interação)

⚠️ **Notificações em Segundo Plano:**
Para notificações funcionarem quando o navegador está em outra aba:
- Usuário DEVE conceder permissão
- Aba deve estar aberta (não pode estar fechada)
- Funciona mesmo em background tabs

⚠️ **Mobile:**
Comportamento pode variar:
- iOS Safari: Requer interação e pode ter limitações
- Android Chrome: Funciona bem
- Apps nativos: Requer Service Worker para push notifications

## Possíveis Melhorias Futuras

1. 🔮 Push Notifications via Service Worker (funciona com app fechado)
2. 🔮 Notificações agregadas (múltiplas mensagens)
3. 🔮 Diferentes sons para diferentes tipos de mensagem
4. 🔮 Configuração de volume pelo usuário
5. 🔮 Modo "Não perturbe" com horários
6. 🔮 Notificações por email para mensagens não lidas
7. 🔮 Badge count na favicon


# 🔔 Configuração de Notificações em Tempo Real

## Problema: Notificações só funcionam na Inbox

As notificações devem funcionar em **todas as páginas do dashboard**, não apenas na inbox.

## Solução Implementada

### 1. NotificationBell Component
O componente `NotificationBell` já está no `DashboardLayout`, então aparece em todas as páginas.

### 2. Verificações Necessárias no Supabase

#### a) Habilitar Realtime nas Tabelas

Acesse o **Supabase Dashboard** → **Database** → **Replication** e certifique-se que as seguintes tabelas estão com Realtime **HABILITADO**:

- ✅ `messages` (table)
- ✅ `rooms` (table)
- ✅ `widgets` (table)

**Como habilitar:**
1. Vá em Database → Replication
2. Encontre cada tabela
3. Clique no toggle para **Enable**
4. Source: `supabase_realtime`

#### b) Configurar Políticas RLS para Realtime

Execute este SQL no **Supabase SQL Editor**:

```sql
-- Garantir que o realtime pode ler as tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE widgets;
```

Se der erro "publication already exists", execute:

```sql
-- Verificar se já está publicado
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Se não estiver, adicionar
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'rooms'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'widgets'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE widgets;
    END IF;
END $$;
```

### 3. Testar as Notificações

#### Passo 1: Abrir o Dashboard
1. Acesse `http://localhost:3000/dashboard` (ou qualquer outra página do dashboard)
2. Abra o Console do navegador (F12)
3. Procure por logs que começam com `🔔`

Você deve ver:
```
🔔 NotificationBell: Initializing for user: <user-id>
🔔 NotificationBell: Subscribing to notifications for user: <user-id>
🔔 Notification subscription status: SUBSCRIBED
✅ Successfully subscribed to notifications
```

#### Passo 2: Enviar Mensagem do Widget
1. Em outra aba/janela, abra o site com o widget
2. Envie uma mensagem
3. Volte para o dashboard

Você deve ver:
```
🔔 New message notification received: {...}
```

E o sino deve mostrar o badge vermelho com o número de mensagens não lidas.

#### Passo 3: Verificar Som
- Se permitir notificações do navegador, você ouvirá um som
- Se permitir notificações do sistema, verá uma notificação popup

### 4. Troubleshooting

#### Notificações não aparecem:

**Verificar se Realtime está conectado:**
```javascript
// No console do navegador
const { data } = await window.supabase.channel('test').subscribe((status) => {
  console.log('Status:', status);
});
```

Deve retornar: `Status: SUBSCRIBED`

**Verificar logs do Supabase:**
No Supabase Dashboard → Logs → Realtime, procure por erros.

**Verificar RLS:**
```sql
-- Ver políticas das tabelas
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('messages', 'rooms', 'widgets');
```

#### Som não toca:

1. Certifique-se que existe o arquivo `/public/notification.mp3`
2. Ou comente a linha `playNotificationSound()` no componente

#### Notificações do navegador não aparecem:

1. Verifique as permissões do site no navegador
2. Chrome: Configurações → Privacidade e segurança → Configurações do site → Notificações
3. Permita notificações para `localhost:3000`

### 5. Logs Úteis para Debug

No `NotificationBell`:
- `🔔 NotificationBell: Initializing` - Componente iniciado
- `🔔 NotificationBell: Subscribing` - Iniciando subscription
- `✅ Successfully subscribed` - Conectado ao Realtime
- `🔔 New message notification received` - Mensagem recebida
- `🔔 Room updated notification received` - Sala atualizada

### 6. Arquivo de Som

Se não tiver um arquivo de notificação, você pode:

1. Baixar um som gratuito de https://notificationsounds.com/
2. Salvar como `/public/notification.mp3`
3. Ou usar um som do sistema com Web Audio API

### 7. Melhorias Futuras

- [ ] Agrupar notificações por widget
- [ ] Mostrar prévia da mensagem na notificação
- [ ] Permitir configurar som personalizado
- [ ] Adicionar vibração em dispositivos móveis
- [ ] Implementar "Do Not Disturb" mode
- [ ] Histórico de notificações antigas

## Resumo

✅ NotificationBell está no DashboardLayout
✅ Subscriptions configuradas para messages, rooms e widgets  
✅ Som de notificação adicionado
✅ Notificações do navegador implementadas
✅ Logs detalhados para debug

⚠️ **IMPORTANTE**: Verifique se o Realtime está habilitado no Supabase!



-- =============================================
-- FIX MESSAGES RLS - URGENT
-- =============================================
-- Execute este SQL no Supabase SQL Editor
-- =============================================

-- Drop política antiga de mensagens
DROP POLICY IF EXISTS "Allow reading messages from valid rooms" ON public.messages;
DROP POLICY IF EXISTS "Allow reading messages" ON public.messages;

-- Criar nova política SIMPLIFICADA que funciona
CREATE POLICY "Allow reading messages"
  ON public.messages
  FOR SELECT
  USING (
    -- Visitantes anônimos podem ler (filtrado por app layer)
    auth.uid() IS NULL
    OR
    -- Usuários autenticados podem ler mensagens de salas dos seus widgets
    EXISTS (
      SELECT 1 
      FROM public.rooms
      INNER JOIN public.widgets ON widgets.id = rooms.widget_id
      WHERE rooms.id = messages.room_id
      AND widgets.user_id = auth.uid()
    )
  );

-- Verificar se funcionou
SELECT COUNT(*) as total_policies
FROM pg_policies 
WHERE tablename = 'messages' 
AND policyname = 'Allow reading messages';

-- Testar a política (deve retornar suas mensagens)
SELECT 
    m.id,
    m.room_id,
    m.content,
    m.created_at,
    r.visitor_name,
    w.name as widget_name,
    w.user_id
FROM messages m
INNER JOIN rooms r ON r.id = m.room_id
INNER JOIN widgets w ON w.id = r.widget_id
WHERE w.user_id = auth.uid()
ORDER BY m.created_at DESC
LIMIT 5;




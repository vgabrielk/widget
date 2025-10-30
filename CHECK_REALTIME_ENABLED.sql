-- =====================================================
-- VERIFICAR SE REALTIME ESTÁ HABILITADO
-- =====================================================
-- Execute no Supabase Dashboard → SQL Editor
-- =====================================================

-- 1. Verificar se a tabela rooms está na publicação realtime
SELECT 
    schemaname,
    tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('rooms', 'messages', 'widgets');

-- =====================================================
-- RESULTADO ESPERADO:
-- Deve mostrar:
-- - rooms
-- - messages  
-- - widgets
-- =====================================================

-- 2. Se NÃO aparecer 'rooms', execute isto:
-- ALTER PUBLICATION supabase_realtime ADD TABLE rooms;

-- 3. Verificar configuração de Realtime
SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime';

-- =====================================================
-- ✅ SE ROOMS NÃO ESTIVER NA LISTA, EXECUTE:
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.widgets;

-- =====================================================
-- Verificar novamente após adicionar
-- =====================================================

SELECT 
    schemaname,
    tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;


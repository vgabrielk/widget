-- =====================================================
-- EXECUTE ESTE SQL NO SUPABASE DASHBOARD
-- =====================================================
-- 
-- 📍 ONDE EXECUTAR:
-- 1. Acesse: https://supabase.com/dashboard
-- 2. Selecione seu projeto
-- 3. Vá em "SQL Editor" (menu lateral)
-- 4. Cole este código completo
-- 5. Clique em "Run"
--
-- ⚠️ IMPORTANTE: Este fix permite criar novas conversas
--    quando a anterior foi encerrada pelo suporte
-- =====================================================

-- Remove a constraint antiga que bloqueia múltiplas rooms
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_widget_id_visitor_id_key;

-- Cria constraint PARCIAL
-- Permite apenas 1 room ABERTA por (widget_id, visitor_id)
-- Mas permite múltiplas rooms FECHADAS (histórico)
CREATE UNIQUE INDEX IF NOT EXISTS rooms_widget_visitor_open_unique 
ON public.rooms (widget_id, visitor_id) 
WHERE status = 'open';

-- Adiciona comentário explicativo
COMMENT ON INDEX rooms_widget_visitor_open_unique IS 
  'Apenas 1 room aberta por visitante. Permite múltiplas fechadas para histórico.';

-- =====================================================
-- ✅ RESULTADO ESPERADO:
-- 
-- ANTES:
-- - Erro ao criar nova room se já existir alguma (aberta ou fechada)
-- 
-- DEPOIS:
-- - Permite 1 room aberta por visitante
-- - Permite múltiplas rooms fechadas (histórico de conversas)
-- - Nova conversa é criada quando a anterior é fechada
-- =====================================================

-- Verificar se funcionou
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'rooms' 
AND indexname = 'rooms_widget_visitor_open_unique';


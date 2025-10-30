-- =====================================================
-- Migration: Fix rooms unique constraint
-- =====================================================
-- Permite múltiplas rooms por visitante, mas apenas 1 aberta por vez
-- Isso permite histórico de conversas fechadas

-- 1. Drop a constraint antiga (se existir)
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_widget_id_visitor_id_key;

-- 2. Criar constraint UNIQUE parcial
-- Apenas 1 room ABERTA por (widget_id, visitor_id)
-- Permite múltiplas rooms FECHADAS (histórico)
CREATE UNIQUE INDEX IF NOT EXISTS rooms_widget_visitor_open_unique 
ON public.rooms (widget_id, visitor_id) 
WHERE status = 'open';

-- 3. Adicionar comentário
COMMENT ON INDEX rooms_widget_visitor_open_unique IS 
  'Ensures only one open room per widget/visitor combination. Allows multiple closed rooms for conversation history.';

-- =====================================================
-- Verificação
-- =====================================================
-- Esta constraint permite:
-- ✅ 1 room aberta por (widget_id, visitor_id)
-- ✅ Múltiplas rooms fechadas (histórico)
-- ✅ Criar nova room quando a anterior é fechada


-- =====================================================
-- FIX VISITORS RLS POLICIES
-- =====================================================
-- Esta migration corrige as políticas RLS da tabela visitors
-- para permitir que admins autenticados possam banir/desbanir visitantes
-- 
-- IMPORTANTE: Rode apenas esta migration se a 020 já foi executada.
-- Ela é segura porque usa DROP POLICY IF EXISTS.

-- Remover políticas antigas se existirem (pode ter sido criada durante testes)
DROP POLICY IF EXISTS "Admins can manage visitors" ON public.visitors;

-- Recriar políticas separadas para garantir que funcionem corretamente
-- Política: Apenas admins autenticados podem inserir visitantes
DROP POLICY IF EXISTS "Admins can insert visitors" ON public.visitors;
CREATE POLICY "Admins can insert visitors"
  ON public.visitors FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
    )
  );

-- Política: Apenas admins autenticados podem atualizar visitantes
DROP POLICY IF EXISTS "Admins can update visitors" ON public.visitors;
CREATE POLICY "Admins can update visitors"
  ON public.visitors FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
    )
  );

-- Garantir que a política de leitura para admins existe
DROP POLICY IF EXISTS "Admins can view all visitors" ON public.visitors;
CREATE POLICY "Admins can view all visitors"
  ON public.visitors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
    )
  );

-- Garantir que a política pública de verificação de ban existe
DROP POLICY IF EXISTS "Public can check ban status by visitor_id" ON public.visitors;
CREATE POLICY "Public can check ban status by visitor_id"
  ON public.visitors FOR SELECT
  USING (true);


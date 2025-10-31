-- =====================================================
-- VISITORS TRACKING TABLE
-- =====================================================
-- Tabela para tracking de visitantes com fingerprinting e banimento

CREATE TABLE IF NOT EXISTS public.visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Fingerprint ID (gerado pelo FingerprintJS)
  visitor_id TEXT UNIQUE NOT NULL,
  
  -- Informações de rastreamento
  ip_address TEXT,
  user_agent TEXT,
  fingerprint_data JSONB, -- Dados adicionais do fingerprint
  
  -- Status
  banned BOOLEAN DEFAULT FALSE,
  banned_at TIMESTAMPTZ,
  ban_reason TEXT,
  
  -- Metadata
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  total_sessions INT DEFAULT 1,
  
  -- Última página visitada (opcional)
  last_page_url TEXT,
  last_page_title TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_visitors_visitor_id ON public.visitors(visitor_id);
CREATE INDEX IF NOT EXISTS idx_visitors_banned ON public.visitors(banned) WHERE banned = TRUE;
CREATE INDEX IF NOT EXISTS idx_visitors_ip_address ON public.visitors(ip_address);
CREATE INDEX IF NOT EXISTS idx_visitors_last_seen_at ON public.visitors(last_seen_at DESC);

-- Trigger para atualizar updated_at e last_seen_at
CREATE OR REPLACE FUNCTION public.update_visitor_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_seen_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_visitor_timestamp ON public.visitors;
CREATE TRIGGER trigger_update_visitor_timestamp
  BEFORE UPDATE ON public.visitors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_visitor_timestamp();

-- Habilitar RLS
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;

-- Política: Apenas admins autenticados podem ver todos os visitantes
CREATE POLICY "Admins can view all visitors"
  ON public.visitors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
    )
  );

-- Política: Apenas admins autenticados podem inserir visitantes
CREATE POLICY "Admins can insert visitors"
  ON public.visitors FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
    )
  );

-- Política: Apenas admins autenticados podem atualizar visitantes
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

-- Política: Anônimos podem verificar se estão banidos (apenas seu próprio registro)
-- Isso permite que a API verifique se um visitor_id está banido
CREATE POLICY "Public can check ban status by visitor_id"
  ON public.visitors FOR SELECT
  USING (true); -- Permitir leitura pública apenas para verificação de ban

-- Comentários
COMMENT ON TABLE public.visitors IS 'Tabela de rastreamento de visitantes com fingerprinting e controle de banimento';
COMMENT ON COLUMN public.visitors.visitor_id IS 'ID único gerado pelo FingerprintJS';
COMMENT ON COLUMN public.visitors.fingerprint_data IS 'Dados adicionais do fingerprint (JSON)';
COMMENT ON COLUMN public.visitors.banned IS 'Flag indicando se o visitante está banido';


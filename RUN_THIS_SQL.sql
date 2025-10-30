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
-- ⚠️ IMPORTANTE: Execute tudo de uma vez!
-- =====================================================

-- Adiciona a coluna domains se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'widgets' 
    AND column_name = 'domains'
  ) THEN
    ALTER TABLE public.widgets ADD COLUMN domains TEXT[];
    RAISE NOTICE '✅ Coluna domains adicionada com sucesso!';
  ELSE
    RAISE NOTICE '✅ Coluna domains já existe - tudo OK!';
  END IF;
END $$;

-- Garante que a coluna pode ser NULL
ALTER TABLE public.widgets ALTER COLUMN domains DROP NOT NULL;

-- Adiciona comentário explicativo
COMMENT ON COLUMN public.widgets.domains IS 'Array of allowed domains for widget security. NULL = all domains allowed';

-- Verifica se funcionou
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'widgets' 
AND table_schema = 'public'
AND column_name = 'domains';

-- =====================================================
-- ✅ SE VIR UMA LINHA COM:
-- column_name: domains
-- data_type: ARRAY
-- is_nullable: YES
-- 
-- SIGNIFICA QUE FUNCIONOU! 🎉
-- =====================================================


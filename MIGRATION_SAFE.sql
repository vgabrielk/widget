-- MIGRATION SEGURA - Pode executar múltiplas vezes sem erro
-- Execute este SQL no Supabase SQL Editor

-- 1. Fazer a coluna content aceitar NULL (se ainda não for)
DO $$ 
BEGIN
    ALTER TABLE public.messages
    ALTER COLUMN content DROP NOT NULL;
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- 2. Adicionar colunas para imagens (se ainda não existem)
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS image_name TEXT;

-- 3. Adicionar constraint (drop se já existir)
ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_content_or_image_check;

ALTER TABLE public.messages
ADD CONSTRAINT messages_content_or_image_check 
CHECK (content IS NOT NULL OR image_url IS NOT NULL);

-- 4. Criar bucket para imagens (ignora se já existe)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Remover policies antigas se existirem
DROP POLICY IF EXISTS "Anyone can upload chat images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view chat images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own chat images" ON storage.objects;

-- 6. Criar policies novas
CREATE POLICY "Anyone can upload chat images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'chat-images');

CREATE POLICY "Anyone can view chat images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-images');

CREATE POLICY "Users can delete their own chat images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'chat-images');

-- 7. Índice para performance
CREATE INDEX IF NOT EXISTS idx_messages_image_url 
ON public.messages(image_url) 
WHERE image_url IS NOT NULL;

-- 8. Comentários
COMMENT ON COLUMN public.messages.image_url IS 'URL of the uploaded image from Supabase Storage';
COMMENT ON COLUMN public.messages.image_name IS 'Original filename of the uploaded image';

-- Pronto! ✅
SELECT 'Migration executada com sucesso! 🎉' as result;


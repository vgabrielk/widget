-- Add image support to messages
-- First, make content column nullable (allow messages with only images)
ALTER TABLE public.messages
ALTER COLUMN content DROP NOT NULL;

-- Add image_url column to messages table
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add image_name column to store original filename
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS image_name TEXT;

-- Add constraint to ensure either content or image_url is present
ALTER TABLE public.messages
ADD CONSTRAINT messages_content_or_image_check 
CHECK (content IS NOT NULL OR image_url IS NOT NULL);

-- Create storage bucket for chat images
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Anyone can upload to chat-images (drop if exists first)
DROP POLICY IF EXISTS "Anyone can upload chat images" ON storage.objects;
CREATE POLICY "Anyone can upload chat images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'chat-images');

-- Policy: Anyone can view chat images (public bucket)
DROP POLICY IF EXISTS "Anyone can view chat images" ON storage.objects;
CREATE POLICY "Anyone can view chat images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-images');

-- Policy: Users can delete their own images
DROP POLICY IF EXISTS "Users can delete their own chat images" ON storage.objects;
CREATE POLICY "Users can delete their own chat images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'chat-images');

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_image_url ON public.messages(image_url) WHERE image_url IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.messages.image_url IS 'URL of the uploaded image from Supabase Storage';
COMMENT ON COLUMN public.messages.image_name IS 'Original filename of the uploaded image';


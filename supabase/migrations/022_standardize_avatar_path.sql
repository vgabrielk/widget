-- =====================================================
-- STANDARDIZE AVATAR PATH STORAGE
-- =====================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profiles'
      AND table_schema = 'public'
      AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE public.profiles
    RENAME COLUMN avatar_url TO avatar_path;
  END IF;
END $$;

-- Normalize stored values to ensure we only keep the file name/path inside the bucket
UPDATE public.profiles
SET avatar_path = NULL
WHERE avatar_path = '';

UPDATE public.profiles
SET avatar_path = split_part(avatar_path, '?', 1)
WHERE avatar_path LIKE '%?%';

UPDATE public.profiles
SET avatar_path = regexp_replace(
    avatar_path,
    '^https?://[^/]+/storage/v1/object/public/avatars/',
    '',
    'i'
  )
WHERE avatar_path ILIKE 'http%/storage/v1/object/public/avatars/%';

UPDATE public.profiles
SET avatar_path = regexp_replace(
    avatar_path,
    '^/?avatars/',
    '',
    'i'
  )
WHERE avatar_path ILIKE 'avatars/%' OR avatar_path ILIKE '/avatars/%';

UPDATE public.profiles
SET avatar_path = regexp_replace(
    avatar_path,
    '^dashboard/.*/(avatar-[^/]+)$',
    '\1',
    'i'
  )
WHERE avatar_path ILIKE 'dashboard/%avatar-%';

COMMENT ON COLUMN public.profiles.avatar_path IS 'Path to avatar in storage bucket (e.g. avatar-123.webp)';

